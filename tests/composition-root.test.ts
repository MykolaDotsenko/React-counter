import { describe, expect, it } from "vitest";

import {
  bootstrapBrowserShoppingAppController,
  createBrowserShoppingAppController,
} from "../src/app/composition-root";
import type {
  Clock,
  IdGenerator,
} from "../src/application/shopping-app-controller";
import {
  mvpMinorUnits,
  type Result,
} from "../src/domain/money";
import {
  createActiveTrip,
  isoTimestamp,
  type ActiveTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import {
  encodeActiveTripSnapshot,
  type StorageLike,
} from "../src/infrastructure/storage/shopping-storage";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  LEGACY_PULSE_STORAGE_KEYS,
} from "../src/infrastructure/storage/shopping-storage-schema";

const START = "2026-09-21T09:00:00.000Z";
const NEXT = "2026-09-21T09:05:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => unwrap(isoTimestamp(value));

const clockAt = (value: string): Clock => ({
  now: () => time(value),
});

const ids: IdGenerator = {
  tripId: () => "trip-composed",
  itemId: () => "item-composed",
};

const createTrip = (): ActiveTrip =>
  unwrap(
    createActiveTrip({
      id: "trip-restored",
      budgetMinor: money(5_000),
      safetyBufferMinor: money(200),
      startedAt: START,
    }),
  );

interface MemoryStorageOptions {
  readonly failSet?: boolean;
  readonly failRemoveKeys?: readonly string[];
}

const createStorage = (
  entries: Record<string, string> = {},
  options: MemoryStorageOptions = {},
): StorageLike & {
  readonly values: Map<string, string>;
  readonly removals: string[];
} => {
  const values = new Map(Object.entries(entries));
  const removals: string[] = [];
  const failedRemoveKeys = new Set(options.failRemoveKeys ?? []);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.failSet) {
        throw new Error("write blocked");
      }

      values.set(key, value);
    },
    removeItem(key) {
      removals.push(key);

      if (failedRemoveKeys.has(key)) {
        throw new Error("remove blocked");
      }

      values.delete(key);
    },
    values,
    removals,
  };
};

