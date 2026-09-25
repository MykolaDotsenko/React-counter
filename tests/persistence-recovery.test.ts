import { describe, expect, it } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import type {
  Clock,
  IdGenerator,
  ShoppingAppController,
} from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import {
  createActiveTrip,
  createCartItem,
  isoTimestamp,
  reduceTrip,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
} from "../src/infrastructure/storage/shopping-storage-schema";
import {
  SET_ASIDE_STORAGE_KEY_PREFIX,
  bootstrapShoppingPersistence,
  completeTripPersistence,
  encodeActiveTripSnapshot,
  encodeHistorySnapshot,
  restoreHistory,
  setAsideDamagedHistory,
  setAsideUnreadableActiveTrip,
  type StorageLike,
} from "../src/infrastructure/storage/shopping-storage";

const START = "2026-09-21T09:00:00.000Z";
const ITEM_TIME = "2026-09-21T09:05:00.000Z";
const DONE_TIME = "2026-09-21T09:30:00.000Z";
const NOW = "2026-09-22T10:00:00.000Z";

const must = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected a successful result");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => must(isoTimestamp(value));

const activeTrip = (id = "trip-active"): ActiveTrip => {
  const trip = must(
    createActiveTrip({ id, budgetMinor: money(5_000), startedAt: START }),
  );
  const item = must(
    createCartItem({
      id: `${id}-item`,
      unitPriceMinor: money(379),
      quantity: 2,
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
  const completed = must(
    reduceTrip(activeTrip(id), {
      type: "complete-trip",
      completedAt: time(DONE_TIME),
    }),
  );

  if (completed.status !== "completed") {
    throw new Error("Expected completed trip");
  }

  return completed;
};

const activeRaw = (trip: ActiveTrip = activeTrip()): string => {
  const encoded = encodeActiveTripSnapshot(trip, ITEM_TIME);

  if (!encoded.ok) {
    throw new Error("Expected encodable active trip");
  }

  return encoded.raw;
};

const historyRaw = (trips: readonly CompletedTrip[]): string => {
  const encoded = encodeHistorySnapshot(trips, DONE_TIME);

  if (!encoded.ok) {
    throw new Error("Expected encodable history");
  }

  return encoded.raw;
};

/** One valid trip plus one entry the v1 schema rejects (an unknown field). */
const partlyDamagedHistoryRaw = (): string => {
  const envelope = JSON.parse(historyRaw([completedTrip("trip-kept")])) as {
    data: { trips: Record<string, unknown>[] };
  };
  const damaged = { ...envelope.data.trips[0], id: "trip-damaged", note: "x" };
  envelope.data.trips.push(damaged);
  return JSON.stringify(envelope);
};

interface MemoryStorage extends StorageLike {
  readonly values: Map<string, string>;
}

interface FailureOptions {
  readonly failSetPrefixes?: readonly string[];
  readonly failRemoveKeys?: readonly string[];
  readonly failGetKeys?: readonly string[];
}

const memoryStorage = (
  entries: Record<string, string> = {},
  options: FailureOptions = {},
): MemoryStorage => {
  const values = new Map(Object.entries(entries));

  return {
    values,
    getItem(key) {
      if (options.failGetKeys?.includes(key)) {
        throw new Error("read failed");
      }

      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.failSetPrefixes?.some((prefix) => key.startsWith(prefix))) {
        throw new Error("quota");
      }

      values.set(key, value);
    },
    removeItem(key) {
      if (options.failRemoveKeys?.includes(key)) {
        throw new Error("remove failed");
      }

      values.delete(key);
    },
  };
};

const backups = (storage: MemoryStorage) =>
  [...storage.values.entries()]
    .filter(([key]) => key.startsWith(SET_ASIDE_STORAGE_KEY_PREFIX))
    .map(([key, value]) => ({
      key,
      ...(JSON.parse(value) as {
        schemaVersion: number;
        setAsideAt: string;
        sourceKey: string;
        reason: string;
        raw: string;
      }),
    }));

const clock: Clock = { now: () => time(NOW) };

const sequentialIds = (): IdGenerator => {
  let next = 0;
  return {
    tripId: () => `trip-new-${(next += 1)}`,
    itemId: () => `item-new-${(next += 1)}`,
  };
};

const boot = (storage: StorageLike | null): ShoppingAppController =>
  bootstrapBrowserShoppingAppController({
    storage,
    clock,
    ids: sequentialIds(),
  });

const shopAndFinish = (controller: ShoppingAppController) => {
  const started = controller.startTrip({ budgetMinor: money(4_000) });
  const added = controller.addManualItem({
    unitPriceMinor: money(250),
    quantity: 1,
  });
  const finished = controller.completeTrip();
  return { started, added, finished };
};

describe("bootstrap separates history damage from the active trip", () => {
  it("keeps a damaged history out of recovery and reports it separately", () => {
    const storage = memoryStorage({
      [HISTORY_STORAGE_KEY]: partlyDamagedHistoryRaw(),
    });

    const result = bootstrapShoppingPersistence(storage);

    expect(result.health).toBe("healthy");
    expect(result.completedTrips.map((trip) => trip.id)).toEqual(["trip-kept"]);
    expect(result.historyIssue?.code).toBe("invalid-history-entry");
    expect(result.legacyKeysRetired).toBe(false);
  });

  it("still restores the active trip beside unreadable history", () => {
    const storage = memoryStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: activeRaw(),
      [HISTORY_STORAGE_KEY]: "{not json",
    });

    const result = bootstrapShoppingPersistence(storage);

    expect(result.health).toBe("healthy");
    expect(result.activeTrip?.id).toBe("trip-active");
    expect(result.historyIssue?.code).toBe("malformed-json");
  });

  it("marks only an unreadable active record as blocking and keeps both issues", () => {
    const storage = memoryStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: "{broken",
      [HISTORY_STORAGE_KEY]: partlyDamagedHistoryRaw(),
    });

    const result = bootstrapShoppingPersistence(storage);

    expect(result.health).toBe("degraded");

    if (result.health !== "degraded") {
      throw new Error("Expected degraded bootstrap");
    }

    expect(result.activeTripUnreadable).toBe(true);
    expect(result.issue.code).toBe("malformed-json");
    expect(result.historyIssue?.code).toBe("invalid-history-entry");
  });

  it("does not treat a failed stale-copy cleanup as an unreadable trip", () => {
    const done = completedTrip("trip-active");
    const storage = memoryStorage(
      {
        [ACTIVE_TRIP_STORAGE_KEY]: activeRaw(),
        [HISTORY_STORAGE_KEY]: historyRaw([done]),
      },
      { failRemoveKeys: [ACTIVE_TRIP_STORAGE_KEY] },
    );

    const result = bootstrapShoppingPersistence(storage);

    expect(result.health).toBe("degraded");

    if (result.health !== "degraded") {
      throw new Error("Expected degraded bootstrap");
    }

    expect(result.activeTripUnreadable).toBe(false);
    expect(result.completionCleanupPending).toBe(true);
  });
});

