import { describe, expect, it } from "vitest";

import type {
  PriceMemoryBootstrapResult,
  PriceMemoryPersistencePort,
  PriceMemorySaveResult,
} from "../src/application/price-memory-port";
import {
  createShoppingAppController,
  type ActiveTripBootstrapResult,
  type ActiveTripPersistencePort,
  type ActiveTripSaveResult,
  type Clock,
  type CompletionSaveResult,
  type IdGenerator,
} from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createPriceMemoryRecord,
  type PriceMemoryRecord,
} from "../src/domain/price-memory";
import {
  createActiveTrip,
  isoTimestamp,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";

const START = "2026-09-22T07:00:00.000Z";
const ADD = "2026-09-22T07:05:00.000Z";
const SAVE = "2026-09-22T07:06:00.000Z";
const COMPLETE = "2026-09-22T07:20:00.000Z";
const MEMORY_SAVE = "2026-09-22T07:21:00.000Z";
const EDIT = "2026-09-22T07:10:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful Result");
  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => unwrap(isoTimestamp(value));

const emptyTrip = (): ActiveTrip =>
  unwrap(
    createActiveTrip({
      id: "active-trip",
      budgetMinor: money(5_000),
      startedAt: START,
    }),
  );

const rememberedMilk = (): PriceMemoryRecord =>
  unwrap(
    createPriceMemoryRecord({
      label: "Milk 1L",
      unitPriceMinor: money(139),
      observedAt: "2026-09-20T08:00:00.000Z",
      source: { kind: "manual" },
    }),
  );

interface CorePersistenceFake extends ActiveTripPersistencePort {
  readonly saveCalls: readonly ActiveTrip[];
  readonly completeCalls: readonly CompletedTrip[];
  queueComplete(result: CompletionSaveResult): void;
}

const createCorePersistence = (
  bootstrapResult: ActiveTripBootstrapResult = {
    ok: true,
    activeTrip: emptyTrip(),
    completedTrips: [],
    completionCleanupPending: false,
  },
): CorePersistenceFake => {
  const saveCalls: ActiveTrip[] = [];
  const completeCalls: CompletedTrip[] = [];
  const completionResults: CompletionSaveResult[] = [];

  return {
    get saveCalls() {
      return saveCalls;
    },
    get completeCalls() {
      return completeCalls;
    },
    queueComplete(result) {
      completionResults.push(result);
    },
    bootstrap() {
      return bootstrapResult;
    },
    save(trip) {
      saveCalls.push(trip);
      return { ok: true };
    },
    complete(trip) {
      completeCalls.push(trip);
      return completionResults.shift() ?? { ok: true };
    },
    saveCompleted(): ActiveTripSaveResult {
      return { ok: true };
    },
    replaceCompletedHistory(): ActiveTripSaveResult {
      return { ok: true };
    },
    clearCompletedActive(): ActiveTripSaveResult {
      return { ok: true };
    },
    readCompletedHistory() {
      return { ok: true, completedTrips: [] };
    },
    setAsideDamagedHistory() {
      return { ok: true, completedTrips: [] };
    },
    setAsideUnreadableActiveTrip() {
      return { ok: true };
    },
  };
};

interface MemoryPersistenceFake extends PriceMemoryPersistencePort {
  readonly saveCalls: readonly {
    records: readonly PriceMemoryRecord[];
    savedAt: IsoTimestamp;
  }[];
  queueSave(result: PriceMemorySaveResult): void;
}

const createMemoryPersistence = (
  bootstrapResult: PriceMemoryBootstrapResult = {
    ok: true,
    records: [],
  },
): MemoryPersistenceFake => {
  const saveCalls: Array<{
    records: readonly PriceMemoryRecord[];
    savedAt: IsoTimestamp;
  }> = [];
  const saveResults: PriceMemorySaveResult[] = [];

  return {
    get saveCalls() {
      return saveCalls;
    },
    queueSave(result) {
      saveResults.push(result);
    },
    bootstrap() {
      return bootstrapResult;
    },
    save(records, savedAt) {
      saveCalls.push({ records, savedAt });
      return saveResults.shift() ?? { ok: true };
    },
  };
};

const ids: IdGenerator = {
  tripId: () => "new-trip",
  itemId: () => "new-item",
};

const createClock = (...values: string[]): Clock => {
  const timestamps = values.map(time);
  let index = 0;

  return {
    now() {
      const value =
        timestamps[Math.min(index, timestamps.length - 1)];

      if (value === undefined) {
        throw new Error("Clock has no configured timestamp");
      }

      index += 1;
      return value;
    },
  };
};

