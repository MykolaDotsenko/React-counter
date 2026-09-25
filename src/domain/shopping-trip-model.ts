import {
  EUR_SPEC,
  MAX_MVP_MONEY_MINOR,
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
  addMoney,
  minorUnits,
  multiplyMoney,
  signedMinorUnits,
  type MinorUnits,
  type Result,
  type SignedMinorUnits,
  type SupportedCurrency,
} from "./money";

type Brand<T, B extends string> = T & { readonly __brand: B };

export type TripId = Brand<string, "TripId">;
export type ItemId = Brand<string, "ItemId">;
export type StoreId = Brand<string, "StoreId">;
export type IsoTimestamp = Brand<string, "IsoTimestamp">;

export const MAX_ITEM_LABEL_CODE_POINTS = 120;

export type DomainErrorCode =
  | "invalid-budget"
  | "invalid-buffer"
  | "invalid-price"
  | "invalid-quantity"
  | "unsafe-integer"
  | "item-not-found"
  | "duplicate-item-id"
  | "invalid-id"
  | "invalid-label"
  | "invalid-timestamp"
  | "trip-not-active"
  | "trip-not-completed"
  | "unsupported-currency";

export interface DomainError {
  readonly kind: "domain";
  readonly code: DomainErrorCode;
}

export type PriceSource =
  | { readonly kind: "manual" }
  | { readonly kind: "price-memory"; readonly memoryId: string }
  | { readonly kind: "shelf-scan"; readonly captureId?: string }
  | { readonly kind: "encoded-barcode"; readonly symbology: string }
  | { readonly kind: "retailer-feed"; readonly provider: string };

export type PriceConfidence =
  | { readonly kind: "confirmed"; readonly confirmedAt: IsoTimestamp }
  | {
      readonly kind: "remembered";
      readonly observedAt: IsoTimestamp;
      readonly storeId?: StoreId;
    }
  | {
      readonly kind: "estimated";
      readonly reason?: "weighted" | "unknown" | "other";
    };

export interface CartItem {
  readonly id: ItemId;
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
  readonly label?: string;
  readonly priceSource: PriceSource;
  readonly priceConfidence: PriceConfidence;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

interface TripBase {
  readonly id: TripId;
  readonly currency: SupportedCurrency;
  readonly budgetMinor: MinorUnits;
  readonly safetyBufferMinor: MinorUnits;
  readonly items: readonly CartItem[];
  readonly startedAt: IsoTimestamp;
}

export interface ActiveTrip extends TripBase {
  readonly status: "active";
}

export interface CompletedTrip extends TripBase {
  readonly status: "completed";
  readonly completedAt: IsoTimestamp;
  readonly actualCheckoutMinor?: MinorUnits;
}

export type ShoppingTrip = ActiveTrip | CompletedTrip;

export interface CreateActiveTripInput {
  readonly id: string;
  readonly currency?: string;
  readonly budgetMinor: MinorUnits;
  readonly safetyBufferMinor?: MinorUnits;
  readonly startedAt: string;
}

export interface CreateCartItemInput {
  readonly id: string;
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
  readonly label?: string | null;
  readonly priceSource: PriceSource;
  readonly priceConfidence: PriceConfidence;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface AddItemDraft {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
  readonly label?: string | null;
  readonly priceSource: PriceSource;
  readonly priceConfidence: PriceConfidence;
}

export interface AddItemProjectionDraft {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
  readonly label?: string | null;
}

export interface SpendingPlanProjection {
  readonly cartTotalMinor: SignedMinorUnits;
  readonly remainingMinor: SignedMinorUnits;
  readonly safeRemainingMinor: SignedMinorUnits;
  readonly crossesSafeLimit: boolean;
  readonly crossesNominalBudget: boolean;
}

export interface TripProjection {
  readonly lineTotalMinor: SignedMinorUnits;
  readonly cartTotalMinor: SignedMinorUnits;
  readonly remainingMinor: SignedMinorUnits;
  readonly safeRemainingMinor: SignedMinorUnits;
  readonly crossesSafeLimit: boolean;
  readonly crossesNominalBudget: boolean;
  readonly nominalOverageMinor: SignedMinorUnits;
  /** Portion of the safety buffer consumed by this pending line alone. */
  readonly safetyBufferUseMinor: SignedMinorUnits;
}

export interface EditableItemPatch {
  readonly unitPriceMinor?: MinorUnits;
  readonly quantity?: number;
  readonly label?: string | null;
  readonly priceSource?: PriceSource;
  readonly priceConfidence?: PriceConfidence;
}

export type TripCommand =
  | { readonly type: "add-item"; readonly item: CartItem }
  | {
      readonly type: "update-item";
      readonly itemId: ItemId;
      readonly patch: EditableItemPatch;
      readonly now: IsoTimestamp;
    }
  | { readonly type: "remove-item"; readonly itemId: ItemId }
  | {
      readonly type: "set-spending-plan";
      readonly budgetMinor: MinorUnits;
      readonly safetyBufferMinor: MinorUnits;
    }
  | { readonly type: "set-budget"; readonly budgetMinor: MinorUnits }
  | {
      readonly type: "set-buffer";
      readonly safetyBufferMinor: MinorUnits;
    }
  | { readonly type: "complete-trip"; readonly completedAt: IsoTimestamp }
  | {
      readonly type: "set-actual-checkout";
      readonly actualCheckoutMinor: MinorUnits;
    };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const domainError = (code: DomainErrorCode): Result<never, DomainError> => ({
  ok: false,
  error: { kind: "domain", code },
});

const zeroMinorResult = minorUnits(0);

if (!zeroMinorResult.ok) {
  throw new Error("Zero minor units must be representable");
}

const ZERO_MINOR = zeroMinorResult.value;

const zeroSignedResult = signedMinorUnits(0);

if (!zeroSignedResult.ok) {
  throw new Error("Zero signed minor units must be representable");
}

const ZERO_SIGNED = zeroSignedResult.value;

const isSafeNonNegativeMinor = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const isMvpMoney = (value: number): boolean =>
  isSafeNonNegativeMinor(value) && value <= MAX_MVP_MONEY_MINOR;

export const validateBudget = (
  budgetMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (!isMvpMoney(budgetMinor) || budgetMinor === 0) {
    return domainError("invalid-budget");
  }

  return ok(budgetMinor);
};

export const validateBuffer = (
  safetyBufferMinor: MinorUnits,
  budgetMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (
    !isMvpMoney(safetyBufferMinor) ||
    safetyBufferMinor > budgetMinor
  ) {
    return domainError("invalid-buffer");
  }

  return ok(safetyBufferMinor);
};

export const validatePrice = (
  unitPriceMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (!isMvpMoney(unitPriceMinor) || unitPriceMinor === 0) {
    return domainError("invalid-price");
  }

  return ok(unitPriceMinor);
};

export const validateActualCheckout = (
  actualCheckoutMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (!isMvpMoney(actualCheckoutMinor)) {
    return domainError("invalid-price");
  }

  return ok(actualCheckoutMinor);
};

export const validateQuantity = (quantity: number): Result<number, DomainError> => {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < MIN_MVP_QUANTITY ||
    quantity > MAX_MVP_QUANTITY
  ) {
    return domainError("invalid-quantity");
  }