describe("shopping composition root", () => {
  it("creates a booting controller before explicit bootstrap", () => {
    const controller = createBrowserShoppingAppController({
      storage: createStorage(),
      clock: clockAt(START),
      ids,
    });

    expect(controller.getSnapshot().lifecycle).toBe("booting");
  });

  it("bootstraps an empty store directly to healthy idle", () => {
    const storage = createStorage();

    const controller = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      activeTrip: null,
      persistence: {
        status: "healthy",
      },
      recovery: null,
    });
    expect(storage.removals).toEqual([
      ...LEGACY_PULSE_STORAGE_KEYS,
    ]);
  });

  it("writes through Phase 3 storage and restores the exact trip in a new controller", () => {
    const storage = createStorage();
    const first = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    const started = first.startTrip({
      budgetMinor: money(5_000),
      safetyBufferMinor: money(200),
    });

    expect(started.ok).toBe(true);
    expect(storage.values.has(ACTIVE_TRIP_STORAGE_KEY)).toBe(true);

    const second = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(NEXT),
      ids,
    });

    const restored = second.getSnapshot();

    expect(restored.lifecycle).toBe("active");
    expect(restored.persistence).toEqual({ status: "healthy" });
    expect(restored.activeTrip).toEqual(
      started.ok ? started.state.activeTrip : null,
    );
  });

  it("retires legacy Pulse values without interpreting them as a budget", () => {
    const storage = createStorage({
      [LEGACY_PULSE_STORAGE_KEYS[0]]: JSON.stringify({
        version: 1,
        value: 5_000,
        step: 25,
      }),
      [LEGACY_PULSE_STORAGE_KEYS[1]]: "5000",
    });

    const controller = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    expect(controller.getSnapshot().lifecycle).toBe("idle");
    expect(controller.getSnapshot().activeTrip).toBeNull();
    expect(storage.values.has(ACTIVE_TRIP_STORAGE_KEY)).toBe(false);
    expect(storage.values.has(LEGACY_PULSE_STORAGE_KEYS[0])).toBe(false);
    expect(storage.values.has(LEGACY_PULSE_STORAGE_KEYS[1])).toBe(false);
  });

  it("preserves malformed shopping data and enters recovery", () => {
    const raw = "{broken-json";
    const storage = createStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: raw,
      [LEGACY_PULSE_STORAGE_KEYS[0]]: "legacy-preserved",
    });

    const controller = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    const state = controller.getSnapshot();

    expect(state.lifecycle).toBe("recovery");
    expect(state.activeTrip).toBeNull();
    expect(state.persistence).toMatchObject({
      status: "degraded",
      issue: {
        code: "malformed-json",
        storageKey: ACTIVE_TRIP_STORAGE_KEY,
      },
      since: START,
    });
    expect(state.recovery).toEqual({
      issue: {
        code: "malformed-json",
        storageKey: ACTIVE_TRIP_STORAGE_KEY,
      },
      raw,
    });
    expect(storage.values.get(ACTIVE_TRIP_STORAGE_KEY)).toBe(raw);
    expect(storage.values.get(LEGACY_PULSE_STORAGE_KEYS[0])).toBe(
      "legacy-preserved",
    );
  });

  it("preserves a future-version snapshot as unsupported recovery data", () => {
    const raw = JSON.stringify({
      schemaVersion: 99,
      savedAt: NEXT,
      data: {
        id: "future-trip",
      },
    });
    const storage = createStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: raw,
    });

    const controller = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    const state = controller.getSnapshot();

    expect(state.lifecycle).toBe("recovery");
    expect(state.activeTrip).toBeNull();
    expect(state.persistence).toMatchObject({
      status: "degraded",
      issue: {
        code: "unsupported-version",
        storageKey: ACTIVE_TRIP_STORAGE_KEY,
        schemaVersion: 99,
      },
    });
    expect(state.recovery?.raw).toBe(raw);
    expect(storage.values.get(ACTIVE_TRIP_STORAGE_KEY)).toBe(raw);
  });

  it("maps unavailable storage to recovery instead of pretending the store is empty", () => {
    const controller = bootstrapBrowserShoppingAppController({
      storage: null,
      clock: clockAt(START),
      ids,
    });

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "recovery",
      activeTrip: null,
      persistence: {
        status: "degraded",
        issue: {
          code: "storage-unavailable",
        },
      },
    });
  });

  it("keeps a started trip in memory when browser storage write fails", () => {
    const storage = createStorage({}, { failSet: true });
    const controller = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    const started = controller.startTrip({
      budgetMinor: money(5_000),
    });

    expect(started.ok).toBe(true);

    if (!started.ok) {
      throw new Error("Expected memory-only start");
    }

    expect(started.durability).toBe("memory-only");
    expect(started.state.lifecycle).toBe("active");
    expect(started.state.activeTrip?.budgetMinor).toBe(5_000);
    expect(started.state.persistence).toMatchObject({
      status: "degraded",
      issue: {
        code: "write-failed",
        storageKey: ACTIVE_TRIP_STORAGE_KEY,
      },
    });
  });

  it("keeps legacy-retirement failure as degraded idle, not recovery", () => {
    const failedKey = LEGACY_PULSE_STORAGE_KEYS[0];
    const storage = createStorage(
      {
        [failedKey]: "legacy",
      },
      {
        failRemoveKeys: [failedKey],
      },
    );

    const controller = bootstrapBrowserShoppingAppController({
      storage,
      clock: clockAt(START),
      ids,
    });

    const state = controller.getSnapshot();

    expect(state.lifecycle).toBe("idle");
    expect(state.activeTrip).toBeNull();
    expect(state.recovery).toBeNull();
    expect(state.persistence).toMatchObject({
      status: "degraded",
      issue: {
        code: "legacy-retirement-failed",
        storageKey: failedKey,
      },
    });
  });

  it("uses real window.localStorage when no storage override is supplied", () => {
    const trip = createTrip();
    const encoded = encodeActiveTripSnapshot(trip, NEXT);

    if (!encoded.ok) {
      throw new Error("Expected encoded active trip");
    }

    window.localStorage.setItem(
      ACTIVE_TRIP_STORAGE_KEY,
      encoded.raw,
    );

    const controller = bootstrapBrowserShoppingAppController({
      clock: clockAt(START),
      ids,
    });

    expect(controller.getSnapshot().lifecycle).toBe("active");
    expect(controller.getSnapshot().activeTrip).toEqual(trip);
  });
});
