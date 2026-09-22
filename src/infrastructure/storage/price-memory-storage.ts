import { mvpMinorUnits } from "../../domain/money";
import {
  createPriceMemoryRecord,
  type PriceMemoryRecord,
} from "../../domain/price-memory";
import {
  isoTimestamp,
  type IsoTimestamp,
} from "../../domain/shopping-trip";
import type { StorageLike } from "./shopping-storage";
import {
  CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
  PRICE_MEMORY_STORAGE_KEY,
  priceMemoryDataEnvelopeV1Schema,
  priceMemoryRecordV1Schema,
  priceMemoryStorageEnvelopeHeaderSchema,
  priceMemoryStorageEnvelopeV1Schema,
  type PriceMemoryEnvelopeV1,
  type PriceMemoryRecordV1,
} from "./price-memory-storage-schema";

export type PriceMemoryPersistenceIssueCode =
  | "storage-unavailable"
  | "read-failed"
  | "malformed-json"
  | "invalid-envelope"
  | "unsupported-version"
  | "invalid-data"
  | "invalid-price-memory-entry"
  | "price-memory-conflict"
  | "serialization-failed"
  | "write-failed";

export interface PriceMemoryPersistenceIssue {
  readonly kind: "price-memory-persistence";
  readonly code: PriceMemoryPersistenceIssueCode;
  readonly storageKey: typeof PRICE_MEMORY_STORAGE_KEY;
  readonly schemaVersion?: number;
}

export type DecodePriceMemoryResult =
  | {
      readonly ok: true;
      readonly records: readonly PriceMemoryRecord[];
      readonly invalidEntryCount: number;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PriceMemoryPersistenceIssue;
    };

export type EncodePriceMemoryResult =
  | {
      readonly ok: true;
      readonly raw: string;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PriceMemoryPersistenceIssue;
    };

export type RestorePriceMemoryResult =
  | {
      readonly health: "healthy";
      readonly records: readonly PriceMemoryRecord[];
      readonly savedAt?: IsoTimestamp;
    }
  | {
      readonly health: "degraded";
      readonly records: readonly PriceMemoryRecord[];
      readonly issue: PriceMemoryPersistenceIssue;
      readonly raw?: string;
    };

export type PriceMemoryWriteResult =
  | {
      readonly health: "healthy";
      readonly savedAt?: IsoTimestamp;
    }
  | {
      readonly health: "degraded";
      readonly issue: PriceMemoryPersistenceIssue;
    };

const memoryIssue = (
  code: PriceMemoryPersistenceIssueCode,
  schemaVersion?: number,
): PriceMemoryPersistenceIssue => ({
  kind: "price-memory-persistence",
  code,
  storageKey: PRICE_MEMORY_STORAGE_KEY,
  ...(schemaVersion === undefined ? {} : { schemaVersion }),
});

const decodeRecord = (
  value: PriceMemoryRecordV1,
): PriceMemoryRecord | null => {
  const unitPriceMinor = mvpMinorUnits(value.unitPriceMinor);

  if (!unitPriceMinor.ok || unitPriceMinor.value === 0) {
    return null;
  }

  const source =
    value.source.kind === "manual"
      ? ({ kind: "manual" } as const)
      : value.source.kind === "shelf-scan"
        ? value.source.captureId === undefined
          ? ({ kind: "shelf-scan" } as const)
          : ({
              kind: "shelf-scan",
              captureId: value.source.captureId,
            } as const)
        : ({
            kind: "retailer-feed",
            provider: value.source.provider,
          } as const);

  const record = createPriceMemoryRecord({
    productId: value.productId,
    label: value.label,
    currency: value.currency,
    unitPriceMinor: unitPriceMinor.value,
    observedAt: value.observedAt,
    ...(value.storeId === undefined
      ? {}
      : { storeId: value.storeId }),
    source,
  });

  if (!record.ok || record.value.id !== value.id) {
    return null;
  }

  return record.value;
};

const toRecordV1 = (
  record: PriceMemoryRecord,
): PriceMemoryRecordV1 => ({
  id: record.id,
  productId: record.productId,
  label: record.label,
  currency: record.currency,
  unitPriceMinor: record.unitPriceMinor,
  observedAt: record.observedAt,
  ...(record.storeId === undefined
    ? {}
    : { storeId: record.storeId }),
  source: record.source,
});

const hasDuplicateIds = (
  records: readonly PriceMemoryRecord[],
): boolean => {
  const seen = new Set<string>();

  for (const record of records) {
    if (seen.has(record.id)) {
      return true;
    }

    seen.add(record.id);
  }

  return false;
};

