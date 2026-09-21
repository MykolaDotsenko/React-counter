import { mvpMinorUnits } from "../../domain/money";
import {
  createActiveTrip,
  createCartItem,
  isoTimestamp,
  reduceTrip,
  storeId,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
  type PriceConfidence,
  type PriceSource,
} from "../../domain/shopping-trip";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  CURRENT_ACTIVE_TRIP_SCHEMA_VERSION,
  CURRENT_HISTORY_SCHEMA_VERSION,
  HISTORY_STORAGE_KEY,
  LEGACY_PULSE_STORAGE_KEYS,
  activeTripDataV1Schema,
  activeTripDataV2Schema,
  completedTripDataV1Schema,
  completedTripDataV2Schema,
  historyDataEnvelopeV1Schema,
  historyStorageEnvelopeV1Schema,
  historyStorageEnvelopeV2Schema,
  storageEnvelopeHeaderSchema,
  storageEnvelopeV1Schema,
  storageEnvelopeV2Schema,
  type ActiveTripDataV1,
  type ActiveTripDataV2,
  type ActiveTripEnvelopeV2,
  type CompletedTripDataV1,
  type CompletedTripDataV2,
  type HistoryEnvelopeV2,
  type PriceConfidenceV1,
  type PriceSourceV1,
} from "./shopping-storage-schema";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type PersistenceHealth = "healthy" | "degraded";

export type PersistenceIssueCode =
  | "storage-unavailable"
  | "read-failed"
  | "malformed-json"
  | "invalid-envelope"
  | "unsupported-version"
  | "invalid-data"
  | "serialization-failed"
  | "write-failed"
  | "remove-failed"
  | "history-conflict"
  | "invalid-history-entry"
  | "legacy-retirement-failed";

export interface PersistenceIssue {
  readonly kind: "persistence";
  readonly code: PersistenceIssueCode;
  readonly storageKey: string;
  readonly schemaVersion?: number;
}

export type DecodeActiveTripResult =
  | {
      readonly ok: true;
      readonly trip: ActiveTrip;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceIssue;
    };

export type EncodeActiveTripResult =
  | {
      readonly ok: true;
      readonly raw: string;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceIssue;
    };

export type DecodeHistoryResult =
  | {
      readonly ok: true;
      readonly trips: readonly CompletedTrip[];
      readonly invalidEntryCount: number;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceIssue;
    };

export type EncodeHistoryResult =
  | {
      readonly ok: true;
      readonly raw: string;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceIssue;
    };

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

const persistenceIssue = (
  code: PersistenceIssueCode,
  storageKey = ACTIVE_TRIP_STORAGE_KEY,
  schemaVersion?: number,
): PersistenceIssue => ({
  kind: "persistence",
  code,
  storageKey,
  ...(schemaVersion === undefined ? {} : { schemaVersion }),
});

