import type {
  ActiveTrip,
  CompletedTrip,
  IsoTimestamp,
} from "../../domain/shopping-trip";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  HISTORICAL_NON_SHOPPING_STORAGE_KEYS,
} from "./shopping-storage-schema";
import {
  decodeActiveTripSnapshot,
  decodeHistorySnapshot,
  encodeActiveTripSnapshot,
  encodeHistorySnapshot,
  persistenceIssue,
  sameCompletedTrip,
  type PersistenceIssue,
} from "./shopping-storage-codec";

export {
  decodeActiveTripSnapshot,
  decodeHistorySnapshot,
  encodeActiveTripSnapshot,
  encodeHistorySnapshot,
} from "./shopping-storage-codec";

export type {
  DecodeActiveTripResult,
  DecodeHistoryResult,
  EncodeActiveTripResult,
  EncodeHistoryResult,
  PersistenceIssue,
  PersistenceIssueCode,
} from "./shopping-storage-codec";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PersistenceHealth = "healthy" | "degraded";

export type RestoreHistoryResult =
  | {
      readonly health: "healthy";
      readonly trips: readonly CompletedTrip[];
      readonly savedAt?: IsoTimestamp;
    }
  | {
      readonly health: "degraded";
      readonly trips: readonly CompletedTrip[];
      readonly issue: PersistenceIssue;
      readonly raw?: string;
    };

export type CompletionPersistenceResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly stage: "history-write" | "active-clear";
      readonly issue: PersistenceIssue;
      readonly historyPersisted: boolean;
    };

export type RestoreActiveTripResult =
  | {
      readonly health: "healthy";
      readonly status: "empty";
      readonly trip: null;
    }
  | {
      readonly health: "healthy";
      readonly status: "restored";
      readonly trip: ActiveTrip;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly health: "degraded";
      readonly status: "recovery-required";
      readonly trip: null;
      readonly issue: PersistenceIssue;
      readonly raw?: string;
    };

export type PersistenceWriteResult =
  | {
      readonly health: "healthy";
      readonly savedAt?: IsoTimestamp;
    }
  | {
      readonly health: "degraded";
      readonly issue: PersistenceIssue;
    };

export type LegacyRetirementResult =
  | {
      readonly health: "healthy";
      readonly retired: true;
    }
  | {
      readonly health: "degraded";
      readonly retired: false;
      readonly issue: PersistenceIssue;
    };

export type ShoppingPersistenceBootstrap =
  | {
      readonly health: "healthy";
      readonly activeTrip: ActiveTrip | null;
      readonly completedTrips: readonly CompletedTrip[];
      readonly legacyKeysRetired: true;
      readonly restoredSavedAt?: IsoTimestamp;
      readonly historySavedAt?: IsoTimestamp;
      readonly reconciledCompletion?: true;
      readonly completionCleanupPending: boolean;
    }
  | {
      readonly health: "degraded";
      readonly activeTrip: ActiveTrip | null;
      readonly completedTrips: readonly CompletedTrip[];
      readonly legacyKeysRetired: boolean;
      readonly issue: PersistenceIssue;
      readonly recoveryRaw?: string;
      readonly restoredSavedAt?: IsoTimestamp;
      readonly historySavedAt?: IsoTimestamp;
      readonly reconciledCompletion?: true;
      readonly completionCleanupPending: boolean;
    };

export const restoreActiveTrip = (
  storage: StorageLike | null | undefined,
): RestoreActiveTripResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      status: "recovery-required",
      trip: null,
      issue: persistenceIssue("storage-unavailable"),
    };
  }

  let raw: string | null;

  try {
    raw = storage.getItem(ACTIVE_TRIP_STORAGE_KEY);
  } catch {
    return {
      health: "degraded",
      status: "recovery-required",
      trip: null,
      issue: persistenceIssue("read-failed"),
    };
  }

  if (raw === null) {
    return {
      health: "healthy",
      status: "empty",
      trip: null,
    };
  }

  const decoded = decodeActiveTripSnapshot(raw);

  if (!decoded.ok) {
    return {
      health: "degraded",
      status: "recovery-required",
      trip: null,
      issue: decoded.issue,
      raw,
    };
  }

  return {
    health: "healthy",
    status: "restored",
    trip: decoded.trip,
    savedAt: decoded.savedAt,
  };
};

