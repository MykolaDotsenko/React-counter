import {
  createPriceMemoryRecord,
  type PriceMemoryRecord,
} from "../../domain/price-memory";
import { isoTimestamp, type IsoTimestamp } from "../../domain/shopping-trip";
import {
  type PersistenceIssue,
  type PersistenceWriteResult,
  type StorageLike,
} from "./shopping-storage";
import {
  CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
  PRICE_MEMORY_STORAGE_KEY,
  observedPriceSourceV1Schema,
  priceMemoryDataV1Schema,
  priceMemoryEnvelopeV1Schema,
  priceMemoryRecordV1Schema,
  type PriceMemoryEnvelopeV1,
  type PriceMemoryRecordV1,
} from "./price-memory-storage-schema";

export type RestorePriceMemoryResult =
  | {
      readonly health: "healthy";
      readonly records: readonly PriceMemoryRecord[];
      readonly savedAt?: IsoTimestamp;
    }
  | {
      readonly health: "degraded";
      readonly records: readonly PriceMemoryRecord[];
      readonly issue: PersistenceIssue;
      readonly raw?: string;
      readonly savedAt?: IsoTimestamp;
    };

const issue = (
  code: PersistenceIssue["code"],
  schemaVersion?: number,
): PersistenceIssue => ({
  kind: "persistence",
  code,
  storageKey: PRICE_MEMORY_STORAGE_KEY,
  ...(schemaVersion === undefined ? {} : { schemaVersion }),
});

const recordKey = (record: PriceMemoryRecord): string =>
  `${record.product.id}::${record.store?.id ?? ""}`;

const validateUniqueRecords = (
  records: readonly PriceMemoryRecord[],
): boolean => {
  const ids = new Set<string>();
  const slots = new Set<string>();

  for (const record of records) {
    if (ids.has(record.id)) {
      return false;
    }

    const slot = recordKey(record);

    if (slots.has(slot)) {
      return false;
    }

    ids.add(record.id);
    slots.add(slot);
  }

  return true;
};

const decodeRecord = (
  data: PriceMemoryRecordV1,
): PriceMemoryRecord | null => {
  const source = observedPriceSourceV1Schema.safeParse(data.source);

  if (!source.success) {
    return null;
  }

  const result = createPriceMemoryRecord({
    id: data.id,
    productId: data.product.id,
    label: data.product.label,
    unitPriceMinor: data.unitPriceMinor,
    observedAt: data.observedAt,
    ...(data.store === undefined ? {} : { store: data.store }),
    source: source.data,
  });

  return result.ok ? result.value : null;
};

const encodeRecord = (
  record: PriceMemoryRecord,
): PriceMemoryRecordV1 => ({
  id: record.id,
  product: {
    id: record.product.id,
    label: record.product.label,
  },
  unitPriceMinor: record.unitPriceMinor,
  observedAt: record.observedAt,
  ...(record.store === undefined ? {} : { store: record.store }),
  source: record.source,
});

export const decodePriceMemorySnapshot = (
  raw: string,
):
  | {
      readonly ok: true;
      readonly records: readonly PriceMemoryRecord[];
      readonly invalidEntryCount: number;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceIssue;
    } => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      issue: issue("malformed-json"),
    };
  }

  const envelope = priceMemoryEnvelopeV1Schema.safeParse(parsed);

  if (!envelope.success) {
    const version =
      typeof parsed === "object" &&
      parsed !== null &&
      "schemaVersion" in parsed &&
      typeof parsed.schemaVersion === "number"
        ? parsed.schemaVersion
        : undefined;

    return {
      ok: false,
      issue:
        version !== undefined &&
        version !== CURRENT_PRICE_MEMORY_SCHEMA_VERSION
          ? issue("unsupported-version", version)
          : issue("invalid-envelope"),
    };
  }

  const savedAt = isoTimestamp(envelope.data.savedAt);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: issue("invalid-envelope"),
    };
  }

  const data = priceMemoryDataV1Schema.safeParse(envelope.data.data);

  if (!data.success) {
    return {
      ok: false,
      issue: issue("invalid-data"),
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

  if (!validateUniqueRecords(records)) {
    return {
      ok: false,
      issue: issue("price-memory-conflict"),
    };
  }

  return {
    ok: true,
    records,
    invalidEntryCount,
    savedAt: savedAt.value,
  };
};

export const encodePriceMemorySnapshot = (
  records: readonly PriceMemoryRecord[],
  savedAtInput: string,
):
  | {
      readonly ok: true;
      readonly raw: string;
      readonly savedAt: IsoTimestamp;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceIssue;
    } => {
  const savedAt = isoTimestamp(savedAtInput);

  if (!savedAt.ok) {
    return {
      ok: false,
      issue: issue("serialization-failed"),
    };
  }

  if (!validateUniqueRecords(records)) {
    return {
      ok: false,
      issue: issue("price-memory-conflict"),
    };
  }

  const encodedRecords: PriceMemoryRecordV1[] = [];

  for (const record of records) {
    const candidate = encodeRecord(record);
    const parsed = priceMemoryRecordV1Schema.safeParse(candidate);

    if (!parsed.success || decodeRecord(candidate) === null) {
      return {
        ok: false,
        issue: issue("invalid-data"),
      };
    }

    encodedRecords.push(parsed.data);
  }

  const envelope: PriceMemoryEnvelopeV1 = {
    schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
    savedAt: savedAt.value,
    data: {
      records: encodedRecords,
    },
  };

  const validated = priceMemoryEnvelopeV1Schema.safeParse(envelope);

  if (!validated.success) {
    return {
      ok: false,
      issue: issue("serialization-failed"),
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
      issue: issue("serialization-failed"),
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
      issue: issue("storage-unavailable"),
    };
  }

  let raw: string | null;

  try {
    raw = storage.getItem(PRICE_MEMORY_STORAGE_KEY);
  } catch {
    return {
      health: "degraded",
      records: [],
      issue: issue("read-failed"),
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
      issue: issue("invalid-price-memory-entry"),
      raw,
      savedAt: decoded.savedAt,
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
): PersistenceWriteResult => {
  if (storage === null || storage === undefined) {
    return {
      health: "degraded",
      issue: issue("storage-unavailable"),
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
      issue: issue("write-failed"),
    };
  }

  return {
    health: "healthy",
    savedAt: encoded.savedAt,
  };
};