export const decodePriceMemorySnapshot = (
  raw: string,
): DecodePriceMemoryResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      issue: memoryIssue("malformed-json"),
    };
  }

  const header = priceMemoryStorageEnvelopeHeaderSchema.safeParse(parsed);

  if (!header.success) {
    return {
      ok: false,
      issue: memoryIssue("invalid-envelope"),
    };
  }

  if (header.data.schemaVersion !== CURRENT_PRICE_MEMORY_SCHEMA_VERSION) {
    return {
      ok: false,
      issue: memoryIssue(
        "unsupported-version",
        header.data.schemaVersion,
      ),
    };
  }

  const envelope = priceMemoryStorageEnvelopeV1Schema.safeParse(parsed);

  if (!envelope.success) {
    return {
      ok: false,
      issue: memoryIssue("invalid-envelope"),
    };
  }

  const savedAt = isoTimestamp(envelope.data.savedAt);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: memoryIssue("invalid-envelope"),
    };
  }

  const data = priceMemoryDataEnvelopeV1Schema.safeParse(envelope.data.data);

  if (!data.success) {
    return {
      ok: false,
      issue: memoryIssue("invalid-data"),
    };
  }

  const records: PriceMemoryRecord[] = [];
  let invalidEntryCount = 0;

  for (const candidate of data.data.records) {
    const parsedRecord = priceMemoryRecordV1Schema.safeParse(candidate);

    if (!parsedRecord.success) {
      invalidEntryCount += 1;
      continue;
    }

    const record = decodeRecord(parsedRecord.data);

    if (record === null) {
      invalidEntryCount += 1;
      continue;
    }

    records.push(record);
  }

  if (hasDuplicateIds(records)) {
    return {
      ok: false,
      issue: memoryIssue("price-memory-conflict"),
    };
  }

  return {
    ok: true,
    records: Object.freeze(records),
    invalidEntryCount,
    savedAt: savedAt.value,
  };
};

export const encodePriceMemorySnapshot = (
  records: readonly PriceMemoryRecord[],
  savedAtInput: string,
): EncodePriceMemoryResult => {
  const savedAt = isoTimestamp(savedAtInput);

  if (!savedAt.ok || hasDuplicateIds(records)) {
    return {
      ok: false,
      issue: memoryIssue(
        hasDuplicateIds(records)
          ? "price-memory-conflict"
          : "serialization-failed",
      ),
    };
  }

  const encodedRecords: PriceMemoryRecordV1[] = [];

  for (const record of records) {
    const candidate = toRecordV1(record);
    const validated = priceMemoryRecordV1Schema.safeParse(candidate);

    if (!validated.success || decodeRecord(validated.data) === null) {
      return {
        ok: false,
        issue: memoryIssue("invalid-data"),
      };
    }

    encodedRecords.push(validated.data);
  }

  const envelope: PriceMemoryEnvelopeV1 = {
    schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
    savedAt: savedAt.value,
    data: {
      records: encodedRecords,
    },
  };

  const validatedEnvelope =
    priceMemoryStorageEnvelopeV1Schema.safeParse(envelope);

  if (!validatedEnvelope.success) {
    return {
      ok: false,
      issue: memoryIssue("serialization-failed"),
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
      issue: memoryIssue("serialization-failed"),
    };
  }
};

export const restorePriceMemory = (
  storage: StorageLike | null | undefined,
): RestorePriceMemoryResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      records: [],
      issue: memoryIssue("storage-unavailable"),
    };
  }

  let raw: string | null;

  try {
    raw = storage.getItem(PRICE_MEMORY_STORAGE_KEY);
  } catch {
    return {
      health: "degraded",
      records: [],
      issue: memoryIssue("read-failed"),
    };
  }

  if (raw === null) {
    return {
      health: "healthy",
      records: [],
    };
  }

  const decoded = decodePriceMemorySnapshot(raw);

  if (!decoded.ok) {
    return {
      health: "degraded",
      records: [],
      issue: decoded.issue,
      raw,
    };
  }

  if (decoded.invalidEntryCount > 0) {
    return {
      health: "degraded",
      records: decoded.records,
      issue: memoryIssue("invalid-price-memory-entry"),
      raw,
    };
  }

  return {
    health: "healthy",
    records: decoded.records,
    savedAt: decoded.savedAt,
  };
};

export const writePriceMemory = (
  storage: StorageLike | null | undefined,
  records: readonly PriceMemoryRecord[],
  savedAt: string,
): PriceMemoryWriteResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      issue: memoryIssue("storage-unavailable"),
    };
  }

  const encoded = encodePriceMemorySnapshot(records, savedAt);

  if (!encoded.ok) {
    return {
      health: "degraded",
      issue: encoded.issue,
    };
  }

  try {
    storage.setItem(PRICE_MEMORY_STORAGE_KEY, encoded.raw);
  } catch {
    return {
      health: "degraded",
      issue: memoryIssue("write-failed"),
    };
  }

  return {
    health: "healthy",
    savedAt: encoded.savedAt,
  };
};
