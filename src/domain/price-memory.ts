import {
  mvpMinorUnits,
  type MinorUnits,
  type Result,
} from "./money";
import {
  MAX_ITEM_LABEL_CODE_POINTS,
  createStoreContext,
  isoTimestamp,
  type IsoTimestamp,
  type PriceSource,
  type StoreContext,
  type StoreId,
} from "./shopping-trip";

type Brand<T, B extends string> = T & { readonly __brand: B };

export type ProductId = Brand<string, "ProductId">;
export type PriceMemoryId = Brand<string, "PriceMemoryId">;

export type ObservedPriceSource = Exclude<
  PriceSource,
  { readonly kind: "price-memory" }
>;

export interface ProductIdentity {
  readonly id: ProductId;
  readonly label: string;
}

export interface PriceMemoryRecord {
  readonly id: PriceMemoryId;
  readonly product: ProductIdentity;
  readonly unitPriceMinor: number;
  readonly observedAt: IsoTimestamp;
  readonly store?: StoreContext;
  readonly source: ObservedPriceSource;
}

export type PriceMemoryErrorCode =
  | "invalid-id"
  | "invalid-label"
  | "invalid-price"
  | "invalid-timestamp"
  | "invalid-store"
  | "invalid-source";

export interface PriceMemoryError {
  readonly kind: "price-memory";
  readonly code: PriceMemoryErrorCode;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

const failure = (
  code: PriceMemoryErrorCode,
): Result<never, PriceMemoryError> => ({
  ok: false,
  error: { kind: "price-memory", code },
});

const normalizeIdentifier = <T extends ProductId | PriceMemoryId>(
  value: string,
): Result<T, PriceMemoryError> => {
  const normalized = value.trim();

  return normalized === ""
    ? failure("invalid-id")
    : ok(normalized as T);
};

const normalizeProductLabel = (
  value: string,
): Result<string, PriceMemoryError> => {
  const normalized = value.trim();

  if (
    normalized === "" ||
    [...normalized].length > MAX_ITEM_LABEL_CODE_POINTS
  ) {
    return failure("invalid-label");
  }

  return ok(normalized);
};

export const productId = (
  value: string,
): Result<ProductId, PriceMemoryError> =>
  normalizeIdentifier<ProductId>(value);

export const priceMemoryId = (
  value: string,
): Result<PriceMemoryId, PriceMemoryError> =>
  normalizeIdentifier<PriceMemoryId>(value);

export const createProductIdentity = (
  input: { readonly id: string; readonly label: string },
): Result<ProductIdentity, PriceMemoryError> => {
  const idResult = productId(input.id);

  if (!idResult.ok) {
    return idResult;
  }

  const labelResult = normalizeProductLabel(input.label);

  if (!labelResult.ok) {
    return labelResult;
  }

  return ok({
    id: idResult.value,
    label: labelResult.value,
  });
};

export interface CreatePriceMemoryRecordInput {
  readonly id: string;
  readonly productId: string;
  readonly label: string;
  readonly unitPriceMinor: MinorUnits;
  readonly observedAt: string;
  readonly store?: {
    readonly id: string;
    readonly label: string;
  } | null;
  readonly source: PriceSource;
}

export const createPriceMemoryRecord = (
  input: CreatePriceMemoryRecordInput,
): Result<PriceMemoryRecord, PriceMemoryError> => {
  const idResult = priceMemoryId(input.id);

  if (!idResult.ok) {
    return idResult;
  }

  const productResult = createProductIdentity({
    id: input.productId,
    label: input.label,
  });

  if (!productResult.ok) {
    return productResult;
  }

  const priceResult = mvpMinorUnits(input.unitPriceMinor);

  if (!priceResult.ok || priceResult.value <= 0) {
    return failure("invalid-price");
  }

  const observedAtResult = isoTimestamp(input.observedAt);

  if (!observedAtResult.ok) {
    return failure("invalid-timestamp");
  }

  if (input.source.kind === "price-memory") {
    return failure("invalid-source");
  }

  const storeResult =
    input.store === undefined || input.store === null
      ? ok<StoreContext | undefined>(undefined)
      : createStoreContext(input.store);

  if (!storeResult.ok) {
    return failure("invalid-store");
  }

  return ok({
    id: idResult.value,
    product: productResult.value,
    unitPriceMinor: priceResult.value,
    observedAt: observedAtResult.value,
    ...(storeResult.value === undefined
      ? {}
      : { store: storeResult.value }),
    source: input.source,
  });
};

const productLabelKey = (label: string): string =>
  label.trim().normalize("NFKC").toLocaleLowerCase("en-US");

export const findProductByLabel = (
  records: readonly PriceMemoryRecord[],
  label: string,
): ProductIdentity | null => {
  const key = productLabelKey(label);

  if (key === "") {
    return null;
  }

  const match = records.find(
    (record) => productLabelKey(record.product.label) === key,
  );

  return match?.product ?? null;
};

const sameStoreSlot = (
  left: StoreContext | undefined,
  right: StoreContext | undefined,
): boolean =>
  left === undefined
    ? right === undefined
    : right !== undefined && left.id === right.id;

const observedAtMs = (record: PriceMemoryRecord): number =>
  Date.parse(record.observedAt);

export const upsertPriceMemory = (
  records: readonly PriceMemoryRecord[],
  candidate: PriceMemoryRecord,
): readonly PriceMemoryRecord[] => {
  const index = records.findIndex(
    (record) =>
      record.product.id === candidate.product.id &&
      sameStoreSlot(record.store, candidate.store),
  );

  if (index < 0) {
    return Object.freeze([...records, candidate]);
  }

  const current = records[index];

  if (
    current !== undefined &&
    observedAtMs(candidate) < observedAtMs(current)
  ) {
    return records;
  }

  return Object.freeze(
    records.map((record, recordIndex) =>
      recordIndex === index ? candidate : record,
    ),
  );
};

const memoryPreference = (
  record: PriceMemoryRecord,
  storeId: StoreId | undefined,
): number => {
  if (storeId === undefined) {
    return record.store === undefined ? 1 : 0;
  }

  if (record.store?.id === storeId) {
    return 2;
  }

  return record.store === undefined ? 1 : 0;
};

const selectProductMemory = (
  records: readonly PriceMemoryRecord[],
  storeId: StoreId | undefined,
): PriceMemoryRecord => {
  return [...records].sort((left, right) => {
    const preference =
      memoryPreference(right, storeId) -
      memoryPreference(left, storeId);

    if (preference !== 0) {
      return preference;
    }

    return observedAtMs(right) - observedAtMs(left);
  })[0] as PriceMemoryRecord;
};

export const recentPriceMemories = (
  records: readonly PriceMemoryRecord[],
  storeId?: StoreId,
  limit = 6,
): readonly PriceMemoryRecord[] => {
  const byProduct = new Map<ProductId, PriceMemoryRecord[]>();

  for (const record of records) {
    const group = byProduct.get(record.product.id) ?? [];
    group.push(record);
    byProduct.set(record.product.id, group);
  }

  return Object.freeze(
    [...byProduct.values()]
      .map((group) => selectProductMemory(group, storeId))
      .sort((left, right) => {
        const preference =
          memoryPreference(right, storeId) -
          memoryPreference(left, storeId);

        if (preference !== 0) {
          return preference;
        }

        return observedAtMs(right) - observedAtMs(left);
      })
      .slice(0, Math.max(0, limit)),
  );
};

export const memoryAgeDays = (
  record: PriceMemoryRecord,
  now: IsoTimestamp,
): number => {
  const elapsed = Date.parse(now) - observedAtMs(record);

  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return 0;
  }

  return Math.floor(elapsed / 86_400_000);
};
