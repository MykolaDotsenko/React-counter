import { describe, expect, it } from "vitest";

import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createActiveTrip,
  isoTimestamp,
  type ActiveTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import {
  createShoppingAppController,
  type ActiveTripBootstrapResult,
  type ActiveTripPersistencePort,
  type ActiveTripSaveResult,
  type Clock,
  type IdGenerator,
  type PersistenceProblem,
} from "../src/application/shopping-app-controller";

const START = "2026-09-21T09:00:00.000Z";
const NEXT = "2026-09-21T09:05:00.000Z";
const LATER = "2026-09-21T09:10:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => unwrap(isoTimestamp(value));

const createTrip = (
  budgetMinor = 5_000,
  safetyBufferMinor = 200,
): ActiveTrip =>
  unwrap(
    createActiveTrip({
      id: "restored-trip",
      budgetMinor: money(budgetMinor),
      safetyBufferMinor: money(safetyBufferMinor),
      startedAt: START,
    }),
  );

interface PersistenceFake extends ActiveTripPersistencePort {
  readonly bootstrapCalls: number;
  readonly saveCalls: readonly {
    trip: ActiveTrip;
    savedAt: IsoTimestamp;
  }[];
  setBootstrapResult(result: ActiveTripBootstrapResult): void;
  queueSaveResult(result: ActiveTripSaveResult): void;
}

const createPersistence = (
  initialBootstrap: ActiveTripBootstrapResult = {
    ok: true,
    activeTrip: null,
  },
): PersistenceFake => {
  let bootstrapResult = initialBootstrap;
  let bootstrapCalls = 0;
  const saveCalls: Array<{
    trip: ActiveTrip;
    savedAt: IsoTimestamp;
  }> = [];
  const saveResults: ActiveTripSaveResult[] = [];

  return {
    get bootstrapCalls() {
      return bootstrapCalls;
    },
    get saveCalls() {
      return saveCalls;
    },
    setBootstrapResult(result) {
      bootstrapResult = result;
    },
    queueSaveResult(result) {
      saveResults.push(result);
    },
    bootstrap() {
      bootstrapCalls += 1;
      return bootstrapResult;
    },
    save(trip, savedAt) {
      saveCalls.push({ trip, savedAt });

      return (
        saveResults.shift() ?? {
          ok: true,
        }
      );
    },
  };
};

const createClock = (...timestamps: string[]): Clock => {
  const values = timestamps.map(time);
  let index = 0;

  return {
    now() {
      const value = values[Math.min(index, values.length - 1)];

      if (value === undefined) {
        throw new Error("Clock has no configured timestamp");
      }

      index += 1;
      return value;
    },
  };
};

const ids: IdGenerator = {
  tripId: () => "trip-generated",
  itemId: () => "item-generated",
};

const writeFailure: PersistenceProblem = {
  code: "write-failed",
  storageKey: "budget-cart:active-trip",
};

describe("ShoppingAppController snapshot contract", () => {
  it("returns one cached immutable booting snapshot until state changes", () => {
    const controller = createShoppingAppController({
      persistence: createPersistence(),
      clock: createClock(START),
      ids,
    });

    const first = controller.getSnapshot();
    const second = controller.getSnapshot();

    expect(first).toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toEqual({
      lifecycle: "booting",
      activeTrip: null,
      completedTrips: [],
      persistence: { status: "healthy" },
      undo: null,
      recovery: null,
    });
  });

  it("publishes exactly once when bootstrap resolves to idle", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const before = controller.getSnapshot();
    const after = controller.bootstrap();

    expect(persistence.bootstrapCalls).toBe(1);
    expect(notifications).toBe(1);
    expect(after).not.toBe(before);
    expect(after.lifecycle).toBe("idle");
    expect(after.persistence).toEqual({ status: "healthy" });
    expect(controller.getSnapshot()).toBe(after);
  });

  it("unsubscribe stops later notifications", () => {
    const controller = createShoppingAppController({
      persistence: createPersistence(),
      clock: createClock(START),
      ids,
    });

    let notifications = 0;
    const unsubscribe = controller.subscribe(() => {
      notifications += 1;
    });

    controller.bootstrap();
    unsubscribe();

    controller.startTrip({
      budgetMinor: money(5_000),
    });

    expect(notifications).toBe(1);
  });
});

