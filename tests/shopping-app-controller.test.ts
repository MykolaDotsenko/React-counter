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

  it("does not reread storage over a live application state", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });

    controller.bootstrap();
    controller.startTrip({
      budgetMinor: money(5_000),
    });

    persistence.setBootstrapResult({
      ok: true,
      activeTrip: createTrip(1_000, 0),
    });

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const before = controller.getSnapshot();
    const after = controller.bootstrap();

    expect(after).toBe(before);
    expect(after.activeTrip?.budgetMinor).toBe(5_000);
    expect(persistence.bootstrapCalls).toBe(1);
    expect(notifications).toBe(0);
  });

  it("can retry bootstrap from recovery without inventing a new path", () => {
    const persistence = createPersistence({
      ok: false,
      activeTrip: null,
      issue: {
        code: "read-failed",
        storageKey: "budget-cart:active-trip",
      },
      recoveryRequired: true,
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });

    expect(controller.bootstrap().lifecycle).toBe("recovery");

    const restoredTrip = createTrip();
    persistence.setBootstrapResult({
      ok: true,
      activeTrip: restoredTrip,
    });

    const retried = controller.bootstrap();

    expect(retried.lifecycle).toBe("active");
    expect(retried.activeTrip).toBe(restoredTrip);
    expect(retried.persistence).toEqual({ status: "healthy" });
    expect(persistence.bootstrapCalls).toBe(2);
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

describe("ShoppingAppController addManualItem", () => {
  it("creates one canonical confirmed manual item and persists the exact committed trip", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT, LATER),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const result = controller.addManualItem({
      unitPriceMinor: money(129),
      quantity: 3,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected manual item commit");
    }

    expect(result.changed).toBe(true);
    expect(result.durability).toBe("persisted");
    expect(result.state.activeTrip?.items).toHaveLength(1);
    expect(result.state.activeTrip?.items[0]).toMatchObject({
      id: "item-generated",
      unitPriceMinor: 129,
      quantity: 3,
      priceSource: { kind: "manual" },
      priceConfidence: {
        kind: "confirmed",
        confirmedAt: NEXT,
      },
      createdAt: NEXT,
      updatedAt: NEXT,
    });
    expect(persistence.saveCalls).toHaveLength(1);
    expect(persistence.saveCalls[0]?.trip).toBe(result.state.activeTrip);
    expect(persistence.saveCalls[0]?.savedAt).toBe(LATER);
    expect(notifications).toBe(1);
  });

  it("keeps the committed manual item in memory when persistence fails", () => {
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
      clock: createClock(NEXT, LATER),
      ids,
    });
    controller.bootstrap();

    const result = controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected memory-only manual item commit");
    }

    expect(result.changed).toBe(true);
    expect(result.durability).toBe("memory-only");
    expect(result.state.activeTrip?.items).toHaveLength(1);
    expect(result.state.activeTrip?.items[0]).toMatchObject({
      unitPriceMinor: 479,
      quantity: 1,
    });
    expect(result.state.persistence).toEqual({
      status: "degraded",
      issue: writeFailure,
      since: LATER,
    });
    expect(persistence.saveCalls[0]?.trip).toBe(result.state.activeTrip);
  });

  it("rejects an invalid quantity before persistence and publication", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT, LATER),
      ids,
    });
    controller.bootstrap();

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const before = controller.getSnapshot();
    const result = controller.addManualItem({
      unitPriceMinor: money(129),
      quantity: 0,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected invalid quantity rejection");
    }

    expect(result.error).toEqual({
      kind: "domain",
      code: "invalid-quantity",
    });
    expect(controller.getSnapshot()).toBe(before);
    expect(persistence.saveCalls).toHaveLength(0);
    expect(notifications).toBe(0);
  });

  it("rejects manual add outside an active lifecycle without persistence", () => {
    const persistence = createPersistence();
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });

    const beforeBootstrap = controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });

    expect(beforeBootstrap).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "not-ready",
      },
    });
    expect(persistence.saveCalls).toHaveLength(0);

    controller.bootstrap();

    const idleResult = controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });

    expect(idleResult).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "no-active-trip",
      },
    });
    expect(persistence.saveCalls).toHaveLength(0);
  });
});