  return ok(quantity);
};

const normalizeIdentifier = <T extends TripId | ItemId | StoreId>(
  value: string,
): Result<T, DomainError> => {
  const normalized = value.trim();

  if (normalized === "") {
    return domainError("invalid-id");
  }

  return ok(normalized as T);
};

export const tripId = (value: string): Result<TripId, DomainError> =>
  normalizeIdentifier<TripId>(value);

export const itemId = (value: string): Result<ItemId, DomainError> =>
  normalizeIdentifier<ItemId>(value);

export const storeId = (value: string): Result<StoreId, DomainError> =>
  normalizeIdentifier<StoreId>(value);

export const CANONICAL_ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isoTimestamp = (
  value: string,
): Result<IsoTimestamp, DomainError> => {
  const normalized = value.trim();

  if (!CANONICAL_ISO_TIMESTAMP_PATTERN.test(normalized)) {
    return domainError("invalid-timestamp");
  }

  const epochMs = Date.parse(normalized);

  if (
    !Number.isFinite(epochMs) ||
    new Date(epochMs).toISOString() !== normalized
  ) {
    return domainError("invalid-timestamp");
  }

  return ok(normalized as IsoTimestamp);
};

const timestampMs = (value: IsoTimestamp): number => Date.parse(value);

export const timestampAtOrAfter = (
  candidate: IsoTimestamp,
  floor: IsoTimestamp,
): boolean => timestampMs(candidate) >= timestampMs(floor);

export const normalizeLabel = (
  label: string | null | undefined,
): Result<string | undefined, DomainError> => {
  if (label === null || label === undefined) {
    return ok(undefined);
  }

  const normalized = label.trim();

  if (normalized === "") {
    return ok(undefined);
  }

  if ([...normalized].length > MAX_ITEM_LABEL_CODE_POINTS) {
    return domainError("invalid-label");
  }

  return ok(normalized);
};

export const toSignedOrThrow = (value: number): SignedMinorUnits => {
  const result = signedMinorUnits(value);

  if (!result.ok) {
    throw new RangeError("Canonical shopping arithmetic exceeded safe integer bounds");
  }

  return result.value;
};

export const lineTotalResult = (
  unitPriceMinor: MinorUnits,
  quantity: number,
): Result<MinorUnits, DomainError> => {
  const multiplied = multiplyMoney(unitPriceMinor, quantity);

  if (!multiplied.ok) {
    return domainError(
      multiplied.error.code === "invalid-quantity"
        ? "invalid-quantity"
        : "unsafe-integer",
    );
  }

  return ok(multiplied.value);
};

export const validateCartItem = (
  item: CartItem,
): Result<CartItem, DomainError> => {
  const idResult = itemId(item.id);

  if (!idResult.ok) {
    return idResult;
  }

  const priceResult = validatePrice(item.unitPriceMinor);

  if (!priceResult.ok) {
    return priceResult;
  }

  const quantityResult = validateQuantity(item.quantity);

  if (!quantityResult.ok) {
    return quantityResult;
  }

  const labelResult = normalizeLabel(item.label);

  if (!labelResult.ok) {
    return labelResult;
  }

  const createdAtResult = isoTimestamp(item.createdAt);

  if (!createdAtResult.ok) {
    return createdAtResult;
  }

  const updatedAtResult = isoTimestamp(item.updatedAt);

  if (!updatedAtResult.ok) {
    return updatedAtResult;
  }

  if (!timestampAtOrAfter(updatedAtResult.value, createdAtResult.value)) {
    return domainError("invalid-timestamp");
  }

  const totalResult = lineTotalResult(
    priceResult.value,
    quantityResult.value,
  );

  if (!totalResult.ok) {
    return totalResult;
  }

  return ok({
    id: idResult.value,
    unitPriceMinor: priceResult.value,
    quantity: quantityResult.value,
    ...(labelResult.value === undefined
      ? {}
      : { label: labelResult.value }),
    priceSource: item.priceSource,
    priceConfidence: item.priceConfidence,
    createdAt: createdAtResult.value,
    updatedAt: updatedAtResult.value,
  });
};

export const cartTotalResult = (
  items: readonly CartItem[],
): Result<SignedMinorUnits, DomainError> => {
  let total = ZERO_SIGNED;

  for (const item of items) {
    const itemResult = validateCartItem(item);

    if (!itemResult.ok) {
      return itemResult;
    }

    const line = lineTotalResult(
      itemResult.value.unitPriceMinor,
      itemResult.value.quantity,
    );

    if (!line.ok) {
      return line;
    }

    const next = addMoney(total, line.value);

    if (!next.ok) {
      return domainError("unsafe-integer");
    }

    total = next.value;
  }

  return ok(total);
};

export const validateUniqueItemIds = (
  items: readonly CartItem[],
): Result<void, DomainError> => {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      return domainError("duplicate-item-id");
    }

