import {
  EUR_SPEC,
  MAX_MVP_MONEY_MINOR,
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
  addMoney,
  minorUnits,
  multiplyMoney,
  signedMinorUnits,
  subtractMoney,
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

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

const domainError = (code: DomainErrorCode): Result<never, DomainError> => ({
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

const validateBudget = (
  budgetMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (!isMvpMoney(budgetMinor) || budgetMinor === 0) {
    return domainError("invalid-budget");
  }

  return ok(budgetMinor);
};

const validateBuffer = (
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

const validatePrice = (
  unitPriceMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (!isMvpMoney(unitPriceMinor) || unitPriceMinor === 0) {
    return domainError("invalid-price");
  }

  return ok(unitPriceMinor);
};

const validateActualCheckout = (
  actualCheckoutMinor: MinorUnits,
): Result<MinorUnits, DomainError> => {
  if (!isMvpMoney(actualCheckoutMinor)) {
    return domainError("invalid-price");
  }

  return ok(actualCheckoutMinor);
};

const validateQuantity = (quantity: number): Result<number, DomainError> => {
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

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isoTimestamp = (
  value: string,
): Result<IsoTimestamp, DomainError> => {
  const normalized = value.trim();

  if (!ISO_TIMESTAMP_PATTERN.test(normalized)) {
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

const timestampAtOrAfter = (
  candidate: IsoTimestamp,
  floor: IsoTimestamp,
): boolean => timestampMs(candidate) >= timestampMs(floor);

const normalizeLabel = (
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

const toSignedOrThrow = (value: number): SignedMinorUnits => {
  const result = signedMinorUnits(value);

  if (!result.ok) {
    throw new RangeError("Canonical shopping arithmetic exceeded safe integer bounds");
  }

  return result.value;
};

const lineTotalResult = (
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

const validateCartItem = (
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

const cartTotalResult = (
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

const validateUniqueItemIds = (
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

export const lineTotal = (item: CartItem): SignedMinorUnits => {
  const result = lineTotalResult(item.unitPriceMinor, item.quantity);

  if (!result.ok) {
    throw new RangeError(`Invalid canonical cart item: ${result.error.code}`);
  }

  return toSignedOrThrow(result.value);
};

export const cartTotal = (trip: ShoppingTrip): SignedMinorUnits => {
  const result = cartTotalResult(trip.items);

  if (!result.ok) {
    throw new RangeError(`Invalid canonical shopping trip: ${result.error.code}`);
  }

  return result.value;
};

export const safeLimit = (trip: ShoppingTrip): SignedMinorUnits =>
  toSignedOrThrow(trip.budgetMinor - trip.safetyBufferMinor);

export const remaining = (trip: ShoppingTrip): SignedMinorUnits =>
  toSignedOrThrow(trip.budgetMinor - cartTotal(trip));

export const safeRemaining = (trip: ShoppingTrip): SignedMinorUnits =>
  toSignedOrThrow(safeLimit(trip) - cartTotal(trip));

export const nominalOverage = (trip: ShoppingTrip): SignedMinorUnits =>
  toSignedOrThrow(Math.max(cartTotal(trip) - trip.budgetMinor, 0));

export const safeOverage = (trip: ShoppingTrip): SignedMinorUnits =>
  toSignedOrThrow(Math.max(cartTotal(trip) - safeLimit(trip), 0));

export const checkoutDifference = (
  trip: CompletedTrip,
): SignedMinorUnits | null => {
  if (trip.actualCheckoutMinor === undefined) {
    return null;
  }

  return toSignedOrThrow(
    trip.actualCheckoutMinor - cartTotal(trip),
  );
};

export const itemCount = (trip: ShoppingTrip): number => {
  let count = 0;

  for (const item of trip.items) {
    count += item.quantity;

    if (!Number.isSafeInteger(count)) {
      throw new RangeError("Canonical item count exceeded safe integer bounds");
    }
  }

  return count;
};

export const mostRecentCompletedTrip = (
  trips: readonly CompletedTrip[],
): CompletedTrip | null => {
  let latest: CompletedTrip | null = null;

  for (const trip of trips) {
    if (latest === null || trip.completedAt > latest.completedAt) {
      latest = trip;
    }
  }

  return latest;
};

const validateDraft = (
  draft: AddItemProjectionDraft,
): Result<
  {
    readonly unitPriceMinor: MinorUnits;
    readonly quantity: number;
    readonly label?: string;
  },
  DomainError
> => {
  const priceResult = validatePrice(draft.unitPriceMinor);

  if (!priceResult.ok) {
    return priceResult;
  }

  const quantityResult = validateQuantity(draft.quantity);

  if (!quantityResult.ok) {
    return quantityResult;
  }

  const labelResult = normalizeLabel(draft.label);

  if (!labelResult.ok) {
    return labelResult;
  }

  const totalResult = lineTotalResult(
    priceResult.value,
    quantityResult.value,
  );

  if (!totalResult.ok) {
    return totalResult;
  }

  return ok({
    unitPriceMinor: priceResult.value,
    quantity: quantityResult.value,
    ...(labelResult.value === undefined
      ? {}
      : { label: labelResult.value }),
  });
};

export const projectSpendingPlan = (
  trip: ActiveTrip,
  budgetMinor: MinorUnits,
  safetyBufferMinor: MinorUnits,
): Result<SpendingPlanProjection, DomainError> => {
  const budgetResult = validateBudget(budgetMinor);

  if (!budgetResult.ok) {
    return budgetResult;
  }

  const bufferResult = validateBuffer(
    safetyBufferMinor,
    budgetResult.value,
  );

  if (!bufferResult.ok) {
    return bufferResult;
  }

  const totalResult = cartTotalResult(trip.items);

  if (!totalResult.ok) {
    return totalResult;
  }

  const remainingResult = subtractMoney(
    budgetResult.value,
    totalResult.value,
  );

  if (!remainingResult.ok) {
    return domainError("unsafe-integer");
  }

  const safeLimitResult = subtractMoney(
    budgetResult.value,
    bufferResult.value,
  );

  if (!safeLimitResult.ok) {
    return domainError("unsafe-integer");
  }

  const safeRemainingResult = subtractMoney(
    safeLimitResult.value,
    totalResult.value,
  );

  if (!safeRemainingResult.ok) {
    return domainError("unsafe-integer");
  }

  return ok({
    cartTotalMinor: totalResult.value,
    remainingMinor: remainingResult.value,
    safeRemainingMinor: safeRemainingResult.value,
    crossesSafeLimit: totalResult.value > safeLimitResult.value,
    crossesNominalBudget: totalResult.value > budgetResult.value,
  });
};

export const projectAddItem = (
  trip: ActiveTrip,
  draft: AddItemProjectionDraft,
): Result<TripProjection, DomainError> => {
  const draftResult = validateDraft(draft);

  if (!draftResult.ok) {
    return draftResult;
  }

  const currentTotal = cartTotalResult(trip.items);

  if (!currentTotal.ok) {
    return currentTotal;
  }

  const pendingLine = lineTotalResult(
    draftResult.value.unitPriceMinor,
    draftResult.value.quantity,
  );

  if (!pendingLine.ok) {
    return pendingLine;
  }

  const projectedTotal = addMoney(currentTotal.value, pendingLine.value);

  if (!projectedTotal.ok) {
    return domainError("unsafe-integer");
  }

  const projectedRemaining = subtractMoney(
    trip.budgetMinor,
    projectedTotal.value,
  );

  if (!projectedRemaining.ok) {
    return domainError("unsafe-integer");
  }

  const projectedSafeRemaining = subtractMoney(
    safeLimit(trip),
    projectedTotal.value,
  );

  if (!projectedSafeRemaining.ok) {
    return domainError("unsafe-integer");
  }

  const projectedOverage = Math.max(
    projectedTotal.value - trip.budgetMinor,
    0,
  );

  const nominalOverageResult = signedMinorUnits(projectedOverage);

  if (!nominalOverageResult.ok) {
    return domainError("unsafe-integer");
  }

  return ok({
    lineTotalMinor: toSignedOrThrow(pendingLine.value),
    cartTotalMinor: projectedTotal.value,
    remainingMinor: projectedRemaining.value,
    safeRemainingMinor: projectedSafeRemaining.value,
    crossesSafeLimit: projectedTotal.value > safeLimit(trip),
    crossesNominalBudget: projectedTotal.value > trip.budgetMinor,
    nominalOverageMinor: nominalOverageResult.value,
  });
};

const activeTripOnly = (
  trip: ShoppingTrip,
): Result<ActiveTrip, DomainError> =>
  trip.status === "active" ? ok(trip) : domainError("trip-not-active");

const completedTripOnly = (
  trip: ShoppingTrip,
): Result<CompletedTrip, DomainError> =>
  trip.status === "completed"
    ? ok(trip)
    : domainError("trip-not-completed");

const withValidatedItems = (
  trip: ActiveTrip,
  items: readonly CartItem[],
): Result<ActiveTrip, DomainError> => {
  const uniqueResult = validateUniqueItemIds(items);

  if (!uniqueResult.ok) {
    return uniqueResult;
  }

  const totalResult = cartTotalResult(items);

  if (!totalResult.ok) {
    return totalResult;
  }

  return ok({
    ...trip,
    items,
  });
};

const hasOwn = <K extends PropertyKey>(
  value: object,
  key: K,
): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

export const reduceTrip = (
  trip: ShoppingTrip,
  command: TripCommand,
): Result<ShoppingTrip, DomainError> => {
  switch (command.type) {
    case "add-item": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const itemResult = validateCartItem(command.item);

      if (!itemResult.ok) {
        return itemResult;
      }

      if (
        activeResult.value.items.some(
          (item) => item.id === itemResult.value.id,
        )
      ) {
        return domainError("duplicate-item-id");
      }

      return withValidatedItems(activeResult.value, [
        ...activeResult.value.items,
        itemResult.value,
      ]);
    }

    case "update-item": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const index = activeResult.value.items.findIndex(
        (item) => item.id === command.itemId,
      );

      if (index < 0) {
        return domainError("item-not-found");
      }

      const current = activeResult.value.items[index];

      if (current === undefined) {
        return domainError("item-not-found");
      }

      if (!timestampAtOrAfter(command.now, current.updatedAt)) {
        return domainError("invalid-timestamp");
      }

      const labelResult = hasOwn(command.patch, "label")
        ? normalizeLabel(command.patch.label as string | null | undefined)
        : ok(current.label);

      if (!labelResult.ok) {
        return labelResult;
      }

      const candidateBase = {
        id: current.id,
        unitPriceMinor:
          command.patch.unitPriceMinor ?? current.unitPriceMinor,
        quantity: command.patch.quantity ?? current.quantity,
        priceSource: command.patch.priceSource ?? current.priceSource,
        priceConfidence:
          command.patch.priceConfidence ?? current.priceConfidence,
        createdAt: current.createdAt,
        updatedAt: command.now,
      } satisfies Omit<CartItem, "label">;

      const candidate: CartItem =
        labelResult.value === undefined
          ? candidateBase
          : { ...candidateBase, label: labelResult.value };

      const candidateResult = validateCartItem(candidate);

      if (!candidateResult.ok) {
        return candidateResult;
      }

      const nextItems = activeResult.value.items.map((item, itemIndex) =>
        itemIndex === index ? candidateResult.value : item,
      );

      return withValidatedItems(activeResult.value, nextItems);
    }

    case "remove-item": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const exists = activeResult.value.items.some(
        (item) => item.id === command.itemId,
      );

      if (!exists) {
        return domainError("item-not-found");
      }

      return withValidatedItems(
        activeResult.value,
        activeResult.value.items.filter(
          (item) => item.id !== command.itemId,
        ),
      );
    }

    case "set-spending-plan": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const budgetResult = validateBudget(command.budgetMinor);

      if (!budgetResult.ok) {
        return budgetResult;
      }

      const bufferResult = validateBuffer(
        command.safetyBufferMinor,
        budgetResult.value,
      );

      if (!bufferResult.ok) {
        return bufferResult;
      }

      if (
        budgetResult.value === activeResult.value.budgetMinor &&
        bufferResult.value === activeResult.value.safetyBufferMinor
      ) {
        return ok(activeResult.value);
      }

      return ok({
        ...activeResult.value,
        budgetMinor: budgetResult.value,
        safetyBufferMinor: bufferResult.value,
      });
    }

    case "set-budget": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const budgetResult = validateBudget(command.budgetMinor);

      if (!budgetResult.ok) {
        return budgetResult;
      }

      const bufferResult = validateBuffer(
        activeResult.value.safetyBufferMinor,
        budgetResult.value,
      );

      if (!bufferResult.ok) {
        return bufferResult;
      }

      if (budgetResult.value === activeResult.value.budgetMinor) {
        return ok(activeResult.value);
      }

      return ok({
        ...activeResult.value,
        budgetMinor: budgetResult.value,
      });
    }

    case "set-buffer": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const bufferResult = validateBuffer(
        command.safetyBufferMinor,
        activeResult.value.budgetMinor,
      );

      if (!bufferResult.ok) {
        return bufferResult;
      }

      if (
        bufferResult.value === activeResult.value.safetyBufferMinor
      ) {
        return ok(activeResult.value);
      }

      return ok({
        ...activeResult.value,
        safetyBufferMinor: bufferResult.value,
      });
    }

    case "complete-trip": {
      const activeResult = activeTripOnly(trip);

      if (!activeResult.ok) {
        return activeResult;
      }

      const completedAtResult = isoTimestamp(command.completedAt);

      if (!completedAtResult.ok) {
        return completedAtResult;
      }

      let latestTimestamp = activeResult.value.startedAt;

      for (const item of activeResult.value.items) {
        if (timestampAtOrAfter(item.updatedAt, latestTimestamp)) {
          latestTimestamp = item.updatedAt;
        }
      }

      if (
        !timestampAtOrAfter(
          completedAtResult.value,
          latestTimestamp,
        )
      ) {
        return domainError("invalid-timestamp");
      }

      return ok({
        id: activeResult.value.id,
        currency: activeResult.value.currency,
        budgetMinor: activeResult.value.budgetMinor,
        safetyBufferMinor: activeResult.value.safetyBufferMinor,
        items: activeResult.value.items,
        status: "completed",
        startedAt: activeResult.value.startedAt,
        completedAt: completedAtResult.value,
      });
    }

    case "set-actual-checkout": {
      const completedResult = completedTripOnly(trip);

      if (!completedResult.ok) {
        return completedResult;
      }

      const checkoutResult = validateActualCheckout(
        command.actualCheckoutMinor,
      );

      if (!checkoutResult.ok) {
        return checkoutResult;
      }

      return ok({
        ...completedResult.value,
        actualCheckoutMinor: checkoutResult.value,
      });
    }

    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
};