export const restoreHistory = (
  storage: StorageLike | null | undefined,
): RestoreHistoryResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      trips: [],
      issue: persistenceIssue(
        "storage-unavailable",
        HISTORY_STORAGE_KEY,
      ),
    };
  }

  let raw: string | null;

  try {
    raw = storage.getItem(HISTORY_STORAGE_KEY);
  } catch {
    return {
      health: "degraded",
      trips: [],
      issue: persistenceIssue("read-failed", HISTORY_STORAGE_KEY),
    };
  }

  if (raw === null) {
    return {
      health: "healthy",
      trips: [],
    };
  }

  const decoded = decodeHistorySnapshot(raw);

  if (!decoded.ok) {
    return {
      health: "degraded",
      trips: [],
      issue: decoded.issue,
      raw,
    };
  }

  if (decoded.invalidEntryCount > 0) {
    return {
      health: "degraded",
      trips: decoded.trips,
      issue: persistenceIssue(
        "invalid-history-entry",
        HISTORY_STORAGE_KEY,
      ),
      raw,
    };
  }

  return {
    health: "healthy",
    trips: decoded.trips,
    savedAt: decoded.savedAt,
  };
};

export const writeHistory = (
  storage: StorageLike | null | undefined,
  trips: readonly CompletedTrip[],
  savedAt: string,
): PersistenceWriteResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      issue: persistenceIssue(
        "storage-unavailable",
        HISTORY_STORAGE_KEY,
      ),
    };
  }

  const encoded = encodeHistorySnapshot(trips, savedAt);

  if (!encoded.ok) {
    return {
      health: "degraded",
      issue: encoded.issue,
    };
  }

  try {
    storage.setItem(HISTORY_STORAGE_KEY, encoded.raw);
  } catch {
    return {
      health: "degraded",
      issue: persistenceIssue("write-failed", HISTORY_STORAGE_KEY),
    };
  }

  return {
    health: "healthy",
    savedAt: encoded.savedAt,
  };
};

const appendCompletedTripForCompletion = (
  history: readonly CompletedTrip[],
  trip: CompletedTrip,
):
  | { readonly ok: true; readonly trips: readonly CompletedTrip[] }
  | { readonly ok: false; readonly issue: PersistenceIssue } => {
  const existing = history.find((candidate) => candidate.id === trip.id);

  if (existing === undefined) {
    return {
      ok: true,
      trips: [...history, trip],
    };
  }

  if (!sameCompletedTrip(existing, trip)) {
    return {
      ok: false,
      issue: persistenceIssue("history-conflict", HISTORY_STORAGE_KEY),
    };
  }

  return {
    ok: true,
    trips: history,
  };
};

export const completeTripPersistence = (
  storage: StorageLike | null | undefined,
  trip: CompletedTrip,
  savedAt: string,
): CompletionPersistenceResult => {
  const history = restoreHistory(storage);

  if (history.health === "degraded") {
    return {
      ok: false,
      stage: "history-write",
      issue: history.issue,
      historyPersisted: false,
    };
  }

  const appended = appendCompletedTripForCompletion(history.trips, trip);

  if (!appended.ok) {
    return {
      ok: false,
      stage: "history-write",
      issue: appended.issue,
      historyPersisted: false,
    };
  }

  const historyWrite = writeHistory(storage, appended.trips, savedAt);

  if (historyWrite.health === "degraded") {
    return {
      ok: false,
      stage: "history-write",
      issue: historyWrite.issue,
      historyPersisted: false,
    };
  }

  const activeClear = clearActiveTrip(storage);

  if (activeClear.health === "degraded") {
    return {
      ok: false,
      stage: "active-clear",
      issue: activeClear.issue,
      historyPersisted: true,
    };
  }

  return { ok: true };
};

export const updateCompletedTripPersistence = (
  storage: StorageLike | null | undefined,
  trip: CompletedTrip,
  savedAt: string,
): PersistenceWriteResult => {
  const history = restoreHistory(storage);

  if (history.health === "degraded") {
    return {
      health: "degraded",
      issue: history.issue,
    };
  }

  const index = history.trips.findIndex(
    (candidate) => candidate.id === trip.id,
  );

  if (index < 0) {
    return {
      health: "degraded",
      issue: persistenceIssue("history-conflict", HISTORY_STORAGE_KEY),
    };
  }

  const nextTrips = history.trips.map((candidate, candidateIndex) =>
    candidateIndex === index ? trip : candidate,
  );

  return writeHistory(storage, nextTrips, savedAt);
};

export const writeActiveTrip = (
  storage: StorageLike | null | undefined,
  trip: ActiveTrip,
  savedAt: string,
): PersistenceWriteResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      issue: persistenceIssue("storage-unavailable"),
    };
  }

  const encoded = encodeActiveTripSnapshot(trip, savedAt);

  if (!encoded.ok) {
    return {
      health: "degraded",
      issue: encoded.issue,
    };
  }

  try {
    storage.setItem(ACTIVE_TRIP_STORAGE_KEY, encoded.raw);
  } catch {
    return {
      health: "degraded",
      issue: persistenceIssue("write-failed"),
    };
  }

  return {
    health: "healthy",
    savedAt: encoded.savedAt,
  };
};