    seen.add(item.id);
  }

  return ok(undefined);
};

export const createActiveTrip = (
  input: CreateActiveTripInput,
): Result<ActiveTrip, DomainError> => {
  const idResult = tripId(input.id);

  if (!idResult.ok) {
    return idResult;
  }

  if ((input.currency ?? EUR_SPEC.code) !== EUR_SPEC.code) {
    return domainError("unsupported-currency");
  }

  const budgetResult = validateBudget(input.budgetMinor);

  if (!budgetResult.ok) {
    return budgetResult;
  }

  const bufferResult = validateBuffer(
    input.safetyBufferMinor ?? ZERO_MINOR,
    budgetResult.value,
  );

  if (!bufferResult.ok) {
    return bufferResult;
  }

  const startedAtResult = isoTimestamp(input.startedAt);

  if (!startedAtResult.ok) {
    return startedAtResult;
  }

  return ok({
    id: idResult.value,
    currency: EUR_SPEC.code,
    budgetMinor: budgetResult.value,
    safetyBufferMinor: bufferResult.value,
    items: [],
    status: "active",
    startedAt: startedAtResult.value,
  });
};

export const createCartItem = (
  input: CreateCartItemInput,
): Result<CartItem, DomainError> => {
  const idResult = itemId(input.id);

  if (!idResult.ok) {
    return idResult;
  }

  const priceResult = validatePrice(input.unitPriceMinor);

  if (!priceResult.ok) {
    return priceResult;
  }

  const quantityResult = validateQuantity(input.quantity);

  if (!quantityResult.ok) {
    return quantityResult;
  }

  const labelResult = normalizeLabel(input.label);

  if (!labelResult.ok) {
    return labelResult;
  }

  const createdAtResult = isoTimestamp(input.createdAt);

  if (!createdAtResult.ok) {
    return createdAtResult;
  }

  const updatedAtResult = isoTimestamp(
    input.updatedAt ?? input.createdAt,
  );

  if (!updatedAtResult.ok) {
    return updatedAtResult;
  }

  if (!timestampAtOrAfter(updatedAtResult.value, createdAtResult.value)) {
    return domainError("invalid-timestamp");
  }

  const totalResult = lineTotalResult(
    priceResult.value,
    quantityResult.value,
  );

  if (!totalResult.ok) {
    return totalResult;
  }

  return ok({
    id: idResult.value,
    unitPriceMinor: priceResult.value,
    quantity: quantityResult.value,
    ...(labelResult.value === undefined
      ? {}
      : { label: labelResult.value }),
    priceSource: input.priceSource,
    priceConfidence: input.priceConfidence,
    createdAt: createdAtResult.value,
    updatedAt: updatedAtResult.value,
  });
};

