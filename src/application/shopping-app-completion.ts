import type { MinorUnits } from "../domain/money";
import {
  mergePriceMemories,
  priceMemoryRecordsFromCompletedTrip,
} from "../domain/price-memory";
import {
  laterTimestamp,
  latestTripTimestamp,
  reduceTrip,
  tripId,
} from "../domain/shopping-trip";
import type { PriceMemoryPersistencePort } from "./price-memory-port";
import { SESSION_ONLY_PERSISTENCE_PORT } from "./session-only-persistence";
import type {
  AppCommandResult,
  Clock,
  IdGenerator,
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
  readonly ids: IdGenerator;
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
  ids,
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

    let openTrip = active.trip;
    let undo = state.undo;
    let completedTrip = tripResult.value;
    let persistenceResult = ports.persistence.complete(
      completedTrip,
      completedAt,
    );

    if (
      !persistenceResult.ok &&
      persistenceResult.stage === "history-write" &&
      persistenceResult.issue.code === "history-conflict"
    ) {
      // History already records different shopping under this id: the open
      // trip was edited after an earlier completion of it was recorded. Keep
      // both by recording this one as a trip of its own. The open copy takes
      // the new id first, so a completion interrupted after its history write
      // leaves a copy that startup reconciliation recognises as finished.
      const forkedId = tripId(ids.tripId());

      if (forkedId.ok) {
        const forkedOpenTrip = { ...openTrip, id: forkedId.value };
        const forkSave = ports.persistence.save(forkedOpenTrip, completedAt);

        if (forkSave.ok) {
          openTrip = forkedOpenTrip;
          undo =
            undo === null
              ? null
              : {
                  ...undo,
                  previousTrip: { ...undo.previousTrip, id: forkedId.value },
                };
          completedTrip = { ...completedTrip, id: forkedId.value };
          persistenceResult = ports.persistence.complete(
            completedTrip,
            completedAt,
          );
        } else {
          persistenceResult = {
            ok: false,
            stage: "history-write",
            issue: forkSave.issue,
            historyPersisted: false,
          };
        }
      }
    }

    if (
      !persistenceResult.ok &&
      persistenceResult.stage === "history-read"
    ) {
      // The stored history cannot be read safely, so nothing was written and
      // the active trip is still durable. Report the history, not the trip,
      // and show exactly the trips a set-aside would keep.
      const readable = ports.persistence.readCompletedHistory();
      const nextState = publish({
        ...state,
        activeTrip: openTrip,
        undo,
        completedTrips: Object.freeze([...readable.completedTrips]),
        historyIntegrity: degradedPersistence(
          persistenceResult.issue,
          state.historyIntegrity.status === "degraded"
            ? state.historyIntegrity.since
            : completedAt,
        ),
      });

      return failure(nextState, applicationError("history-unreadable"));
    }

    // A session-only run finishes in memory: the shopper sees the summary
    // and can shop again, and nothing claims to be saved.
    const sessionOnly = ports.persistence === SESSION_ONLY_PERSISTENCE_PORT;

    if (
      !persistenceResult.ok &&
      !persistenceResult.historyPersisted &&
      !sessionOnly
    ) {
      const nextState = publish({
        ...state,
        activeTrip: openTrip,
        undo,
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
    const completedTrips =
      persistenceResult.completedTrips === undefined
        ? upsertCompletedTrip(state.completedTrips, completedTrip)
        : Object.freeze([...persistenceResult.completedTrips]);
    // When history already held this very completion, the recorded one (with
    // its original time and any checkout total) is the trip that finished.
    const completedSummary =
      completedTrips.find((trip) => trip.id === completedTrip.id) ??
      completedTrip;
    let nextState = publish({
      lifecycle: "completed-summary",
      activeTrip: null,
      completedSummary,
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
      priceMemoryRecordsFromCompletedTrip(completedSummary);
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

    return success(
      nextState,
      true,
      sessionOnly ? "memory-only" : "persisted",
    );
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
    if (!saveResult.ok && saveResult.stage === "history-read") {
      // History became unreadable after this trip finished; nothing was
      // written. Keep the value in view and report the history, not the trip.
      const nextState = publish({
        ...state,
        completedSummary: tripResult.value,
        completedTrips,
        historyIntegrity: degradedPersistence(
          saveResult.issue,
          state.historyIntegrity.status === "degraded"
            ? state.historyIntegrity.since
            : now,
        ),
      });

      return success(nextState, true, "memory-only");
    }

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

    const sessionOnly = ports.persistence === SESSION_ONLY_PERSISTENCE_PORT;

    if (
      (state.persistence.status === "degraded" && !sessionOnly) ||
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
