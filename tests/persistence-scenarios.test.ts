import { describe, expect, it } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import type { ShoppingAppController } from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import { createPriceMemoryRecord } from "../src/domain/price-memory";
import {
  createActiveTrip,
  createCartItem,
  isoTimestamp,
  itemId,
  reduceTrip,
  sameTripContents,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import { encodePriceMemorySnapshot } from "../src/infrastructure/storage/price-memory-storage";
import { PRICE_MEMORY_STORAGE_KEY } from "../src/infrastructure/storage/price-memory-storage-schema";
import {
  SET_ASIDE_STORAGE_KEY_PREFIX,
  decodeHistorySnapshot,
  encodeActiveTripSnapshot,
  encodeHistorySnapshot,
  type StorageLike,
} from "../src/infrastructure/storage/shopping-storage";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
} from "../src/infrastructure/storage/shopping-storage-schema";

const START = "2026-09-21T09:00:00.000Z";
const ITEM_TIME = "2026-09-21T09:05:00.000Z";
const DONE_TIME = "2026-09-21T09:30:00.000Z";
const NOW = "2026-09-22T10:00:00.000Z";

const must = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => must(isoTimestamp(value));

const activeTrip = (id: string): ActiveTrip => {
  const trip = must(
    createActiveTrip({ id, budgetMinor: money(5_000), startedAt: START }),
  );
  const item = must(
    createCartItem({
      id: `${id}-item`,
      unitPriceMinor: money(379),
      quantity: 1,
      label: "Milk",
      priceSource: { kind: "manual" },
      priceConfidence: { kind: "confirmed", confirmedAt: time(ITEM_TIME) },
      createdAt: ITEM_TIME,
    }),
  );
  const next = must(reduceTrip(trip, { type: "add-item", item }));

  if (next.status !== "active") {
    throw new Error("Expected active trip");
  }

  return next;
};

const completedTrip = (id: string): CompletedTrip => {
  const done = must(
    reduceTrip(activeTrip(id), {
      type: "complete-trip",
      completedAt: time(DONE_TIME),
    }),
  );

  if (done.status !== "completed") {
    throw new Error("Expected completed trip");
  }

  return done;
};

const editedSinceCompleted = (): ActiveTrip => {
  const edited = must(
    reduceTrip(activeTrip("trip-done-a"), {
      type: "update-item",
      itemId: must(itemId("trip-done-a-item")),
      patch: { quantity: 3 },
      now: time(DONE_TIME),
    }),
  );

  if (edited.status !== "active") {
    throw new Error("Expected active trip");
  }

  return edited;
};

const encodeActive = (trip: ActiveTrip): string => {
  const encoded = encodeActiveTripSnapshot(trip, ITEM_TIME);

  if (!encoded.ok) {
    throw new Error("encode active");
  }

  return encoded.raw;
};

const encodeHistory = (trips: readonly CompletedTrip[]): string => {
  const encoded = encodeHistorySnapshot(trips, DONE_TIME);

  if (!encoded.ok) {
    throw new Error("encode history");
  }

  return encoded.raw;
};

const withExtraEntry = (raw: string, entry: unknown): string => {
  const envelope = JSON.parse(raw) as { data: { trips: unknown[] } };
  envelope.data.trips.push(entry);
  return JSON.stringify(envelope);
};

type ActiveState =
  | "absent"
  | "valid"
  | "stale-completed"
  | "edited-since-completed"
  | "malformed"
  | "invalid-data"
  | "future-version";

type HistoryState =
  | "absent"
  | "valid"
  | "partly-damaged"
  | "malformed"
  | "future-version"
  | "duplicate-ids";

type MemoryState = "absent" | "valid" | "malformed";

type FailureMode =
  | "none"
  | "all-writes-fail"
  | "active-remove-fails"
  | "history-read-fails"
  | "storage-blocked";

