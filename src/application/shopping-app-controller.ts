import type { MinorUnits } from "../domain/money";
import {
  mergePriceMemories,
  priceMemoryRecordsFromCompletedTrip,
  type PriceMemoryRecord,
} from "../domain/price-memory";
import {
  createActiveTrip,
  createCartItem,
  reduceTrip,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
  type ItemId,
  type TripCommand,
  type TripId,
} from "../domain/shopping-trip";
import {
  EMPTY_PRICE_MEMORY_PERSISTENCE_PORT,
} from "./price-memory-port";
import type {
  ActiveTripCommand,
  AddManualItemInput,
  AddRememberedItemInput,
  AppCommandResult,
  ApplicationError,
  Durability,
  PersistenceHealth,
  PersistenceProblem,
  RecoveryState,
  ShoppingAppController,
  ShoppingAppControllerDependencies,
  ShoppingAppState,
  StartTripInput,
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
  CompletionSaveResult,
  Durability,
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

const EMPTY_COMPLETED_TRIPS = Object.freeze([]) as readonly CompletedTrip[];
const EMPTY_PRICE_MEMORIES = Object.freeze([]) as readonly PriceMemoryRecord[];

const HEALTHY_PERSISTENCE = Object.freeze({
  status: "healthy",
}) as PersistenceHealth;

const freezeState = (state: ShoppingAppState): ShoppingAppState =>
  Object.freeze(state);

const applicationError = (
  code: Extract<ApplicationError, { kind: "application" }>["code"],
): ApplicationError => ({
  kind: "application",
  code,
});

const initialState = (): ShoppingAppState =>
  freezeState({
    lifecycle: "booting",
    activeTrip: null,
    completedSummary: null,
    completedTrips: EMPTY_COMPLETED_TRIPS,
    completionCleanupPending: false,
    persistence: HEALTHY_PERSISTENCE,
    priceMemories: EMPTY_PRICE_MEMORIES,
    priceMemoryPersistence: HEALTHY_PERSISTENCE,
    undo: null,
    recovery: null,
  });

const degradedPersistence = (
  issue: PersistenceProblem,
  since: IsoTimestamp,
): PersistenceHealth =>
  Object.freeze({
    status: "degraded",
    issue,
    since,
  });

const recoveryState = (
  issue: PersistenceProblem,
  raw: string | undefined,
): RecoveryState =>
  Object.freeze({
    issue,
    ...(raw === undefined ? {} : { raw }),
  });

const success = (
  state: ShoppingAppState,
  changed: boolean,
  durability: Durability,
): AppCommandResult => ({
  ok: true,
  changed,
  durability,
  state,
});

const failure = (
  state: ShoppingAppState,
  error: ApplicationError,
): AppCommandResult => ({
  ok: false,
  error,
  state,
});

const upsertCompletedTrip = (
  trips: readonly CompletedTrip[],
  trip: CompletedTrip,
): readonly CompletedTrip[] => {
  const index = trips.findIndex((candidate) => candidate.id === trip.id);

  if (index < 0) {
    return Object.freeze([...trips, trip]);
  }

  return Object.freeze(
    trips.map((candidate, candidateIndex) =>
      candidateIndex === index ? trip : candidate,
    ),
  );
};

export const createShoppingAppController = ({
  persistence,
  clock,
  ids,
  priceMemoryPersistence = EMPTY_PRICE_MEMORY_PERSISTENCE_PORT,
}: ShoppingAppControllerDependencies): ShoppingAppController => {
  let state = initialState();
  const listeners = new Set<() => void>();

  const publish = (nextState: ShoppingAppState): ShoppingAppState => {
    state = freezeState(nextState);

    for (const listener of listeners) {
      listener();
    }

    return state;
  };

  const getSnapshot = (): ShoppingAppState => state;

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const bootstrap = (): ShoppingAppState => {
    if (
      state.lifecycle !== "booting" &&
      state.lifecycle !== "recovery"
    ) {
      return state;
    }

    const result = persistence.bootstrap();
    const memoryResult = priceMemoryPersistence.bootstrap();
    const bootstrapIssueTime =
      !result.ok || !memoryResult.ok ? clock.now() : null;
    const memoryHealth = memoryResult.ok
      ? HEALTHY_PERSISTENCE
      : degradedPersistence(
          memoryResult.issue,
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

    const saveResult = persistence.save(tripResult.value, now);
    const nextState = publish({
      lifecycle: "active",
      activeTrip: tripResult.value,
      completedSummary: null,
      completedTrips: state.completedTrips,
      completionCleanupPending: false,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, now),
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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    if (
      state.persistence.status === "degraded" ||
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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    const now = clock.now();
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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
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

    const now = clock.now();
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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    const current = state.activeTrip.items.find(
      (item) => item.id === input.itemId,
    );

    if (current === undefined) {
      return failure(state, {
        kind: "domain",
        code: "item-not-found",
      });
    }

    const now = clock.now();
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

  const completeTrip = (): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    const completedAt = clock.now();
    const tripResult = reduceTrip(state.activeTrip, {
      type: "complete-trip",
      completedAt,
    });

    if (!tripResult.ok) {
      return failure(state, tripResult.error);
    }

    if (tripResult.value.status !== "completed") {
      return failure(state, applicationError("no-completed-summary"));
    }

    const completedTrip = tripResult.value;
    const persistenceResult = persistence.complete(
      completedTrip,
      completedAt,
    );

    if (
      !persistenceResult.ok &&
      !persistenceResult.historyPersisted
    ) {
      const nextState = publish({
        ...state,
        persistence: degradedPersistence(
          persistenceResult.issue,
          completedAt,
        ),
        completionCleanupPending: false,
      });

      return failure(
        nextState,
        applicationError("completion-not-saved"),
      );
    }

    const cleanupPending =
      !persistenceResult.ok &&
      persistenceResult.stage === "active-clear";
    const completedTrips = upsertCompletedTrip(
      state.completedTrips,
      completedTrip,
    );
    let nextState = publish({
      lifecycle: "completed-summary",
      activeTrip: null,
      completedSummary: completedTrip,
      completedTrips,
      completionCleanupPending: cleanupPending,
      persistence: persistenceResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(
            persistenceResult.issue,
            completedAt,
          ),
      priceMemories: state.priceMemories,
      priceMemoryPersistence: state.priceMemoryPersistence,
      undo: null,
      recovery: null,
    });

    const observedMemories =
      priceMemoryRecordsFromCompletedTrip(completedTrip);
    const mergedMemories = mergePriceMemories(
      nextState.priceMemories,
      observedMemories,
    );

    if (mergedMemories !== nextState.priceMemories) {
      const canAttemptMemoryWrite =
        nextState.priceMemoryPersistence.status === "healthy" ||
        nextState.priceMemoryPersistence.issue.code === "write-failed";

      if (canAttemptMemoryWrite) {
        const memorySavedAt = clock.now();
        const memorySave = priceMemoryPersistence.save(
          mergedMemories,
          memorySavedAt,
        );

        nextState = publish({
          ...nextState,
          priceMemories: mergedMemories,
          priceMemoryPersistence: memorySave.ok
            ? HEALTHY_PERSISTENCE
            : degradedPersistence(
                memorySave.issue,
                memorySavedAt,
              ),
        });
      } else {
        nextState = publish({
          ...nextState,
          priceMemories: mergedMemories,
        });
      }
    }

    return success(nextState, true, "persisted");
  };

  const setActualCheckout = (
    actualCheckoutMinor: MinorUnits,
  ): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (
      state.lifecycle !== "completed-summary" ||
      state.completedSummary === null
    ) {
      return failure(state, applicationError("no-completed-summary"));
    }

    if (
      state.completedSummary.actualCheckoutMinor ===
      actualCheckoutMinor
    ) {
      return success(state, false, "unchanged");
    }

    const tripResult = reduceTrip(state.completedSummary, {
      type: "set-actual-checkout",
      actualCheckoutMinor,
    });

    if (!tripResult.ok) {
      return failure(state, tripResult.error);
    }

    if (tripResult.value.status !== "completed") {
      return failure(state, applicationError("no-completed-summary"));
    }

    const now = clock.now();
    const saveResult = persistence.saveCompleted(
      tripResult.value,
      now,
    );
    const completedTrips = upsertCompletedTrip(
      state.completedTrips,
      tripResult.value,
    );
    const shouldStayDegraded =
      state.completionCleanupPending || !saveResult.ok;
    const issue = !saveResult.ok
      ? saveResult.issue
      : state.persistence.status === "degraded"
        ? state.persistence.issue
        : null;
    const nextState = publish({
      ...state,
      completedSummary: tripResult.value,
      completedTrips,
      persistence:
        shouldStayDegraded && issue !== null
          ? degradedPersistence(
              issue,
              state.persistence.status === "degraded"
                ? state.persistence.since
                : now,
            )
          : HEALTHY_PERSISTENCE,
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  const dismissCompletedSummary = (): AppCommandResult => {
    if (
      state.lifecycle !== "completed-summary" ||
      state.completedSummary === null
    ) {
      return failure(state, applicationError("no-completed-summary"));
    }

    if (
      state.persistence.status === "degraded" ||
      state.completionCleanupPending
    ) {
      return failure(
        state,
        applicationError("completion-not-saved"),
      );
    }

    const nextState = publish({
      ...state,
      lifecycle: "idle",
      activeTrip: null,
      completedSummary: null,
      undo: null,
      recovery: null,
    });

    return success(nextState, true, "unchanged");
  };

  const replaceCompletedHistory = (
    nextTrips: readonly CompletedTrip[],
  ): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    if (
      state.persistence.status === "degraded" ||
      state.completionCleanupPending
    ) {
      return failure(
        state,
        applicationError("history-write-unavailable"),
      );
    }

    const now = clock.now();
    const saveResult = persistence.replaceCompletedHistory(
      nextTrips,
      now,
    );

    if (!saveResult.ok) {
      return failure(
        state,
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

    return replaceCompletedHistory(
      state.completedTrips.filter((trip) => trip.id !== tripId),
    );
  };

  const clearCompletedHistory = (): AppCommandResult => {
    if (state.completedTrips.length === 0) {
      return success(state, false, "unchanged");
    }

    return replaceCompletedHistory([]);
  };

  const clearPriceMemory = (): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
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
    const saveResult = priceMemoryPersistence.save([], now);

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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
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
      const saveResult = persistence.save(state.activeTrip, now);
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
      const historySave = persistence.saveCompleted(
        state.completedSummary,
        now,
      );

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
        const cleanup = persistence.clearCompletedActive();

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
      const cleanup = persistence.clearCompletedActive();
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

  const dispatch = (command: ActiveTripCommand): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    const currentTrip = state.activeTrip;
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
    const saveResult = persistence.save(tripResult.value, now);
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
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    if (state.undo === null) {
      return success(state, false, "unchanged");
    }

    const previousTrip = state.undo.previousTrip;
    const now = clock.now();
    const saveResult = persistence.save(previousTrip, now);
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
    dispatch,
  });
};