describe("ShoppingAppController bootstrap", () => {
  it("restores the exact active trip without reconstructing UI state", () => {
    const restoredTrip = createTrip();
    const controller = createShoppingAppController({
      persistence: createPersistence({
        ok: true,
        activeTrip: restoredTrip,
      }),
      clock: createClock(START),
      ids,
    });

    const state = controller.bootstrap();

    expect(state.lifecycle).toBe("active");
    expect(state.activeTrip).toBe(restoredTrip);
    expect(state.persistence).toEqual({ status: "healthy" });
    expect(state.recovery).toBeNull();
  });

  it("maps corrupt/future storage into recovery without inventing a trip", () => {
    const issue: PersistenceProblem = {
      code: "unsupported-version",
      storageKey: "budget-cart:active-trip",
      schemaVersion: 99,
    };
    const controller = createShoppingAppController({
      persistence: createPersistence({
        ok: false,
        activeTrip: null,
        issue,
        recoveryRequired: true,
        recoveryRaw: '{"schemaVersion":99}',
      }),
      clock: createClock(START),
      ids,
    });

    const state = controller.bootstrap();

    expect(state.lifecycle).toBe("recovery");
    expect(state.activeTrip).toBeNull();
    expect(state.persistence).toEqual({
      status: "degraded",
      issue,
      since: START,
    });
    expect(state.recovery).toEqual({
      issue,
      raw: '{"schemaVersion":99}',
    });
  });

  it("can remain active but degraded when bootstrap cleanup alone failed", () => {
    const restoredTrip = createTrip();
    const issue: PersistenceProblem = {
      code: "legacy-retirement-failed",
      storageKey: "counter",
    };
    const controller = createShoppingAppController({
      persistence: createPersistence({
        ok: false,
        activeTrip: restoredTrip,
        issue,
        recoveryRequired: false,
      }),
      clock: createClock(START),
      ids,
    });

    const state = controller.bootstrap();

    expect(state.lifecycle).toBe("active");
    expect(state.activeTrip).toBe(restoredTrip);
    expect(state.persistence).toEqual({
      status: "degraded",
      issue,
      since: START,
    });
    expect(state.recovery).toBeNull();
  });

  it("can remain idle but degraded when non-recovery bootstrap work failed", () => {
    const issue: PersistenceProblem = {
      code: "legacy-retirement-failed",
      storageKey: "counter",
    };
    const controller = createShoppingAppController({
      persistence: createPersistence({
        ok: false,
        activeTrip: null,
        issue,
        recoveryRequired: false,
      }),
      clock: createClock(START),
      ids,
    });

    const state = controller.bootstrap();

    expect(state.lifecycle).toBe("idle");
    expect(state.activeTrip).toBeNull();
    expect(state.persistence.status).toBe("degraded");
  });
});

describe("ShoppingAppController startTrip", () => {
  it("rejects start before bootstrap without notify or persistence", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const result = controller.startTrip({
      budgetMinor: money(5_000),
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "application",
        code: "not-ready",
      },
      state: controller.getSnapshot(),
    });
    expect(persistence.saveCalls).toHaveLength(0);
    expect(notifications).toBe(0);
  });

  it("creates, persists, and publishes one canonical active trip", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const result = controller.startTrip({
      budgetMinor: money(5_000),
      safetyBufferMinor: money(200),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected startTrip success");
    }

    expect(result.changed).toBe(true);
    expect(result.durability).toBe("persisted");
    expect(result.state.lifecycle).toBe("active");
    expect(result.state.activeTrip).toMatchObject({
      id: "trip-generated",
      budgetMinor: 5_000,
      safetyBufferMinor: 200,
      startedAt: START,
    });
    expect(result.state.persistence).toEqual({ status: "healthy" });
    expect(persistence.saveCalls).toHaveLength(1);
    expect(persistence.saveCalls[0]?.trip).toBe(result.state.activeTrip);
    expect(persistence.saveCalls[0]?.savedAt).toBe(START);
    expect(notifications).toBe(1);
  });

  it("keeps the valid in-memory trip and marks degraded when save fails", () => {
    const persistence = createPersistence();
    persistence.queueSaveResult({
      ok: false,
      issue: writeFailure,
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    const result = controller.startTrip({
      budgetMinor: money(5_000),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected memory-only start");
    }

    expect(result.durability).toBe("memory-only");
    expect(result.state.lifecycle).toBe("active");
    expect(result.state.activeTrip?.budgetMinor).toBe(5_000);
    expect(result.state.persistence).toEqual({
      status: "degraded",
      issue: writeFailure,
      since: START,
    });
  });

  it("rejects invalid budget without persistence or notification", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const result = controller.startTrip({
      budgetMinor: money(0),
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected invalid budget failure");
    }

    expect(result.error).toEqual({
      kind: "domain",
      code: "invalid-budget",
    });
    expect(controller.getSnapshot().lifecycle).toBe("idle");
    expect(persistence.saveCalls).toHaveLength(0);
    expect(notifications).toBe(0);
  });

  it("rejects a second start while a trip is active", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START, NEXT),
      ids,
    });
    controller.bootstrap();
    controller.startTrip({ budgetMinor: money(5_000) });

    const result = controller.startTrip({
      budgetMinor: money(7_500),
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "active-trip-exists",
      },
    });
    expect(persistence.saveCalls).toHaveLength(1);
  });

  it("rejects start while recovery is unresolved", () => {
    const persistence = createPersistence({
      ok: false,
      activeTrip: null,
      issue: {
        code: "malformed-json",
        storageKey: "budget-cart:active-trip",
      },
      recoveryRequired: true,
      recoveryRaw: "{broken",
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    const result = controller.startTrip({
      budgetMinor: money(5_000),
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "recovery-required",
      },
    });
    expect(persistence.saveCalls).toHaveLength(0);
  });
});

