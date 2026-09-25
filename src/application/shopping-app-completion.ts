import type { MinorUnits } from "../domain/money";
import {
  mergePriceMemories,
  priceMemoryRecordsFromCompletedTrip,
} from "../domain/price-memory";
import {
  laterTimestamp,
  latestTripTimestamp,
  reduceTrip,
} from "../domain/shopping-trip";
import type { PriceMemoryPersistencePort } from "./price-memory-port";
import type {
  AppCommandResult,
  Clock,
  ShoppingAppState,
  ShoppingPersistencePort,
} from "./shopping-app-contracts";
import {
  HEALTHY_PERSISTENCE,
  applicationError,
  degradedPersistence,
  failure,
  lifecycleBlock,
  requireActiveTrip,
  success,
  upsertCompletedTrip,
} from "./shopping-app-support";

export interface CompletionPorts {
  persistence: ShoppingPersistencePort;
  priceMemory: PriceMemoryPersistencePort;
}

interface CompletionUseCaseDependencies {
  readonly getState: () => ShoppingAppState;
  readonly publish: (nextState: ShoppingAppState) => ShoppingAppState;
  readonly ports: Readonly<CompletionPorts>;
  readonly clock: Clock;
}

export interface CompletionUseCases {
  readonly completeTrip: () => AppCommandResult;
  readonly setActualCheckout: (
    actualCheckoutMinor: MinorUnits,
  ) => AppCommandResult;
  readonly dismissCompletedSummary: () => AppCommandResult;
}

export const createCompletionUseCases = ({
  getState,
  publish,
  ports,
  clock,
}: CompletionUseCaseDependencies): CompletionUseCases => {
  const completeTrip = (): AppCommandResult => {
    const state = getState();

    const active = requireActiveTrip(state);

    if (!active.ok) {
      return failure(state, active.error);
    }

    const completedAt = laterTimestamp(
      clock.now(),
      latestTripTimestamp(active.trip),
    );
    const tripResult = reduceTrip(active.trip, {
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
    const persistenceResult = ports.persistence.complete(
      completedTrip,
      completedAt,
    );

    if (
      !persistenceResult.ok &&
      persistenceResult.stage === "history-read"
    ) {
      // The stored history cannot be read safely, so nothing was written and
      // the active trip is still durable. Report the history, not the trip.
      const nextState = publish({
        ...state,
        historyIntegrity: degradedPersistence(
          persistenceResult.issue,
          state.historyIntegrity.status === "degraded"
            ? state.historyIntegrity.since
            : completedAt,
        ),
      });

      return failure(nextState, applicationError("history-unreadable"));
    }

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
      historyIntegrity: HEALTHY_PERSISTENCE,
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
        const memorySave = ports.priceMemory.save(
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
    const state = getState();

    const blocked = lifecycleBlock(state);

    if (blocked !== null) {
      return failure(state, blocked);
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
    const saveResult = ports.persistence.saveCompleted(
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
    const state = getState();

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

  return {
    completeTrip,
    setActualCheckout,
    dismissCompletedSummary,
  };
};