const decodePriceSource = (source: PriceSourceV1): PriceSource => {
  switch (source.kind) {
    case "manual":
      return { kind: "manual" };

    case "price-memory":
      return {
        kind: "price-memory",
        memoryId: source.memoryId,
      };

    case "shelf-scan":
      return source.captureId === undefined
        ? { kind: "shelf-scan" }
        : {
            kind: "shelf-scan",
            captureId: source.captureId,
          };

    case "encoded-barcode":
      return {
        kind: "encoded-barcode",
        symbology: source.symbology,
      };

    case "retailer-feed":
      return {
        kind: "retailer-feed",
        provider: source.provider,
      };

    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
};

const decodePriceConfidence = (
  confidence: PriceConfidenceV1,
): PriceConfidence | null => {
  switch (confidence.kind) {
    case "confirmed": {
      const confirmedAt = isoTimestamp(confidence.confirmedAt);

      if (!confirmedAt.ok) {
        return null;
      }

      return {
        kind: "confirmed",
        confirmedAt: confirmedAt.value,
      };
    }

    case "remembered": {
      const observedAt = isoTimestamp(confidence.observedAt);

      if (!observedAt.ok) {
        return null;
      }

      if (confidence.storeId === undefined) {
        return {
          kind: "remembered",
          observedAt: observedAt.value,
        };
      }

      const decodedStoreId = storeId(confidence.storeId);

      if (!decodedStoreId.ok) {
        return null;
      }

      return {
        kind: "remembered",
        observedAt: observedAt.value,
        storeId: decodedStoreId.value,
      };
    }

    case "estimated":
      return confidence.reason === undefined
        ? { kind: "estimated" }
        : {
            kind: "estimated",
            reason: confidence.reason,
          };

    default: {
      const exhaustive: never = confidence;
      return exhaustive;
    }
  }
};

type ActiveTripData = ActiveTripDataV1 | ActiveTripDataV2;
type CompletedTripData = CompletedTripDataV1 | CompletedTripDataV2;

const decodeActiveTripData = (
  data: ActiveTripData,
): ActiveTrip | null => {
  const budgetMinor = mvpMinorUnits(data.budgetMinor);
  const safetyBufferMinor = mvpMinorUnits(data.safetyBufferMinor);

  if (!budgetMinor.ok || !safetyBufferMinor.ok) {
    return null;
  }

  const tripResult = createActiveTrip({
    id: data.id,
    currency: data.currency,
    budgetMinor: budgetMinor.value,
    safetyBufferMinor: safetyBufferMinor.value,
    ...("store" in data && data.store !== undefined
      ? { store: data.store }
      : {}),
    startedAt: data.startedAt,
  });

  if (!tripResult.ok) {
    return null;
  }

  let trip: ActiveTrip = tripResult.value;

  for (const item of data.items) {
    const unitPriceMinor = mvpMinorUnits(item.unitPriceMinor);

    if (!unitPriceMinor.ok) {
      return null;
    }

    const priceConfidence = decodePriceConfidence(item.priceConfidence);

    if (priceConfidence === null) {
      return null;
    }

    const itemResult = createCartItem({
      id: item.id,
      unitPriceMinor: unitPriceMinor.value,
      quantity: item.quantity,
      ...(item.label === undefined ? {} : { label: item.label }),
      priceSource: decodePriceSource(item.priceSource),
      priceConfidence,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });

    if (!itemResult.ok) {
      return null;
    }

    const nextTrip = reduceTrip(trip, {
      type: "add-item",
      item: itemResult.value,
    });

    if (!nextTrip.ok || nextTrip.value.status !== "active") {
      return null;
    }

    trip = nextTrip.value;
  }

  return trip;
};

const toActiveTripDataV2 = (trip: ActiveTrip): ActiveTripDataV2 => ({
  id: trip.id,
  status: "active",
  currency: trip.currency,
  budgetMinor: trip.budgetMinor,
  safetyBufferMinor: trip.safetyBufferMinor,
  ...(trip.store === undefined ? {} : { store: trip.store }),
  startedAt: trip.startedAt,
  items: trip.items.map((item) => ({
    id: item.id,
    unitPriceMinor: item.unitPriceMinor,
    quantity: item.quantity,
    ...(item.label === undefined ? {} : { label: item.label }),
    priceSource: item.priceSource,
    priceConfidence: item.priceConfidence,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
});


const decodeCompletedTripData = (
  data: CompletedTripData,
): CompletedTrip | null => {
  const active = decodeActiveTripData({
    id: data.id,
    status: "active",
    currency: data.currency,
    budgetMinor: data.budgetMinor,
    safetyBufferMinor: data.safetyBufferMinor,
    ...("store" in data && data.store !== undefined
      ? { store: data.store }
      : {}),
    startedAt: data.startedAt,
    items: data.items,
  });

  if (active === null) {
    return null;
  }

  const completedAt = isoTimestamp(data.completedAt);

  if (!completedAt.ok) {
    return null;
  }

  const completed = reduceTrip(active, {
    type: "complete-trip",
    completedAt: completedAt.value,
  });

  if (!completed.ok || completed.value.status !== "completed") {
    return null;
  }

  if (data.actualCheckoutMinor === undefined) {
    return completed.value;
  }

  const actualCheckoutMinor = mvpMinorUnits(data.actualCheckoutMinor);

  if (!actualCheckoutMinor.ok) {
    return null;
  }

  const reconciled = reduceTrip(completed.value, {
    type: "set-actual-checkout",
    actualCheckoutMinor: actualCheckoutMinor.value,
  });

  if (!reconciled.ok || reconciled.value.status !== "completed") {
    return null;
  }

  return reconciled.value;
};

const toCompletedTripDataV2 = (
  trip: CompletedTrip,
): CompletedTripDataV2 => ({
  id: trip.id,
  status: "completed",
  currency: trip.currency,
  budgetMinor: trip.budgetMinor,
  safetyBufferMinor: trip.safetyBufferMinor,
  ...(trip.store === undefined ? {} : { store: trip.store }),
  startedAt: trip.startedAt,
  completedAt: trip.completedAt,
  ...(trip.actualCheckoutMinor === undefined
    ? {}
    : { actualCheckoutMinor: trip.actualCheckoutMinor }),
  items: trip.items.map((item) => ({
    id: item.id,
    unitPriceMinor: item.unitPriceMinor,
    quantity: item.quantity,
    ...(item.label === undefined ? {} : { label: item.label }),
    priceSource: item.priceSource,
    priceConfidence: item.priceConfidence,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  })),
});

const sameCompletedTrip = (
  left: CompletedTrip,
  right: CompletedTrip,
): boolean =>
  JSON.stringify(toCompletedTripDataV2(left)) ===
  JSON.stringify(toCompletedTripDataV2(right));

const hasDuplicateTripIds = (
  trips: readonly CompletedTrip[],
): boolean => {
  const seen = new Set<string>();

  for (const trip of trips) {
    if (seen.has(trip.id)) {
      return true;
    }

    seen.add(trip.id);
  }

  return false;
};



export const decodeHistorySnapshot = (
  raw: string,
): DecodeHistoryResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      issue: persistenceIssue("malformed-json", HISTORY_STORAGE_KEY),
    };
  }

  const header = storageEnvelopeHeaderSchema.safeParse(parsed);

  if (!header.success) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-envelope", HISTORY_STORAGE_KEY),
    };
  }

  if (header.data.schemaVersion !== CURRENT_HISTORY_SCHEMA_VERSION) {
    return {
      ok: false,
      issue: persistenceIssue(
        "unsupported-version",
        HISTORY_STORAGE_KEY,
        header.data.schemaVersion,
      ),
    };
  }

  const envelope = historyStorageEnvelopeV1Schema.safeParse(parsed);

  if (!envelope.success) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-envelope", HISTORY_STORAGE_KEY),
    };
  }

  const savedAt = isoTimestamp(envelope.data.savedAt);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-envelope", HISTORY_STORAGE_KEY),
    };
  }

  const data = historyDataEnvelopeV1Schema.safeParse(envelope.data.data);

  if (!data.success) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-data", HISTORY_STORAGE_KEY),
    };
  }

  const trips: CompletedTrip[] = [];
  let invalidEntryCount = 0;

  for (const candidate of data.data.trips) {
    const parsedTrip = completedTripDataV1Schema.safeParse(candidate);

    if (!parsedTrip.success) {
      invalidEntryCount += 1;
      continue;
    }

    const trip = decodeCompletedTripData(parsedTrip.data);

    if (trip === null) {
      invalidEntryCount += 1;
      continue;
    }

    trips.push(trip);
  }

  if (hasDuplicateTripIds(trips)) {
    return {
      ok: false,
      issue: persistenceIssue("history-conflict", HISTORY_STORAGE_KEY),
    };
  }

  return {
    ok: true,
    trips,
    invalidEntryCount,
    savedAt: savedAt.value,
  };
};

