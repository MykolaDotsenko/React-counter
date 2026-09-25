import {
  createActiveTrip,
  createCartItem,
  latestTripTimestamp,
  laterTimestamp,
  reduceTrip,
  sameTripContents,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
  type ItemId,
  type TripId,
} from "../domain/shopping-trip";
import { EMPTY_PRICE_MEMORY_PERSISTENCE_PORT } from "./price-memory-port";
import {
  SESSION_ONLY_ISSUE,
  SESSION_ONLY_PERSISTENCE_PORT,
  SESSION_ONLY_PRICE_MEMORY_PORT,
} from "./session-only-persistence";
import {
  createCompletionUseCases,
  type CompletionPorts,
} from "./shopping-app-completion";
import {
  EMPTY_PRICE_MEMORIES,
  HEALTHY_PERSISTENCE,
  applicationError,
  canSetAsideActiveTrip,
  canSetAsideHistory,
  degradedPersistence,
  failure,
  freezeState,
  initialState,
  lifecycleBlock,
  recoveryState,
  requireActiveTrip,
  success,
  withUnreadableHistory,
} from "./shopping-app-support";
import type {
  ActiveTripCommand,
  AddManualItemInput,
  AddRememberedItemInput,
  AppCommandResult,
  PersistenceProblem,
  ShoppingAppController,
  ShoppingAppControllerDependencies,
  ShoppingAppState,
  StartTripInput,
  UndoState,
  UpdateManualItemInput,
  UpdateSpendingPlanInput,
} from "./shopping-app-contracts";

export type {
  ActiveTripBootstrapResult,
  ActiveTripCommand,
  ActiveTripPersistencePort,
  ActiveTripSaveResult,
  AddManualItemInput,
  AddRememberedItemInput,
  AppCommandResult,
  AppLifecycle,
  ApplicationError,
  Clock,
  CompletedHistoryReadResult,
  CompletionSaveResult,
  Durability,
  HistorySetAsideResult,
  IdGenerator,
  PersistenceHealth,
  PersistenceProblem,
  RecoveryState,
  ShoppingAppController,
  ShoppingAppControllerDependencies,
  ShoppingAppState,
  ShoppingPersistencePort,
  StartTripInput,
  UndoState,
  UpdateManualItemInput,
  UpdateSpendingPlanInput,
} from "./shopping-app-contracts";