describe("ShoppingAppController price memory", () => {
  it("keeps advisory memory failure separate from core shopping recovery", () => {
    const memory = createMemoryPersistence({
      ok: false,
      records: [],
      issue: {
        code: "unsupported-version",
        storageKey: "budget-cart:price-memory",
        schemaVersion: 99,
      },
    });
    const controller = createShoppingAppController({
      persistence: createCorePersistence(),
      priceMemoryPersistence: memory,
      clock: createClock(START),
      ids,
    });

    const state = controller.bootstrap();

    expect(state.lifecycle).toBe("active");
    expect(state.persistence).toEqual({ status: "healthy" });
    expect(state.priceMemoryPersistence).toEqual({
      status: "degraded",
      issue: {
        code: "unsupported-version",
        storageKey: "budget-cart:price-memory",
        schemaVersion: 99,
      },
      since: START,
    });
  });

  it("does not create memory before a named item is durably completed", () => {
    const core = createCorePersistence();
    const memory = createMemoryPersistence();
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE),
      ids,
    });
    controller.bootstrap();

    const added = controller.addManualItem({
      unitPriceMinor: money(139),
      quantity: 1,
      label: "Milk 1L",
    });

    expect(added.ok).toBe(true);
    expect(added.state.priceMemories).toEqual([]);
    expect(memory.saveCalls).toHaveLength(0);
  });

  it("creates one advisory memory only after completed history is durable", () => {
    const core = createCorePersistence();
    const memory = createMemoryPersistence();
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE, COMPLETE, MEMORY_SAVE),
      ids,
    });
    controller.bootstrap();
    controller.addManualItem({
      unitPriceMinor: money(139),
      quantity: 1,
      label: "Milk 1L",
    });

    const completed = controller.completeTrip();

    expect(completed.ok).toBe(true);
    expect(core.completeCalls).toHaveLength(1);
    expect(memory.saveCalls).toHaveLength(1);
    expect(memory.saveCalls[0]?.savedAt).toBe(MEMORY_SAVE);
    expect(completed.state.priceMemories).toHaveLength(1);
    expect(completed.state.priceMemories[0]).toMatchObject({
      label: "Milk 1L",
      unitPriceMinor: 139,
      observedAt: ADD,
      source: { kind: "manual" },
    });
    expect(completed.state.persistence).toEqual({ status: "healthy" });
    expect(completed.state.priceMemoryPersistence).toEqual({
      status: "healthy",
    });
  });

  it("never writes memory when completed history itself was not saved", () => {
    const core = createCorePersistence();
    core.queueComplete({
      ok: false,
      stage: "history-write",
      issue: {
        code: "write-failed",
        storageKey: "budget-cart:history",
      },
      historyPersisted: false,
    });
    const memory = createMemoryPersistence();
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE, COMPLETE),
      ids,
    });
    controller.bootstrap();
    controller.addManualItem({
      unitPriceMinor: money(139),
      quantity: 1,
      label: "Milk 1L",
    });

    const completed = controller.completeTrip();

    expect(completed.ok).toBe(false);
    expect(memory.saveCalls).toHaveLength(0);
    expect(controller.getSnapshot().priceMemories).toEqual([]);
  });

  it("keeps the completed trip healthy when advisory memory write fails", () => {
    const core = createCorePersistence();
    const memory = createMemoryPersistence();
    memory.queueSave({
      ok: false,
      issue: {
        code: "write-failed",
        storageKey: "budget-cart:price-memory",
      },
    });
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE, COMPLETE, MEMORY_SAVE),
      ids,
    });
    controller.bootstrap();
    controller.addManualItem({
      unitPriceMinor: money(139),
      quantity: 1,
      label: "Milk 1L",
    });

    const completed = controller.completeTrip();

    expect(completed.ok).toBe(true);
    expect(completed.state.lifecycle).toBe("completed-summary");
    expect(completed.state.persistence).toEqual({ status: "healthy" });
    expect(completed.state.priceMemories).toHaveLength(1);
    expect(completed.state.priceMemoryPersistence).toEqual({
      status: "degraded",
      issue: {
        code: "write-failed",
        storageKey: "budget-cart:price-memory",
      },
      since: MEMORY_SAVE,
    });
  });

  it("adds a remembered price without silently promoting it to current", () => {
    const remembered = rememberedMilk();
    const core = createCorePersistence();
    const memory = createMemoryPersistence({
      ok: true,
      records: [remembered],
    });
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE),
      ids,
    });
    controller.bootstrap();

    const added = controller.addRememberedItem({
      memoryId: remembered.id,
    });

    expect(added.ok).toBe(true);
    expect(added.state.activeTrip?.items[0]).toMatchObject({
      label: "Milk 1L",
      unitPriceMinor: 139,
      priceSource: {
        kind: "price-memory",
        memoryId: remembered.id,
      },
      priceConfidence: {
        kind: "remembered",
        observedAt: remembered.observedAt,
      },
    });
    expect(memory.saveCalls).toHaveLength(0);
  });

  it("does not refresh a remembered observation merely because the trip finishes", () => {
    const remembered = rememberedMilk();
    const core = createCorePersistence();
    const memory = createMemoryPersistence({
      ok: true,
      records: [remembered],
    });
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE, COMPLETE),
      ids,
    });
    controller.bootstrap();
    controller.addRememberedItem({
      memoryId: remembered.id,
    });

    const completed = controller.completeTrip();

    expect(completed.ok).toBe(true);
    expect(completed.state.priceMemories).toEqual([remembered]);
    expect(memory.saveCalls).toHaveLength(0);
  });

  it("a manual current-price correction becomes the next confirmed memory after completion", () => {
    const remembered = rememberedMilk();
    const core = createCorePersistence();
    const memory = createMemoryPersistence({
      ok: true,
      records: [remembered],
    });
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(ADD, SAVE, EDIT, EDIT, COMPLETE, MEMORY_SAVE),
      ids,
    });
    controller.bootstrap();
    controller.addRememberedItem({
      memoryId: remembered.id,
    });

    const item = controller.getSnapshot().activeTrip?.items[0];

    if (item === undefined) {
      throw new Error("Expected remembered item");
    }

    const corrected = controller.updateManualItem({
      itemId: item.id,
      unitPriceMinor: money(149),
      quantity: 1,
      label: "Milk 1L",
    });

    expect(corrected.ok).toBe(true);
    expect(corrected.state.activeTrip?.items[0]).toMatchObject({
      unitPriceMinor: 149,
      priceSource: { kind: "manual" },
      priceConfidence: {
        kind: "confirmed",
        confirmedAt: EDIT,
      },
    });

    const completed = controller.completeTrip();

    expect(completed.ok).toBe(true);
    expect(completed.state.priceMemories).toHaveLength(1);
    expect(completed.state.priceMemories[0]).toMatchObject({
      label: "Milk 1L",
      unitPriceMinor: 149,
      observedAt: EDIT,
    });
    expect(memory.saveCalls).toHaveLength(1);
  });

  it("clears remembered prices through their independent persistence boundary", () => {
    const remembered = rememberedMilk();
    const core = createCorePersistence({
      ok: true,
      activeTrip: null,
      completedTrips: [],
      completionCleanupPending: false,
    });
    const memory = createMemoryPersistence({
      ok: true,
      records: [remembered],
    });
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(MEMORY_SAVE),
      ids,
    });
    controller.bootstrap();

    const result = controller.clearPriceMemory();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected price-memory clearing success");
    }

    expect(result.state.priceMemories).toEqual([]);
    expect(result.state.priceMemoryPersistence).toEqual({
      status: "healthy",
    });
    expect(memory.saveCalls).toHaveLength(1);
    expect(memory.saveCalls[0]?.records).toEqual([]);
    expect(memory.saveCalls[0]?.savedAt).toBe(MEMORY_SAVE);
  });

  it("keeps remembered prices visible when clearing them cannot be persisted", () => {
    const remembered = rememberedMilk();
    const core = createCorePersistence({
      ok: true,
      activeTrip: null,
      completedTrips: [],
      completionCleanupPending: false,
    });
    const memory = createMemoryPersistence({
      ok: true,
      records: [remembered],
    });
    memory.queueSave({
      ok: false,
      issue: {
        code: "write-failed",
        storageKey: "budget-cart:price-memory",
      },
    });
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: memory,
      clock: createClock(MEMORY_SAVE),
      ids,
    });
    controller.bootstrap();

    const result = controller.clearPriceMemory();

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "price-memory-write-unavailable",
      },
    });
    expect(result.state.priceMemories).toEqual([remembered]);
    expect(result.state.priceMemoryPersistence).toEqual({
      status: "healthy",
    });
  });

  it("rejects a missing remembered item without changing the cart", () => {
    const core = createCorePersistence();
    const controller = createShoppingAppController({
      persistence: core,
      priceMemoryPersistence: createMemoryPersistence(),
      clock: createClock(START),
      ids,
    });
    controller.bootstrap();

    const result = controller.addRememberedItem({
      memoryId: "memory:missing" as never,
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "application",
        code: "price-memory-not-found",
      },
    });
    expect(controller.getSnapshot().activeTrip?.items).toEqual([]);
    expect(core.saveCalls).toHaveLength(0);
  });
});
