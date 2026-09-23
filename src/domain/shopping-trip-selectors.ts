import {
  addMoney,
  signedMinorUnits,
  subtractMoney,
  type MinorUnits,
  type Result,
  type SignedMinorUnits,
} from "./money";
import {
  cartTotalResult,
  domainError,
  lineTotalResult,
  normalizeLabel,
  ok,
  toSignedOrThrow,
  validateBudget,
  validateBuffer,
  validatePrice,
  validateQuantity,
  type ActiveTrip,
  type AddItemProjectionDraft,
  type CartItem,
  type CompletedTrip,
  type DomainError,
  type ShoppingTrip,
  type SpendingPlanProjection,
  type TripProjection,
} from "./shopping-trip-model";

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