export const encodeHistorySnapshot = (
  trips: readonly CompletedTrip[],
  savedAtInput: string,
): EncodeHistoryResult => {
  const savedAt = isoTimestamp(savedAtInput);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: persistenceIssue(
        "serialization-failed",
        HISTORY_STORAGE_KEY,
      ),
    };
  }

  if (hasDuplicateTripIds(trips)) {
    return {
      ok: false,
      issue: persistenceIssue("history-conflict", HISTORY_STORAGE_KEY),
    };
  }

  const encodedTrips: CompletedTripDataV1[] = [];

  for (const trip of trips) {
    const candidate = toCompletedTripDataV2(trip);
    const validated = completedTripDataV1Schema.safeParse(candidate);

    if (!validated.success || decodeCompletedTripData(candidate) === null) {
      return {
        ok: false,
        issue: persistenceIssue("invalid-data", HISTORY_STORAGE_KEY),
      };
    }

    encodedTrips.push(validated.data);
  }

  const envelope: HistoryEnvelopeV1 = {
    schemaVersion: CURRENT_HISTORY_SCHEMA_VERSION,
    savedAt: savedAt.value,
    data: {
      trips: encodedTrips,
    },
  };

  const validatedEnvelope = historyStorageEnvelopeV1Schema.safeParse(envelope);

  if (!validatedEnvelope.success) {
    return {
      ok: false,
      issue: persistenceIssue(
        "serialization-failed",
        HISTORY_STORAGE_KEY,
      ),
    };
  }

  try {
    return {
      ok: true,
      raw: JSON.stringify(envelope),
      savedAt: savedAt.value,
    };
  } catch {
    return {
      ok: false,
      issue: persistenceIssue(
        "serialization-failed",
        HISTORY_STORAGE_KEY,
      ),
    };
  }
};