const ACTIVE_STATES: readonly ActiveState[] = [
  "absent",
  "valid",
  "stale-completed",
  "edited-since-completed",
  "malformed",
  "invalid-data",
  "future-version",
];
const HISTORY_STATES: readonly HistoryState[] = [
  "absent",
  "valid",
  "partly-damaged",
  "malformed",
  "future-version",
  "duplicate-ids",
];
const MEMORY_STATES: readonly MemoryState[] = ["absent", "valid", "malformed"];
const FAILURE_MODES: readonly FailureMode[] = [
  "none",
  "all-writes-fail",
  "active-remove-fails",
  "history-read-fails",
  "storage-blocked",
];

const activeRaw = (state: ActiveState): string | null => {
  switch (state) {
    case "absent":
      return null;
    case "valid":
      return encodeActive(activeTrip("trip-open"));
    case "stale-completed":
      return encodeActive(activeTrip("trip-done-a"));
    case "edited-since-completed":
      return encodeActive(editedSinceCompleted());
    case "malformed":
      return "{broken active";
    case "invalid-data": {
      const envelope = JSON.parse(encodeActive(activeTrip("trip-open"))) as {
        data: { budgetMinor: number };
      };
      envelope.data.budgetMinor = -5;
      return JSON.stringify(envelope);
    }
    case "future-version":
      return JSON.stringify({ schemaVersion: 9, savedAt: ITEM_TIME, data: {} });
  }
};

const historyRaw = (state: HistoryState): string | null => {
  const valid = encodeHistory([completedTrip("trip-done-a")]);

  switch (state) {
    case "absent":
      return null;
    case "valid":
      return valid;
    case "partly-damaged":
      return withExtraEntry(valid, { id: "damaged", status: "completed" });
    case "malformed":
      return "{broken history";
    case "future-version":
      return JSON.stringify({ schemaVersion: 4, savedAt: DONE_TIME, data: {} });
    case "duplicate-ids": {
      const envelope = JSON.parse(valid) as { data: { trips: unknown[] } };
      return withExtraEntry(valid, envelope.data.trips[0]);
    }
  }
};

const memoryRaw = (state: MemoryState): string | null => {
  if (state === "absent") {
    return null;
  }

  if (state === "malformed") {
    return "{broken memory";
  }

  const record = must(
    createPriceMemoryRecord({
      label: "Bread",
      unitPriceMinor: money(199),
      observedAt: DONE_TIME,
      source: { kind: "manual" },
    }),
  );
  const encoded = encodePriceMemorySnapshot([record], DONE_TIME);

  if (!encoded.ok) {
    throw new Error("encode memory");
  }

  return encoded.raw;
};

const createStorage = (
  entries: ReadonlyMap<string, string>,
  failure: FailureMode,
) => {
  const values = new Map(entries);
  const storage: StorageLike = {
    getItem(key) {
      if (failure === "history-read-fails" && key === HISTORY_STORAGE_KEY) {
        throw new Error("read failed");
      }

      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (failure === "all-writes-fail") {
        throw new Error("quota");
      }

      values.set(key, value);
    },
    removeItem(key) {
      if (failure === "all-writes-fail") {
        throw new Error("remove");
      }

      if (failure === "active-remove-fails" && key === ACTIVE_TRIP_STORAGE_KEY) {
        throw new Error("remove");
      }

      values.delete(key);
    },
  };
  return { values, storage };
};

const isReadableActive = (state: ActiveState): boolean =>
  state === "absent" ||
  state === "valid" ||
  state === "stale-completed" ||
  state === "edited-since-completed";

interface Outcome {
  readonly finished: boolean;
  readonly actions: readonly string[];
}