export const createShoppingAppController = ({
  persistence,
  clock,
  ids,
  priceMemoryPersistence = EMPTY_PRICE_MEMORY_PERSISTENCE_PORT,
}: ShoppingAppControllerDependencies): ShoppingAppController => {
  let state = initialState();
  const listeners = new Set<() => void>();
  // Mutable only through continueWithoutSaving(), which swaps every write path
  // to refusing session-only ports in one step.
  const ports: CompletionPorts = {
    persistence,
    priceMemory: priceMemoryPersistence,
  };

  const publish = (nextState: ShoppingAppState): ShoppingAppState => {
    state = freezeState(nextState);

    for (const listener of listeners) {
      listener();
    }

    return state;
  };

  const getSnapshot = (): ShoppingAppState => state;

  const tripCommandTime = (trip: ActiveTrip): IsoTimestamp =>
    laterTimestamp(clock.now(), latestTripTimestamp(trip));

  const sessionOnly = (): boolean =>
    ports.persistence === SESSION_ONLY_PERSISTENCE_PORT;

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const {
    completeTrip,
    setActualCheckout,
    dismissCompletedSummary,
  } = createCompletionUseCases({
    getState: () => state,
    publish,
    ports,
    clock,
    ids,
  });

  const bootstrap = (): ShoppingAppState => {
    if (
      state.lifecycle !== "booting" &&
      state.lifecycle !== "recovery"
    ) {
      return state;
    }

    const result = ports.persistence.bootstrap();
    const memoryResult = ports.priceMemory.bootstrap();
    const bootstrapIssueTime =
      !result.ok ||
      !memoryResult.ok ||
      result.historyIssue !== undefined
        ? clock.now()
        : null;
    const memoryHealth = memoryResult.ok
      ? HEALTHY_PERSISTENCE
      : degradedPersistence(
          memoryResult.issue,
          bootstrapIssueTime ?? clock.now(),
        );
    const historyIntegrity =
      result.historyIssue === undefined
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(
            result.historyIssue,
            bootstrapIssueTime ?? clock.now(),
          );

    if (result.ok) {
      return publish({
        lifecycle: result.activeTrip === null ? "idle" : "active",
        activeTrip: result.activeTrip,
        completedSummary: null,
        completedTrips: result.completedTrips,
        completionCleanupPending: result.completionCleanupPending,
        persistence: HEALTHY_PERSISTENCE,
        historyIntegrity,
        priceMemories: memoryResult.records,
        priceMemoryPersistence: memoryHealth,
        undo: null,
        recovery: null,
      });
    }

    const since = bootstrapIssueTime ?? clock.now();
    const persistenceHealth = degradedPersistence(result.issue, since);

    if (result.recoveryRequired) {
      return publish({
        lifecycle: "recovery",
        activeTrip: null,
        completedSummary: null,
        completedTrips: result.completedTrips,
        completionCleanupPending: result.completionCleanupPending,
        persistence: persistenceHealth,
        historyIntegrity,
        priceMemories: memoryResult.records,
        priceMemoryPersistence: memoryHealth,
        undo: null,
        recovery: recoveryState(
          result.issue,
          result.recoveryRaw,
        ),
      });
    }

    return publish({
      lifecycle: result.activeTrip === null ? "idle" : "active",
      activeTrip: result.activeTrip,
      completedSummary: null,
      completedTrips: result.completedTrips,
      completionCleanupPending: result.completionCleanupPending,
      persistence: persistenceHealth,
      historyIntegrity,
      priceMemories: memoryResult.records,
      priceMemoryPersistence: memoryHealth,
      undo: null,
      recovery: null,
    });
  };

  const createAndPersistActiveTrip = (
    input: StartTripInput,
  ): AppCommandResult => {
    const now = clock.now();
    const tripResult = createActiveTrip({
      id: ids.tripId(),
      budgetMinor: input.budgetMinor,
      ...(input.safetyBufferMinor === undefined
        ? {}
        : { safetyBufferMinor: input.safetyBufferMinor }),
      startedAt: now,
    });

    if (!tripResult.ok) {
      return failure(state, tripResult.error);
    }

    const saveResult = ports.persistence.save(tripResult.value, now);
    const nextState = publish({
      lifecycle: "active",
      activeTrip: tripResult.value,
      completedSummary: null,
      completedTrips: state.completedTrips,
      completionCleanupPending: false,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, now),
      historyIntegrity: state.historyIntegrity,
      priceMemories: state.priceMemories,
      priceMemoryPersistence: state.priceMemoryPersistence,
      undo: null,
      recovery: null,
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  const startTrip = (input: StartTripInput): AppCommandResult => {
    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
    }

    if (state.lifecycle === "completed-summary") {
      return failure(state, applicationError("completed-summary-open"));
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    return createAndPersistActiveTrip(input);
  };

  const startTripFromCompleted = (tripId: TripId): AppCommandResult => {
    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    if (
      (state.persistence.status === "degraded" && !sessionOnly()) ||
      state.completionCleanupPending
    ) {
      return failure(
        state,
        applicationError("repeat-source-unavailable"),
      );
    }

    const source = state.completedTrips.find(
      (trip) => trip.id === tripId,
    );

    if (source === undefined) {
      return failure(
        state,
        applicationError("completed-trip-not-found"),
      );
    }

    return createAndPersistActiveTrip({
      budgetMinor: source.budgetMinor,
      safetyBufferMinor: source.safetyBufferMinor,
    });
  };

  const addManualItem = (
    input: AddManualItemInput,
  ): AppCommandResult => {
    const active = requireActiveTrip(state);

    if (!active.ok) {
      return failure(state, active.error);
    }

    const now = tripCommandTime(active.trip);
    const itemResult = createCartItem({
      id: ids.itemId(),
      unitPriceMinor: input.unitPriceMinor,
      quantity: input.quantity,
      ...(input.label === undefined ? {} : { label: input.label }),
      priceSource: { kind: "manual" },
      priceConfidence: {
        kind: "confirmed",
        confirmedAt: now,
      },
      createdAt: now,
    });

    if (!itemResult.ok) {
      return failure(state, itemResult.error);
    }

    return dispatch({
      type: "add-item",
      item: itemResult.value,
    });
  };

  const addRememberedItem = (
    input: AddRememberedItemInput,
  ): AppCommandResult => {
    const active = requireActiveTrip(state);

    if (!active.ok) {
      return failure(state, active.error);
    }

    const memory = state.priceMemories.find(
      (candidate) => candidate.id === input.memoryId,
    );

    if (memory === undefined) {
      return failure(
        state,
        applicationError("price-memory-not-found"),
      );
    }

    const now = tripCommandTime(active.trip);
    const itemResult = createCartItem({
      id: ids.itemId(),
      unitPriceMinor: memory.unitPriceMinor,
      quantity: input.quantity ?? 1,
      label: memory.label,
      priceSource: {
        kind: "price-memory",
        memoryId: memory.id,
      },
      priceConfidence: {
        kind: "remembered",
        observedAt: memory.observedAt,
        ...(memory.storeId === undefined
          ? {}
          : { storeId: memory.storeId }),
      },
      createdAt: now,
    });

    if (!itemResult.ok) {
      return failure(state, itemResult.error);
    }

    return dispatch({
      type: "add-item",
      item: itemResult.value,
    });
  };

  const updateSpendingPlan = (
    input: UpdateSpendingPlanInput,
  ): AppCommandResult =>
    dispatch({
      type: "set-spending-plan",
      budgetMinor: input.budgetMinor,
      safetyBufferMinor: input.safetyBufferMinor,
    });

  const updateManualItem = (
    input: UpdateManualItemInput,
  ): AppCommandResult => {
    const active = requireActiveTrip(state);

    if (!active.ok) {
      return failure(state, active.error);
    }

    const current = active.trip.items.find(
      (item) => item.id === input.itemId,
    );

    if (current === undefined) {
      return failure(state, {
        kind: "domain",
        code: "item-not-found",
      });
    }

    const now = tripCommandTime(active.trip);
    const priceChanged =
      current.unitPriceMinor !== input.unitPriceMinor;

    return dispatch({
      type: "update-item",
      itemId: input.itemId,
      patch: {
        unitPriceMinor: input.unitPriceMinor,
        quantity: input.quantity,
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(priceChanged
          ? {
              priceSource: { kind: "manual" as const },
              priceConfidence: {
                kind: "confirmed" as const,
                confirmedAt: now,
              },
            }
          : {}),
      },
      now,
    });
  };

  const removeItem = (itemId: ItemId): AppCommandResult =>
    dispatch({
      type: "remove-item",
      itemId,
    });

  const undoStateForCommand = (
    previousTrip: ActiveTrip,
    command: ActiveTripCommand,
  ): UndoState | null => {
    switch (command.type) {
      case "add-item":
        return Object.freeze({
          previousTrip,
          description: "add",
        });
      case "update-item":
        return Object.freeze({
          previousTrip,
          description: "edit",
        });
      case "remove-item":
        return Object.freeze({
          previousTrip,
          description: "remove",
        });
      case "set-spending-plan":
      case "set-budget":
      case "set-buffer":
        return null;
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  };

  const markHistoryUnreadable = (
    issue: PersistenceProblem,
    completedTrips: readonly CompletedTrip[],
  ): ShoppingAppState =>
    publish(withUnreadableHistory(state, issue, completedTrips, clock.now()));

  /**
   * Rewrites history from what is durably stored now, never from a possibly
   * stale in-memory list, so trips this session never loaded are not dropped.
   */
  const replaceCompletedHistory = (
    nextFrom: (durable: readonly CompletedTrip[]) => readonly CompletedTrip[],
  ): AppCommandResult => {
    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    if (
      state.persistence.status === "degraded" ||
      state.historyIntegrity.status === "degraded" ||
      state.completionCleanupPending ||
      sessionOnly()
    ) {
      return failure(
        state,
        applicationError("history-write-unavailable"),
      );
    }

    const durable = ports.persistence.readCompletedHistory();

    if (!durable.ok) {
      return failure(
        markHistoryUnreadable(durable.issue, durable.completedTrips),
        applicationError("history-write-unavailable"),
      );
    }

    const nextTrips = nextFrom(durable.completedTrips);
    const now = clock.now();
    const saveResult = ports.persistence.replaceCompletedHistory(
      nextTrips,
      now,
    );

    if (!saveResult.ok) {
      return failure(
        saveResult.stage === "history-read"
          ? markHistoryUnreadable(saveResult.issue, durable.completedTrips)
          : state,
        applicationError("history-write-unavailable"),
      );
    }

    const completedSummaryStillExists =
      state.completedSummary === null ||
      nextTrips.some((trip) => trip.id === state.completedSummary?.id);

    const nextState = publish({
      ...state,
      lifecycle:
        completedSummaryStillExists ? state.lifecycle : "idle",
      completedSummary: completedSummaryStillExists
        ? state.completedSummary
        : null,
      completedTrips: Object.freeze([...nextTrips]),
      persistence: HEALTHY_PERSISTENCE,
      undo: null,
      recovery: null,
    });

    return success(nextState, true, "persisted");
  };

  const deleteCompletedTrip = (tripId: TripId): AppCommandResult => {
    const existing = state.completedTrips.find(
      (trip) => trip.id === tripId,
    );

    if (existing === undefined) {
      return failure(
        state,
        applicationError("completed-trip-not-found"),
      );
    }

    return replaceCompletedHistory((durable) =>
      durable.filter((trip) => trip.id !== tripId),
    );
  };

  const clearCompletedHistory = (): AppCommandResult => {
    if (state.completedTrips.length === 0) {
      return success(state, false, "unchanged");
    }

    return replaceCompletedHistory(() => []);
  };

  const clearPriceMemory = (): AppCommandResult => {
    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    if (
      state.priceMemories.length === 0 &&
      state.priceMemoryPersistence.status === "healthy"
    ) {
      return success(state, false, "unchanged");
    }

    const now = clock.now();
    const saveResult = ports.priceMemory.save([], now);

    if (!saveResult.ok) {
      return failure(
        state,
        applicationError("price-memory-write-unavailable"),
      );
    }

    const nextState = publish({
      ...state,
      priceMemories: EMPTY_PRICE_MEMORIES,
      priceMemoryPersistence: HEALTHY_PERSISTENCE,
    });

    return success(nextState, true, "persisted");
  };

  const retryPersistence = (): AppCommandResult => {
    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
    }

    if (
      state.persistence.status === "healthy" &&
      !state.completionCleanupPending
    ) {
      return success(state, false, "unchanged");
    }

    const since =
      state.persistence.status === "degraded"
        ? state.persistence.since
        : clock.now();
    const now = clock.now();

    if (state.activeTrip !== null) {
      const saveResult = ports.persistence.save(state.activeTrip, now);
      const nextState = publish({
        ...state,
        persistence: saveResult.ok
          ? HEALTHY_PERSISTENCE
          : degradedPersistence(saveResult.issue, since),
      });

      return success(
        nextState,
        true,
        saveResult.ok ? "persisted" : "memory-only",
      );
    }

    if (state.completedSummary !== null) {
      const historySave = ports.persistence.saveCompleted(
        state.completedSummary,
        now,
      );

      if (!historySave.ok && historySave.stage === "history-read") {
        // History became unreadable after this trip finished, so the summary
        // cannot be written into it; that is reported as a history problem.
        // Clearing the stale active copy does not touch history, so it still
        // runs and the summary can close.
        const readable = ports.persistence.readCompletedHistory();
        const cleanup = state.completionCleanupPending
          ? ports.persistence.clearCompletedActive()
          : ({ ok: true } as const);
        const nextState = publish({
          ...withUnreadableHistory(
            state,
            historySave.issue,
            readable.completedTrips,
            now,
          ),
          persistence: cleanup.ok
            ? HEALTHY_PERSISTENCE
            : degradedPersistence(cleanup.issue, since),
          completionCleanupPending: !cleanup.ok,
        });

        return success(nextState, true, "memory-only");
      }

      if (!historySave.ok) {
        const nextState = publish({
          ...state,
          persistence: degradedPersistence(
            historySave.issue,
            since,
          ),
        });

        return success(nextState, true, "memory-only");
      }

      if (state.completionCleanupPending) {
        const cleanup = ports.persistence.clearCompletedActive();

        if (!cleanup.ok) {
          const nextState = publish({
            ...state,
            persistence: degradedPersistence(
              cleanup.issue,
              since,
            ),
            completionCleanupPending: true,
          });

          return success(nextState, true, "persisted");
        }
      }

      const nextState = publish({
        ...state,
        persistence: HEALTHY_PERSISTENCE,
        completionCleanupPending: false,
      });

      return success(nextState, true, "persisted");
    }

    if (state.completionCleanupPending) {
      const cleanup = ports.persistence.clearCompletedActive();
      const nextState = publish({
        ...state,
        persistence: cleanup.ok
          ? HEALTHY_PERSISTENCE
          : degradedPersistence(cleanup.issue, since),
        completionCleanupPending: !cleanup.ok,
      });

      return success(
        nextState,
        true,
        cleanup.ok ? "persisted" : "memory-only",
      );
    }

    return failure(state, applicationError("no-active-trip"));
  };

  const historyRepairBlock = (): AppCommandResult | null => {
    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
    }

    if (state.lifecycle === "completed-summary") {
      return failure(state, applicationError("completed-summary-open"));
    }

    return null;
  };

  const retryHistoryRead = (): AppCommandResult => {
    const blocked = historyRepairBlock();

    if (blocked !== null) {
      return blocked;
    }

    if (state.historyIntegrity.status === "healthy" || sessionOnly()) {
      return success(state, false, "unchanged");
    }

    const since = state.historyIntegrity.since;
    const result = ports.persistence.readCompletedHistory();

    if (!result.ok) {
      const nextState = publish({
        ...state,
        completedTrips: Object.freeze([...result.completedTrips]),
        historyIntegrity: degradedPersistence(result.issue, since),
      });

      return success(nextState, true, "unchanged");
    }

    const activeTrip = state.activeTrip;
    const staleActive =
      activeTrip !== null &&
      result.completedTrips.some((trip) =>
        sameTripContents(activeTrip, trip),
      );

    if (!staleActive) {
      const nextState = publish({
        ...state,
        completedTrips: Object.freeze([...result.completedTrips]),
        historyIntegrity: HEALTHY_PERSISTENCE,
      });

      return success(nextState, true, "unchanged");
    }

    // History is the completion authority: an open copy identical to a trip it
    // already holds is a leftover, exactly as startup reconciliation treats
    // it. A copy edited since stays open and finishes as a trip of its own.
    const cleanup = ports.persistence.clearCompletedActive();
    const nextState = publish({
      ...state,
      lifecycle: "idle",
      activeTrip: null,
      completedTrips: Object.freeze([...result.completedTrips]),
      historyIntegrity: HEALTHY_PERSISTENCE,
      completionCleanupPending: !cleanup.ok,
      persistence: cleanup.ok
        ? state.persistence
        : degradedPersistence(cleanup.issue, clock.now()),
      undo: null,
    });

    return success(nextState, true, cleanup.ok ? "persisted" : "memory-only");
  };

  const setAsideDamagedHistory = (): AppCommandResult => {
    const blocked = historyRepairBlock();

    if (blocked !== null) {
      return blocked;
    }

    if (
      state.historyIntegrity.status === "healthy" ||
      !canSetAsideHistory(state.historyIntegrity.issue)
    ) {
      return failure(state, applicationError("nothing-to-set-aside"));
    }

    const result = ports.persistence.setAsideDamagedHistory(clock.now());

    if (!result.ok) {
      return failure(state, applicationError("set-aside-failed"));
    }

    const nextState = publish({
      ...state,
      completedTrips: Object.freeze([...result.completedTrips]),
      historyIntegrity: HEALTHY_PERSISTENCE,
    });

    return success(nextState, true, "persisted");
  };

  const setAsideUnreadableActiveTrip = (): AppCommandResult => {
    if (state.lifecycle !== "recovery" || state.recovery === null) {
      return failure(state, applicationError("recovery-not-open"));
    }

    if (!canSetAsideActiveTrip(state.recovery.issue)) {
      return failure(state, applicationError("nothing-to-set-aside"));
    }

    const result = ports.persistence.setAsideUnreadableActiveTrip(
      clock.now(),
    );

    if (!result.ok) {
      return failure(state, applicationError("set-aside-failed"));
    }

    const nextState = bootstrap();

    return success(nextState, true, "persisted");
  };

  const continueWithoutSaving = (): AppCommandResult => {
    if (state.lifecycle !== "recovery" || state.recovery === null) {
      return failure(state, applicationError("recovery-not-open"));
    }

    ports.persistence = SESSION_ONLY_PERSISTENCE_PORT;
    ports.priceMemory = SESSION_ONLY_PRICE_MEMORY_PORT;

    const now = clock.now();
    const nextState = publish({
      ...state,
      lifecycle: "idle",
      activeTrip: null,
      completedSummary: null,
      completionCleanupPending: false,
      persistence: degradedPersistence(SESSION_ONLY_ISSUE, now),
      priceMemoryPersistence: degradedPersistence(SESSION_ONLY_ISSUE, now),
      undo: null,
      recovery: null,
    });

    return success(nextState, true, "memory-only");
  };

  const dispatch = (command: ActiveTripCommand): AppCommandResult => {
    const active = requireActiveTrip(state);

    if (!active.ok) {
      return failure(state, active.error);
    }

    const currentTrip = active.trip;
    const tripResult = reduceTrip(currentTrip, command);

    if (!tripResult.ok) {
      return failure(state, tripResult.error);
    }

    if (tripResult.value.status !== "active") {
      return failure(state, applicationError("no-active-trip"));
    }

    if (tripResult.value === currentTrip) {
      return success(state, false, "unchanged");
    }

    const now = clock.now();
    const saveResult = ports.persistence.save(tripResult.value, now);
    const nextState = publish({
      ...state,
      lifecycle: "active",
      activeTrip: tripResult.value,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, now),
      undo: undoStateForCommand(currentTrip, command),
      recovery: null,
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  const undo = (): AppCommandResult => {
    const active = requireActiveTrip(state);

    if (!active.ok) {
      return failure(state, active.error);
    }

    if (state.undo === null) {
      return success(state, false, "unchanged");
    }

    const previousTrip = state.undo.previousTrip;
    const now = clock.now();
    const saveResult = ports.persistence.save(previousTrip, now);
    const nextState = publish({
      ...state,
      lifecycle: "active",
      activeTrip: previousTrip,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, now),
      undo: null,
      recovery: null,
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  return Object.freeze({
    getSnapshot,
    subscribe,
    bootstrap,
    startTrip,
    startTripFromCompleted,
    addManualItem,
    addRememberedItem,
    updateSpendingPlan,
    updateManualItem,
    removeItem,
    undo,
    completeTrip,
    setActualCheckout,
    dismissCompletedSummary,
    deleteCompletedTrip,
    clearCompletedHistory,
    clearPriceMemory,
    retryPersistence,
    retryHistoryRead,
    setAsideDamagedHistory,
    setAsideUnreadableActiveTrip,
    continueWithoutSaving,
    dispatch,
  });
};
