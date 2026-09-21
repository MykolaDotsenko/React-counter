import type {
  ActiveTripBootstrapResult,
  ActiveTripPersistencePort,
  ActiveTripSaveResult,
  CompletionSaveResult,
  PersistenceProblem,
} from "../../application/shopping-app-controller";
import type {
  ActiveTrip,
  CompletedTrip,
  IsoTimestamp,
} from "../../domain/shopping-trip";
import {
  bootstrapShoppingPersistence,
  clearActiveTrip,
  completeTripPersistence,
  updateCompletedTripPersistence,
  writeActiveTrip,
  type PersistenceIssue,
  type StorageLike,
} from "./shopping-storage";

const toPersistenceProblem = (
  issue: PersistenceIssue,
): PersistenceProblem => ({
  code: issue.code,
  storageKey: issue.storageKey,
  ...(issue.schemaVersion === undefined
    ? {}
    : { schemaVersion: issue.schemaVersion }),
});

const requiresRecovery = (
  issue: PersistenceIssue,
  activeTrip: ActiveTrip | null,
): boolean =>
  activeTrip === null && issue.code !== "legacy-retirement-failed";

export const createActiveTripPersistencePort = (
  storage: StorageLike | null | undefined,
): ActiveTripPersistencePort => ({
  bootstrap(): ActiveTripBootstrapResult {
    const result = bootstrapShoppingPersistence(storage);

    if (result.health === "healthy") {
      return {
        ok: true,
        activeTrip: result.activeTrip,
        completedTrips: result.completedTrips,
        completionCleanupPending:
          result.completionCleanupPending,
      };
    }

    return {
      ok: false,
      activeTrip: result.activeTrip,
      completedTrips: result.completedTrips,
      completionCleanupPending:
        result.completionCleanupPending,
      issue: toPersistenceProblem(result.issue),
      recoveryRequired: requiresRecovery(
        result.issue,
        result.activeTrip,
      ),
      ...(result.recoveryRaw === undefined
        ? {}
        : { recoveryRaw: result.recoveryRaw }),
    };
  },

  save(
    trip: ActiveTrip,
    savedAt: IsoTimestamp,
  ): ActiveTripSaveResult {
    const result = writeActiveTrip(storage, trip, savedAt);

    if (result.health === "healthy") {
      return { ok: true };
    }

    return {
      ok: false,
      issue: toPersistenceProblem(result.issue),
    };
  },

  complete(
    trip: CompletedTrip,
    savedAt: IsoTimestamp,
  ): CompletionSaveResult {
    const result = completeTripPersistence(storage, trip, savedAt);

    if (result.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      stage: result.stage,
      issue: toPersistenceProblem(result.issue),
      historyPersisted: result.historyPersisted,
    };
  },

  saveCompleted(
    trip: CompletedTrip,
    savedAt: IsoTimestamp,
  ): ActiveTripSaveResult {
    const result = updateCompletedTripPersistence(
      storage,
      trip,
      savedAt,
    );

    if (result.health === "healthy") {
      return { ok: true };
    }

    return {
      ok: false,
      issue: toPersistenceProblem(result.issue),
    };
  },

  clearCompletedActive(): ActiveTripSaveResult {
    const result = clearActiveTrip(storage);

    if (result.health === "healthy") {
      return { ok: true };
    }

    return {
      ok: false,
      issue: toPersistenceProblem(result.issue),
    };
  },
});