const shopLikeAUser = (
  boot: () => ShoppingAppController,
): { readonly controller: ShoppingAppController; readonly outcome: Outcome } => {
  const actions: string[] = [];
  let controller = boot();
  let state = controller.getSnapshot();

  if (state.lifecycle === "recovery") {
    const setAside = controller.setAsideUnreadableActiveTrip();
    actions.push(`set-aside-active:${setAside.ok}`);

    if (!setAside.ok || controller.getSnapshot().lifecycle === "recovery") {
      actions.push(`continue:${controller.continueWithoutSaving().ok}`);
    }
  }

  state = controller.getSnapshot();
  expect(state.lifecycle).not.toBe("recovery");
  expect(state.lifecycle).not.toBe("booting");

  if (state.lifecycle === "active") {
    const finished = controller.completeTrip();
    actions.push(`finish-existing:${finished.ok}`);

    if (
      !finished.ok &&
      finished.error.kind === "application" &&
      finished.error.code === "history-unreadable"
    ) {
      actions.push(`set-aside-history:${controller.setAsideDamagedHistory().ok}`);
      actions.push(`finish-existing-again:${controller.completeTrip().ok}`);
    }
  }

  state = controller.getSnapshot();

  if (state.lifecycle === "completed-summary") {
    const dismissed = controller.dismissCompletedSummary();
    actions.push(`dismiss:${dismissed.ok}`);

    if (!dismissed.ok) {
      controller.retryPersistence();
      const retried = controller.dismissCompletedSummary();
      actions.push(`dismiss-after-retry:${retried.ok}`);

      if (!retried.ok) {
        controller = boot();
        actions.push(`reload:${controller.getSnapshot().lifecycle}`);
      }
    }
  }

  state = controller.getSnapshot();

  if (state.lifecycle === "idle") {
    const started = controller.startTrip({ budgetMinor: money(4_000) });
    actions.push(`start:${started.ok}`);
    expect(started.ok).toBe(true);
  }

  state = controller.getSnapshot();

  if (state.lifecycle !== "active") {
    return { controller, outcome: { finished: false, actions } };
  }

  const added = controller.addManualItem({
    unitPriceMinor: money(250),
    quantity: 2,
  });
  actions.push(`add:${added.ok}`);
  expect(added.ok).toBe(true);

  let finished = controller.completeTrip();
  actions.push(`finish:${finished.ok}`);

  if (
    !finished.ok &&
    finished.error.kind === "application" &&
    finished.error.code === "history-unreadable"
  ) {
    const repaired = controller.setAsideDamagedHistory();
    actions.push(`set-aside-history:${repaired.ok}`);

    if (!repaired.ok) {
      controller.retryHistoryRead();
    }

    finished = controller.completeTrip();
    actions.push(`finish-again:${finished.ok}`);
  }

  return { controller, outcome: { finished: finished.ok, actions } };
};

type MidSession = "none" | "history-corrupted";
const MID_SESSION: readonly MidSession[] = ["none", "history-corrupted"];
const MID_SESSION_RAW = "{corrupted while the app was open";

const scenarios = ACTIVE_STATES.flatMap((active) =>
  HISTORY_STATES.flatMap((history) =>
    MEMORY_STATES.flatMap((memory) =>
      FAILURE_MODES.flatMap((failure) =>
        MID_SESSION.map((midSession) => ({
          active,
          history,
          memory,
          failure,
          midSession,
        })),
      ),
    ),
  ),
);