describe("completion never writes over unreadable history", () => {
  it("reports a history-read stage and leaves every record untouched", () => {
    const damaged = partlyDamagedHistoryRaw();
    const active = activeRaw();
    const storage = memoryStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: active,
      [HISTORY_STORAGE_KEY]: damaged,
    });

    const result = completeTripPersistence(
      storage,
      completedTrip("trip-active"),
      DONE_TIME,
    );

    expect(result).toMatchObject({
      ok: false,
      stage: "history-read",
      historyPersisted: false,
    });
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe(damaged);
    expect(storage.values.get(ACTIVE_TRIP_STORAGE_KEY)).toBe(active);
  });
});

describe("setting damaged history aside", () => {
  it("backs up the exact raw record, then keeps only the readable trips", () => {
    const damaged = partlyDamagedHistoryRaw();
    const storage = memoryStorage({ [HISTORY_STORAGE_KEY]: damaged });

    const result = setAsideDamagedHistory(storage, NOW);

    expect(result.health).toBe("healthy");

    if (result.health !== "healthy") {
      throw new Error("Expected set-aside success");
    }

    expect(result.trips.map((trip) => trip.id)).toEqual(["trip-kept"]);
    expect(backups(storage)).toEqual([
      {
        key: `${SET_ASIDE_STORAGE_KEY_PREFIX}history:${NOW}`,
        schemaVersion: 1,
        setAsideAt: NOW,
        sourceKey: HISTORY_STORAGE_KEY,
        reason: "invalid-history-entry",
        raw: damaged,
      },
    ]);
    expect(result.backupKey).toBe(`${SET_ASIDE_STORAGE_KEY_PREFIX}history:${NOW}`);

    const reread = restoreHistory(storage);
    expect(reread.health).toBe("healthy");
    expect(reread.trips.map((trip) => trip.id)).toEqual(["trip-kept"]);
  });

  it("starts history empty when nothing in it can be read", () => {
    const storage = memoryStorage({ [HISTORY_STORAGE_KEY]: "{not json" });

    const result = setAsideDamagedHistory(storage, NOW);

    expect(result).toMatchObject({ health: "healthy", trips: [] });
    expect(backups(storage)[0]).toMatchObject({
      reason: "malformed-json",
      raw: "{not json",
    });
    expect(restoreHistory(storage)).toMatchObject({
      health: "healthy",
      trips: [],
    });
  });

  it("preserves a newer-version record byte for byte before replacing it", () => {
    const future = JSON.stringify({
      schemaVersion: 2,
      savedAt: DONE_TIME,
      data: { trips: [{ id: "from-the-future" }] },
    });
    const storage = memoryStorage({ [HISTORY_STORAGE_KEY]: future });

    expect(setAsideDamagedHistory(storage, NOW).health).toBe("healthy");
    expect(backups(storage)[0]).toMatchObject({
      reason: "unsupported-version",
      raw: future,
    });
  });

  it("is a no-op for readable history and never creates a backup", () => {
    const readable = historyRaw([completedTrip("trip-ok")]);
    const storage = memoryStorage({ [HISTORY_STORAGE_KEY]: readable });

    expect(setAsideDamagedHistory(storage, NOW)).toMatchObject({
      health: "healthy",
      backupKey: null,
    });
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe(readable);
    expect(backups(storage)).toHaveLength(0);
  });

  it("changes nothing when the backup cannot be written", () => {
    const damaged = partlyDamagedHistoryRaw();
    const storage = memoryStorage(
      { [HISTORY_STORAGE_KEY]: damaged },
      { failSetPrefixes: [SET_ASIDE_STORAGE_KEY_PREFIX] },
    );

    expect(setAsideDamagedHistory(storage, NOW).health).toBe("degraded");
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe(damaged);
    expect(backups(storage)).toHaveLength(0);
  });

  it("keeps the original record when the replacement write fails", () => {
    const damaged = partlyDamagedHistoryRaw();
    const storage = memoryStorage(
      { [HISTORY_STORAGE_KEY]: damaged },
      { failSetPrefixes: [HISTORY_STORAGE_KEY] },
    );

    expect(setAsideDamagedHistory(storage, NOW).health).toBe("degraded");
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe(damaged);
    expect(backups(storage)[0]?.raw).toBe(damaged);
  });

  it("never overwrites an earlier backup taken at the same moment", () => {
    const storage = memoryStorage({ [HISTORY_STORAGE_KEY]: "{first" });

    setAsideDamagedHistory(storage, NOW);
    storage.values.set(HISTORY_STORAGE_KEY, "{second");
    setAsideDamagedHistory(storage, NOW);

    expect(backups(storage).map((backup) => [backup.key, backup.raw])).toEqual([
      [`${SET_ASIDE_STORAGE_KEY_PREFIX}history:${NOW}`, "{first"],
      [`${SET_ASIDE_STORAGE_KEY_PREFIX}history:${NOW}:2`, "{second"],
    ]);
  });
});

