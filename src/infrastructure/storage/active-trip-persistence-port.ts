import type {
  ActiveTripBootstrapResult,
  ActiveTripPersistencePort,
  ActiveTripSaveResult,
  CompletedHistoryReadResult,
  CompletionSaveResult,
  HistorySetAsideResult,
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
  restoreHistory,
  setAsideDamagedHistory,
  setAsideUnreadableActiveTrip,
  replaceReadableHistory,
  updateCompletedTripPersistence,
  writeActiveTrip,
  type PersistenceIssue,
  type PersistenceWriteResult,
  type StorageLike,
} from "./shopping-storage";

const toSaveResult = (
  result: PersistenceWriteResult,
): ActiveTripSaveResult => {
  if (result.health === "healthy") {
    return { ok: true };
  }

  return {
    ok: false,
    issue: toPersistenceProblem(result.issue),
    ...(result.historyUnreadable === true ? { stage: "history-read" } : {}),
  };
};

const toPersistenceProblem = (
  issue: PersistenceIssue,
): PersistenceProblem => ({
  code: issue.code,
  storageKey: issue.storageKey,
  ...(issue.schemaVersion === undefined
    ? {}
    : { schemaVersion: issue.schemaVersion }),
});


export const createActiveTripPersistencePort = (
  storage: StorageLike | null | undefined,
): ActiveTripPersistencePort => ({
  bootstrap(): ActiveTripBootstrapResult {
    const result = bootstrapShoppingPersistence(storage);

    const historyFields =
      result.historyIssue === undefined
        ? {}
        : { historyIssue: toPersistenceProblem(result.historyIssue) };

    if (result.health === "healthy") {
      return {
        ok: true,
        activeTrip: result.activeTrip,
        completedTrips: result.completedTrips,
        completionCleanupPending:
          result.completionCleanupPending,
        ...historyFields,
      };
    }

    return {
      ok: false,
      activeTrip: result.activeTrip,
      completedTrips: result.completedTrips,
      completionCleanupPending:
        result.completionCleanupPending,
      issue: toPersistenceProblem(result.issue),
      // Only an unreadable active-trip record blocks the shopping flow.
      // History, cleanup and legacy-key problems degrade instead.
      recoveryRequired: result.activeTripUnreadable,
      ...(result.recoveryRaw === undefined
        ? {}
        : { recoveryRaw: result.recoveryRaw }),
      ...historyFields,
    };
  },

  readCompletedHistory(): CompletedHistoryReadResult {
    const result = restoreHistory(storage);

    if (result.health === "healthy") {
      return { ok: true, completedTrips: result.trips };
    }

    return {
      ok: false,
      completedTrips: result.trips,
      issue: toPersistenceProblem(result.issue),
    };
  },

  setAsideDamagedHistory(setAsideAt: IsoTimestamp): HistorySetAsideResult {
    const result = setAsideDamagedHistory(storage, setAsideAt);

    if (result.health === "healthy") {
      return { ok: true, completedTrips: result.trips };
    }

    return { ok: false, issue: toPersistenceProblem(result.issue) };
  },

  setAsideUnreadableActiveTrip(
    setAsideAt: IsoTimestamp,
  ): ActiveTripSaveResult {
    const result = setAsideUnreadableActiveTrip(storage, setAsideAt);

    if (result.health === "healthy") {
      return { ok: true };
    }

    return { ok: false, issue: toPersistenceProblem(result.issue) };
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
      return { ok: true, completedTrips: result.trips };
    }

    return {
      ok: false,
      stage: result.stage,
      issue: toPersistenceProblem(result.issue),
      historyPersisted: result.historyPersisted,
      ...(result.trips === undefined ? {} : { completedTrips: result.trips }),
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

    return toSaveResult(result);
  },

  replaceCompletedHistory(
    trips: readonly CompletedTrip[],
    savedAt: IsoTimestamp,
  ): ActiveTripSaveResult {
    return toSaveResult(replaceReadableHistory(storage, trips, savedAt));
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