describe("persistence scenario matrix", () => {
  it("covers every combination", () => {
    expect(scenarios).toHaveLength(
      ACTIVE_STATES.length *
        HISTORY_STATES.length *
        MEMORY_STATES.length *
        FAILURE_MODES.length *
        MID_SESSION.length,
    );
  });

  it.each(scenarios)(
    "active=$active history=$history memory=$memory failure=$failure mid=$midSession",
    ({ active, history, memory, failure, midSession }) => {
      const entries = new Map<string, string>();
      const seed = (key: string, raw: string | null) => {
        if (raw !== null) {
          entries.set(key, raw);
        }
      };
      seed(ACTIVE_TRIP_STORAGE_KEY, activeRaw(active));
      seed(HISTORY_STORAGE_KEY, historyRaw(history));
      seed(PRICE_MEMORY_STORAGE_KEY, memoryRaw(memory));

      const { values, storage } = createStorage(entries, failure);
      let id = 0;
      const boot = () =>
        bootstrapBrowserShoppingAppController({
          storage: failure === "storage-blocked" ? null : storage,
          storageScope: null,
          clock: { now: () => time(NOW) },
          ids: {
            tripId: () => `trip-new-${(id += 1)}`,
            itemId: () => `item-new-${(id += 1)}`,
          },
        });
      const booted = boot().getSnapshot();
      const corrupts =
        midSession === "history-corrupted" &&
        failure !== "storage-blocked" &&
        failure !== "all-writes-fail";

      if (corrupts) {
        values.set(HISTORY_STORAGE_KEY, MID_SESSION_RAW);
      }

      const expectRecovery =
        failure === "storage-blocked" || !isReadableActive(active);
      expect(booted.lifecycle === "recovery").toBe(expectRecovery);

      if (
        !expectRecovery &&
        (history === "partly-damaged" ||
          history === "malformed" ||
          history === "future-version" ||
          history === "duplicate-ids" ||
          failure === "history-read-fails")
      ) {
        expect(booted.historyIntegrity.status).toBe("degraded");
      }

      const { controller, outcome } = shopLikeAUser(boot);
      const final = controller.getSnapshot();
      const context = JSON.stringify({
        outcome,
        persistence: final.persistence,
        history: final.historyIntegrity,
      });

      expect(["active", "completed-summary"], context).toContain(final.lifecycle);

      const durable =
        failure === "none" ||
        (failure === "active-remove-fails" && isReadableActive(active));
      if (durable) {
        expect(outcome.finished, context).toBe(true);
        const stored = values.get(HISTORY_STORAGE_KEY);
        expect(stored, context).toBeDefined();
        const decoded = decodeHistorySnapshot(stored ?? "");
        expect(decoded.ok && decoded.invalidEntryCount === 0, context).toBe(true);
        expect(
          decoded.ok && decoded.trips.some((trip) => trip.id.startsWith("trip-new-")),
          context,
        ).toBe(true);
      } else {
        expect(
          final.persistence.status === "degraded" ||
            final.historyIntegrity.status === "degraded",
          context,
        ).toBe(true);

        if (outcome.finished) {
          expect(final.persistence, context).toMatchObject({
            status: "degraded",
            issue: { code: "session-only" },
          });
        }
      }

      const backups = [...values.entries()]
        .filter(([key]) => key.startsWith(SET_ASIDE_STORAGE_KEY_PREFIX))
        .map(([, value]) => (JSON.parse(value) as { raw: string }).raw);
      const unreadable: Array<[string, string | null]> = [
        [ACTIVE_TRIP_STORAGE_KEY, isReadableActive(active) ? null : activeRaw(active)],
        [
          HISTORY_STORAGE_KEY,
          history === "absent" || history === "valid" || corrupts
            ? null
            : historyRaw(history),
        ],
        [PRICE_MEMORY_STORAGE_KEY, memory === "malformed" ? memoryRaw(memory) : null],
        [HISTORY_STORAGE_KEY, corrupts ? MID_SESSION_RAW : null],
      ];

      for (const [key, raw] of unreadable) {
        if (raw === null) {
          continue;
        }

        const preserved = values.get(key) === raw || backups.includes(raw);
        expect(preserved, `${key} lost: ${context}`).toBe(true);
      }

      const openCart =
        active === "valid"
          ? activeTrip("trip-open")
          : active === "edited-since-completed"
            ? editedSinceCompleted()
            : active === "stale-completed" && !corrupts
              ? activeTrip("trip-done-a")
              : null;
      if (durable && openCart !== null) {
        const decoded = decodeHistorySnapshot(values.get(HISTORY_STORAGE_KEY) ?? "");
        const matches = decoded.ok
          ? decoded.trips.filter((trip) =>
              sameTripContents(trip, { ...openCart, id: trip.id }),
            )
          : [];
        expect(matches, context).toHaveLength(1);
      }

      if (
        durable &&
        !corrupts &&
        (history === "valid" || history === "partly-damaged")
      ) {
        const decoded = decodeHistorySnapshot(values.get(HISTORY_STORAGE_KEY) ?? "");
        expect(
          decoded.ok && decoded.trips.some((trip) => trip.id === "trip-done-a"),
          context,
        ).toBe(true);
      }
    },
  );
});