describe("setting an unreadable active trip aside", () => {
  it("backs up and removes only an unreadable record", () => {
    const storage = memoryStorage({ [ACTIVE_TRIP_STORAGE_KEY]: "{broken" });

    expect(setAsideUnreadableActiveTrip(storage, NOW).health).toBe("healthy");
    expect(storage.values.has(ACTIVE_TRIP_STORAGE_KEY)).toBe(false);
    expect(backups(storage)[0]).toMatchObject({
      sourceKey: ACTIVE_TRIP_STORAGE_KEY,
      reason: "malformed-json",
      raw: "{broken",
    });
  });

  it("refuses to set aside a trip that can be read", () => {
    const readable = activeRaw();
    const storage = memoryStorage({ [ACTIVE_TRIP_STORAGE_KEY]: readable });

    expect(setAsideUnreadableActiveTrip(storage, NOW)).toEqual({
      health: "healthy",
      backupKey: null,
    });
    expect(storage.values.get(ACTIVE_TRIP_STORAGE_KEY)).toBe(readable);
    expect(backups(storage)).toHaveLength(0);
  });

  it("keeps the record in place when it cannot be removed", () => {
    const storage = memoryStorage(
      { [ACTIVE_TRIP_STORAGE_KEY]: "{broken" },
      { failRemoveKeys: [ACTIVE_TRIP_STORAGE_KEY] },
    );

    expect(setAsideUnreadableActiveTrip(storage, NOW).health).toBe("degraded");
    expect(storage.values.get(ACTIVE_TRIP_STORAGE_KEY)).toBe("{broken");
    expect(backups(storage)[0]?.raw).toBe("{broken");
  });
});