describe("ShoppingAppController dispatch", () => {
  it("persists and publishes a successful active-trip command once", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const result = controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(500),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected dispatch success");
    }

    expect(result.changed).toBe(true);
    expect(result.durability).toBe("persisted");
    expect(result.state.activeTrip?.safetyBufferMinor).toBe(500);
    expect(persistence.saveCalls).toHaveLength(1);
    expect(persistence.saveCalls[0]?.savedAt).toBe(NEXT);
    expect(notifications).toBe(1);
  });

  it("does not persist or notify for a domain no-op", () => {
    const trip = createTrip(5_000, 200);
    const persistence = createPersistence({
      ok: true,
      activeTrip: trip,
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const before = controller.getSnapshot();
    const result = controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(200),
    });

    expect(result).toEqual({
      ok: true,
      changed: false,
      durability: "unchanged",
      state: before,
    });
    expect(controller.getSnapshot()).toBe(before);
    expect(persistence.saveCalls).toHaveLength(0);
    expect(notifications).toBe(0);
  });

  it("does not persist or notify for a rejected domain command", () => {
    const trip = createTrip(5_000, 200);
    const persistence = createPersistence({
      ok: true,
      activeTrip: trip,
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const before = controller.getSnapshot();
    const result = controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(5_001),
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected invalid buffer failure");
    }

    expect(result.error).toEqual({
      kind: "domain",
      code: "invalid-buffer",
    });
    expect(controller.getSnapshot()).toBe(before);
    expect(persistence.saveCalls).toHaveLength(0);
    expect(notifications).toBe(0);
  });

  it("publishes the committed trip as memory-only when persistence fails", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    persistence.queueSaveResult({
      ok: false,
      issue: writeFailure,
    });

    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT),
      ids,
    });
    controller.bootstrap();

    const result = controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(500),
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected memory-only dispatch");
    }

    expect(result.durability).toBe("memory-only");
    expect(result.state.activeTrip?.safetyBufferMinor).toBe(500);
    expect(result.state.persistence).toEqual({
      status: "degraded",
      issue: writeFailure,
      since: NEXT,
    });
  });

  it("returns to healthy after a later successful canonical write", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    persistence.queueSaveResult({
      ok: false,
      issue: writeFailure,
    });
    persistence.queueSaveResult({ ok: true });

    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT, LATER),
      ids,
    });
    controller.bootstrap();

    controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(500),
    });

    const healed = controller.dispatch({
      type: "set-budget",
      budgetMinor: money(6_000),
    });

    expect(healed.ok).toBe(true);

    if (!healed.ok) {
      throw new Error("Expected healed dispatch");
    }

    expect(healed.durability).toBe("persisted");
    expect(healed.state.activeTrip).toMatchObject({
      budgetMinor: 6_000,
      safetyBufferMinor: 500,
    });
    expect(healed.state.persistence).toEqual({
      status: "healthy",
    });
    expect(persistence.saveCalls).toHaveLength(2);
    expect(persistence.saveCalls[1]?.savedAt).toBe(LATER);
  });

  it("rejects dispatch when no active trip exists", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    const result = controller.dispatch({
      type: "set-budget",
      budgetMinor: money(6_000),
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "no-active-trip",
      },
    });
    expect(persistence.saveCalls).toHaveLength(0);
  });
});