describe("ShoppingAppController undo", () => {
  it("restores and persists the exact canonical snapshot before the last add", () => {
    const initialTrip = createTrip(5_000, 0);
    const persistence = createPersistence({
      ok: true,
      activeTrip: initialTrip,
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT, LATER, LATER),
      ids,
    });
    controller.bootstrap();

    const added = controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });

    expect(added.ok).toBe(true);

    if (!added.ok) {
      throw new Error("Expected add before undo");
    }

    expect(added.state.undo).toEqual({
      previousTrip: initialTrip,
      description: "add",
    });

    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    const undone = controller.undo();

    expect(undone.ok).toBe(true);

    if (!undone.ok) {
      throw new Error("Expected undo success");
    }

    expect(undone.changed).toBe(true);
    expect(undone.durability).toBe("persisted");
    expect(undone.state.activeTrip).toBe(initialTrip);
    expect(undone.state.activeTrip?.items).toHaveLength(0);
    expect(undone.state.undo).toBeNull();
    expect(persistence.saveCalls).toHaveLength(2);
    expect(persistence.saveCalls[1]?.trip).toBe(initialTrip);
    expect(notifications).toBe(1);
  });

  it("keeps the restored snapshot in memory when undo persistence fails", () => {
    const initialTrip = createTrip(5_000, 0);
    const persistence = createPersistence({
      ok: true,
      activeTrip: initialTrip,
    });
    persistence.queueSaveResult({ ok: true });
    persistence.queueSaveResult({
      ok: false,
      issue: writeFailure,
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT, LATER, LATER),
      ids,
    });
    controller.bootstrap();
    controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });

    const undone = controller.undo();

    expect(undone.ok).toBe(true);

    if (!undone.ok) {
      throw new Error("Expected memory-only undo");
    }

    expect(undone.durability).toBe("memory-only");
    expect(undone.state.activeTrip).toBe(initialTrip);
    expect(undone.state.activeTrip?.items).toHaveLength(0);
    expect(undone.state.undo).toBeNull();
    expect(undone.state.persistence).toEqual({
      status: "degraded",
      issue: writeFailure,
      since: LATER,
    });
  });

  it("is a no-op when no undoable cart mutation exists", () => {
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

    const before = controller.getSnapshot();
    const result = controller.undo();

    expect(result).toEqual({
      ok: true,
      changed: false,
      durability: "unchanged",
      state: before,
    });
    expect(persistence.saveCalls).toHaveLength(0);
  });

  it("clears stale cart undo when a later non-cart canonical mutation occurs", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(NEXT, LATER, LATER),
      ids,
    });
    controller.bootstrap();

    controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });
    expect(controller.getSnapshot().undo?.description).toBe("add");

    controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(200),
    });

    expect(controller.getSnapshot().undo).toBeNull();
    const beforeUndo = controller.getSnapshot();
    expect(controller.undo()).toEqual({
      ok: true,
      changed: false,
      durability: "unchanged",
      state: beforeUndo,
    });
  });
});

describe("ShoppingAppController retryPersistence", () => {
  it("retries the exact canonical active trip and heals degraded persistence", () => {
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

    const degraded = controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(500),
    });

    expect(degraded.ok).toBe(true);
    expect(controller.getSnapshot().persistence.status).toBe("degraded");

    const canonicalBeforeRetry = controller.getSnapshot().activeTrip;
    const retried = controller.retryPersistence();

    expect(retried.ok).toBe(true);

    if (!retried.ok) {
      throw new Error("Expected retry success");
    }

    expect(retried.changed).toBe(true);
    expect(retried.durability).toBe("persisted");
    expect(retried.state.persistence).toEqual({ status: "healthy" });
    expect(retried.state.activeTrip).toBe(canonicalBeforeRetry);
    expect(persistence.saveCalls).toHaveLength(2);
    expect(persistence.saveCalls[1]?.trip).toBe(canonicalBeforeRetry);
    expect(persistence.saveCalls[1]?.savedAt).toBe(LATER);
  });

  it("keeps degraded state and original since timestamp when retry fails", () => {
    const secondFailure: PersistenceProblem = {
      code: "quota-exceeded",
      storageKey: "budget-cart:active-trip",
    };
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(5_000, 0),
    });
    persistence.queueSaveResult({
      ok: false,
      issue: writeFailure,
    });
    persistence.queueSaveResult({
      ok: false,
      issue: secondFailure,
    });

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

    const retried = controller.retryPersistence();

    expect(retried.ok).toBe(true);

    if (!retried.ok) {
      throw new Error("Expected retry attempt result");
    }

    expect(retried.changed).toBe(true);
    expect(retried.durability).toBe("memory-only");
    expect(retried.state.persistence).toEqual({
      status: "degraded",
      issue: secondFailure,
      since: NEXT,
    });
  });

  it("is a no-op when persistence is already healthy", () => {
    const persistence = createPersistence({
      ok: true,
      activeTrip: createTrip(),
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    const before = controller.getSnapshot();
    const retried = controller.retryPersistence();

    expect(retried).toEqual({
      ok: true,
      changed: false,
      durability: "unchanged",
      state: before,
    });
    expect(persistence.saveCalls).toHaveLength(0);
  });

  it("does not use retryPersistence to overwrite recovery data", () => {
    const persistence = createPersistence({
      ok: false,
      activeTrip: null,
      issue: {
        code: "unsupported-version",
        storageKey: "budget-cart:active-trip",
        schemaVersion: 99,
      },
      recoveryRequired: true,
      recoveryRaw: '{"schemaVersion":99}',
    });
    const controller = createShoppingAppController({
      persistence,
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    const result = controller.retryPersistence();

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