describe("the shopping app never locks the shopper out", () => {
  it("starts and finishes trips after setting damaged history aside", () => {
    const storage = memoryStorage({
      [HISTORY_STORAGE_KEY]: partlyDamagedHistoryRaw(),
    });
    const controller = boot(storage);

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      persistence: { status: "healthy" },
      historyIntegrity: {
        status: "degraded",
        issue: { code: "invalid-history-entry" },
      },
    });

    const blocked = shopAndFinish(controller);

    expect(blocked.started.ok).toBe(true);
    expect(blocked.added.ok).toBe(true);
    expect(blocked.finished).toMatchObject({
      ok: false,
      error: { kind: "application", code: "history-unreadable" },
    });
    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "active",
      persistence: { status: "healthy" },
      historyIntegrity: { status: "degraded" },
    });

    const repaired = controller.setAsideDamagedHistory();

    expect(repaired.ok).toBe(true);
    expect(controller.getSnapshot().historyIntegrity.status).toBe("healthy");
    expect(controller.getSnapshot().completedTrips.map((trip) => trip.id)).toEqual([
      "trip-kept",
    ]);

    const finished = controller.completeTrip();

    expect(finished.ok).toBe(true);
    expect(controller.getSnapshot().completedTrips).toHaveLength(2);
    expect(restoreHistory(storage).trips).toHaveLength(2);
    expect(backups(storage)).toHaveLength(1);
  });

  it("refuses history deletion while history is damaged", () => {
    const storage = memoryStorage({
      [HISTORY_STORAGE_KEY]: partlyDamagedHistoryRaw(),
    });
    const controller = boot(storage);
    const before = storage.values.get(HISTORY_STORAGE_KEY);

    expect(controller.clearCompletedHistory()).toMatchObject({
      ok: false,
      error: { code: "history-write-unavailable" },
    });
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe(before);
  });

  it("sets an unreadable active trip aside and returns to a saved flow", () => {
    const storage = memoryStorage({ [ACTIVE_TRIP_STORAGE_KEY]: "{broken" });
    const controller = boot(storage);

    expect(controller.getSnapshot().lifecycle).toBe("recovery");
    expect(controller.startTrip({ budgetMinor: money(1_000) })).toMatchObject({
      ok: false,
      error: { code: "recovery-required" },
    });

    const result = controller.setAsideUnreadableActiveTrip();

    expect(result.ok).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      persistence: { status: "healthy" },
      recovery: null,
    });

    const flow = shopAndFinish(controller);

    expect(flow.finished.ok).toBe(true);
    expect(backups(storage)[0]?.raw).toBe("{broken");
  });

  it("offers no set-aside for storage that is simply unavailable", () => {
    const controller = boot(null);

    expect(controller.getSnapshot().lifecycle).toBe("recovery");
    expect(controller.setAsideUnreadableActiveTrip()).toMatchObject({
      ok: false,
      error: { code: "nothing-to-set-aside" },
    });
  });

  it("continues without saving when browser storage is unavailable", () => {
    const controller = boot(null);

    const result = controller.continueWithoutSaving();

    expect(result.ok).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      persistence: { status: "degraded", issue: { code: "session-only" } },
    });

    const flow = shopAndFinish(controller);

    expect(flow.started).toMatchObject({ ok: true, durability: "memory-only" });
    expect(flow.added).toMatchObject({ ok: true, durability: "memory-only" });
    expect(flow.finished).toMatchObject({ ok: true, durability: "memory-only" });
    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "completed-summary",
      persistence: { issue: { code: "session-only" } },
      priceMemoryPersistence: { issue: { code: "session-only" } },
    });

    // The session keeps going: the summary can be left and shopping resumes.
    expect(controller.dismissCompletedSummary().ok).toBe(true);
    const again = controller.startTripFromCompleted(
      controller.getSnapshot().completedTrips[0]!.id,
    );
    expect(again).toMatchObject({ ok: true, durability: "memory-only" });
  });

  it("never writes over an unreadable record after continuing without saving", () => {
    const future = JSON.stringify({
      schemaVersion: 7,
      savedAt: DONE_TIME,
      data: {},
    });
    const storage = memoryStorage({ [ACTIVE_TRIP_STORAGE_KEY]: future });
    const controller = boot(storage);
    const snapshot = new Map(storage.values);

    controller.continueWithoutSaving();
    shopAndFinish(controller);
    controller.retryPersistence();
    controller.clearPriceMemory();

    expect(storage.values).toEqual(snapshot);
  });

  it("re-reads history after a transient read failure", () => {
    const readable = historyRaw([completedTrip("trip-ok")]);
    const failing = { current: true };
    const values = new Map([[HISTORY_STORAGE_KEY, readable]]);
    const storage: StorageLike = {
      getItem(key) {
        if (key === HISTORY_STORAGE_KEY && failing.current) {
          throw new Error("read failed");
        }

        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    };
    const controller = boot(storage);

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      historyIntegrity: { status: "degraded", issue: { code: "read-failed" } },
    });

    failing.current = false;
    controller.retryHistoryRead();

    expect(controller.getSnapshot()).toMatchObject({
      historyIntegrity: { status: "healthy" },
    });
    expect(controller.getSnapshot().completedTrips).toHaveLength(1);
  });

  it("recovers from a stale-copy cleanup failure without entering recovery", () => {
    const storage = memoryStorage(
      {
        [ACTIVE_TRIP_STORAGE_KEY]: activeRaw(),
        [HISTORY_STORAGE_KEY]: historyRaw([completedTrip("trip-active")]),
      },
      { failRemoveKeys: [ACTIVE_TRIP_STORAGE_KEY] },
    );
    const controller = boot(storage);

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      completionCleanupPending: true,
      persistence: { status: "degraded", issue: { code: "remove-failed" } },
    });
    expect(controller.startTrip({ budgetMinor: money(2_000) }).ok).toBe(true);
  });
});