export const clearActiveTrip = (
  storage: StorageLike | null | undefined,
): PersistenceWriteResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      issue: persistenceIssue("storage-unavailable"),
    };
  }

  try {
    storage.removeItem(ACTIVE_TRIP_STORAGE_KEY);
  } catch {
    return {
      health: "degraded",
      issue: persistenceIssue("remove-failed"),
    };
  }

  return {
    health: "healthy",
  };
};

export const retireHistoricalNonShoppingKeys = (
  storage: StorageLike | null | undefined,
): LegacyRetirementResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      retired: false,
      issue: persistenceIssue(
        "storage-unavailable",
        HISTORICAL_NON_SHOPPING_STORAGE_KEYS[0],
      ),
    };
  }

  let failedKey: string | null = null;

  for (const key of HISTORICAL_NON_SHOPPING_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      failedKey ??= key;
    }
  }

  if (failedKey !== null) {
    return {
      health: "degraded",
      retired: false,
      issue: persistenceIssue("legacy-retirement-failed", failedKey),
    };
  }

  return {
    health: "healthy",
    retired: true,
  };
};

export const bootstrapShoppingPersistence = (
  storage: StorageLike | null | undefined,
): ShoppingPersistenceBootstrap => {
  const restored = restoreActiveTrip(storage);
  const history = restoreHistory(storage);

  if (restored.health === "degraded") {
    return {
      health: "degraded",
      activeTrip: null,
      completedTrips: history.trips,
      legacyKeysRetired: false,
      completionCleanupPending: false,
      issue: restored.issue,
      ...(restored.raw === undefined
        ? {}
        : { recoveryRaw: restored.raw }),
      ...(history.health === "healthy" && history.savedAt !== undefined
        ? { historySavedAt: history.savedAt }
        : {}),
    };
  }

  let activeTrip = restored.trip;
  let reconciledCompletion = false;
  let reconciliationIssue: PersistenceIssue | null = null;

  if (
    activeTrip !== null &&
    history.trips.some((trip) => trip.id === activeTrip?.id)
  ) {
    const clearResult = clearActiveTrip(storage);
    activeTrip = null;
    reconciledCompletion = true;

    if (clearResult.health === "degraded") {
      reconciliationIssue = clearResult.issue;
    }
  }

  if (history.health === "degraded") {
    return {
      health: "degraded",
      activeTrip,
      completedTrips: history.trips,
      legacyKeysRetired: false,
      completionCleanupPending: reconciliationIssue !== null,
      issue: reconciliationIssue ?? history.issue,
      ...(restored.status === "restored"
        ? { restoredSavedAt: restored.savedAt }
        : {}),
      ...(reconciledCompletion ? { reconciledCompletion: true } : {}),
    };
  }

  const retirement = retireHistoricalNonShoppingKeys(storage);

  if (reconciliationIssue !== null) {
    return {
      health: "degraded",
      activeTrip,
      completedTrips: history.trips,
      legacyKeysRetired: retirement.health === "healthy",
      completionCleanupPending: true,
      issue: reconciliationIssue,
      ...(restored.status === "restored"
        ? { restoredSavedAt: restored.savedAt }
        : {}),
      ...(history.savedAt === undefined
        ? {}
        : { historySavedAt: history.savedAt }),
      ...(reconciledCompletion ? { reconciledCompletion: true } : {}),
    };
  }

  if (retirement.health === "degraded") {
    return {
      health: "degraded",
      activeTrip,
      completedTrips: history.trips,
      legacyKeysRetired: false,
      completionCleanupPending: false,
      issue: retirement.issue,
      ...(restored.status === "restored"
        ? { restoredSavedAt: restored.savedAt }
        : {}),
      ...(history.savedAt === undefined
        ? {}
        : { historySavedAt: history.savedAt }),
      ...(reconciledCompletion ? { reconciledCompletion: true } : {}),
    };
  }

  return {
    health: "healthy",
    activeTrip,
    completedTrips: history.trips,
    legacyKeysRetired: true,
    completionCleanupPending: false,
    ...(restored.status === "restored"
      ? { restoredSavedAt: restored.savedAt }
      : {}),
    ...(history.savedAt === undefined
      ? {}
      : { historySavedAt: history.savedAt }),
    ...(reconciledCompletion ? { reconciledCompletion: true } : {}),
  };
};