export const decodeActiveTripSnapshot = (
  raw: string,
): DecodeActiveTripResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      issue: persistenceIssue("malformed-json"),
    };
  }

  const header = storageEnvelopeHeaderSchema.safeParse(parsed);

  if (!header.success) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-envelope"),
    };
  }

  if (header.data.schemaVersion > CURRENT_ACTIVE_TRIP_SCHEMA_VERSION) {
    return {
      ok: false,
      issue: persistenceIssue(
        "unsupported-version",
        ACTIVE_TRIP_STORAGE_KEY,
        header.data.schemaVersion,
      ),
    };
  }

  if (header.data.schemaVersion !== CURRENT_ACTIVE_TRIP_SCHEMA_VERSION) {
    return {
      ok: false,
      issue: persistenceIssue(
        "unsupported-version",
        ACTIVE_TRIP_STORAGE_KEY,
        header.data.schemaVersion,
      ),
    };
  }

  const envelope = storageEnvelopeV1Schema.safeParse(parsed);

  if (!envelope.success) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-envelope"),
    };
  }

  const savedAt = isoTimestamp(envelope.data.savedAt);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-envelope"),
    };
  }

  const data = activeTripDataV1Schema.safeParse(envelope.data.data);

  if (!data.success) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-data"),
    };
  }

  const trip = decodeActiveTripData(data.data);

  if (trip === null) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-data"),
    };
  }

  return {
    ok: true,
    trip,
    savedAt: savedAt.value,
  };
};

export const encodeActiveTripSnapshot = (
  trip: ActiveTrip,
  savedAtInput: string,
): EncodeActiveTripResult => {
  const savedAt = isoTimestamp(savedAtInput);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: persistenceIssue("serialization-failed"),
    };
  }

  const candidateData = toActiveTripDataV1(trip);
  const validatedData = activeTripDataV1Schema.safeParse(candidateData);

  if (!validatedData.success || decodeActiveTripData(candidateData) === null) {
    return {
      ok: false,
      issue: persistenceIssue("invalid-data"),
    };
  }

  const envelope: ActiveTripEnvelopeV1 = {
    schemaVersion: CURRENT_ACTIVE_TRIP_SCHEMA_VERSION,
    savedAt: savedAt.value,
    data: validatedData.data,
  };

  const validatedEnvelope = storageEnvelopeV1Schema.safeParse(envelope);

  if (!validatedEnvelope.success) {
    return {
      ok: false,
      issue: persistenceIssue("serialization-failed"),
    };
  }

  try {
    return {
      ok: true,
      raw: JSON.stringify(envelope),
      savedAt: savedAt.value,
    };
  } catch {
    return {
      ok: false,
      issue: persistenceIssue("serialization-failed"),
    };
  }
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

export const retireLegacyPulseKeys = (
  storage: StorageLike | null | undefined,
): LegacyRetirementResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      retired: false,
      issue: persistenceIssue(
        "storage-unavailable",
        LEGACY_PULSE_STORAGE_KEYS[0],
      ),
    };
  }

  let failedKey: string | null = null;

  for (const key of LEGACY_PULSE_STORAGE_KEYS) {
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

  const retirement = retireLegacyPulseKeys(storage);

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