describe("independent review regressions", () => {
  const flakyHistoryStorage = (entries: Record<string, string>) => {
    const values = new Map(Object.entries(entries));
    const control = { failHistoryRead: true };
    const storage: StorageLike = {
      getItem(key) {
        if (key === HISTORY_STORAGE_KEY && control.failHistoryRead) {
          throw new Error("read failed");
        }

        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    };
    return { values, storage, control };
  };

  it("never drops trips it has not loaded after a transient history read failure", () => {
    const olderTrips = ["old-1", "old-2", "old-3"].map(completedTrip);
    const { values, storage, control } = flakyHistoryStorage({
      [HISTORY_STORAGE_KEY]: historyRaw(olderTrips),
    });
    const controller = boot(storage);

    expect(controller.getSnapshot().completedTrips).toHaveLength(0);

    control.failHistoryRead = false;
    const flow = shopAndFinish(controller);

    expect(flow.finished.ok).toBe(true);
    expect(controller.getSnapshot().completedTrips.map((trip) => trip.id)).toEqual([
      "old-1",
      "old-2",
      "old-3",
      "trip-new-1",
    ]);

    controller.dismissCompletedSummary();
    expect(controller.deleteCompletedTrip("trip-new-1" as never).ok).toBe(true);

    const stored = restoreHistory(storage);
    expect(stored.trips.map((trip) => trip.id)).toEqual(["old-1", "old-2", "old-3"]);
    expect(values.has(HISTORY_STORAGE_KEY)).toBe(true);
  });

  it("refuses to delete over history that became unreadable after it was loaded", () => {
    const storage = memoryStorage({
      [HISTORY_STORAGE_KEY]: historyRaw([completedTrip("trip-a"), completedTrip("trip-b")]),
    });
    const controller = boot(storage);
    storage.values.set(HISTORY_STORAGE_KEY, "{corrupted later");

    expect(controller.deleteCompletedTrip("trip-a" as never)).toMatchObject({
      ok: false,
      error: { code: "history-write-unavailable" },
    });
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe("{corrupted later");
    expect(controller.getSnapshot()).toMatchObject({
      historyIntegrity: { status: "degraded", issue: { code: "malformed-json" } },
      completedTrips: [],
    });
  });

  it("shows exactly the trips a set-aside keeps when history breaks mid-session", () => {
    const storage = memoryStorage({
      [HISTORY_STORAGE_KEY]: historyRaw([completedTrip("trip-a"), completedTrip("trip-b")]),
    });
    const controller = boot(storage);
    controller.startTrip({ budgetMinor: money(1_000) });
    storage.values.set(HISTORY_STORAGE_KEY, "{corrupted later");

    expect(controller.completeTrip()).toMatchObject({
      ok: false,
      error: { code: "history-unreadable" },
    });
    expect(controller.getSnapshot().completedTrips).toHaveLength(0);

    const repaired = controller.setAsideDamagedHistory();

    expect(repaired.ok).toBe(true);
    expect(controller.getSnapshot().completedTrips).toHaveLength(0);
    expect(backups(storage)[0]?.raw).toBe("{corrupted later");
    expect(controller.completeTrip().ok).toBe(true);
  });

  it("can always leave the summary when history breaks after finishing", () => {
    const storage = memoryStorage({});
    const controller = boot(storage);
    const flow = shopAndFinish(controller);

    expect(flow.finished.ok).toBe(true);

    storage.values.set(HISTORY_STORAGE_KEY, "{corrupted later");
    const checkout = controller.setActualCheckout(money(500));

    expect(checkout).toMatchObject({ ok: true, durability: "memory-only" });
    expect(controller.getSnapshot()).toMatchObject({
      persistence: { status: "healthy" },
      historyIntegrity: { status: "degraded", issue: { code: "malformed-json" } },
      completedSummary: { actualCheckoutMinor: 500 },
    });
    expect(storage.values.get(HISTORY_STORAGE_KEY)).toBe("{corrupted later");
    expect(controller.dismissCompletedSummary().ok).toBe(true);
    expect(controller.setAsideDamagedHistory().ok).toBe(true);
  });

  it("reconciles a stale open copy once history can be read again", () => {
    const { values, storage, control } = flakyHistoryStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: activeRaw(),
      [HISTORY_STORAGE_KEY]: historyRaw([completedTrip("trip-active")]),
    });
    const controller = boot(storage);

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "active",
      historyIntegrity: { status: "degraded", issue: { code: "read-failed" } },
    });

    control.failHistoryRead = false;
    controller.retryHistoryRead();

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      activeTrip: null,
      historyIntegrity: { status: "healthy" },
      completionCleanupPending: false,
    });
    expect(values.has(ACTIVE_TRIP_STORAGE_KEY)).toBe(false);
  });

  it("keeps session-only reads from clearing the loaded history view", () => {
    const controller = boot(null);
    controller.continueWithoutSaving();
    const before = controller.getSnapshot();

    expect(controller.retryHistoryRead()).toMatchObject({
      ok: true,
      changed: false,
    });
    expect(controller.getSnapshot()).toBe(before);
  });
});
