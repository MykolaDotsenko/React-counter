import { formatEur, signedMinorUnits } from "../../domain/money";
import {
  lineTotal,
  remaining,
  safeRemaining,
  type ActiveTrip,
  type CartItem,
  type ShoppingTrip,
} from "../../domain/shopping-trip";

export const formatAbsoluteEur = (value: number, locale: string): string => {
  const amount = signedMinorUnits(Math.abs(value));

  if (!amount.ok) {
    throw new RangeError("Amount exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

export type BudgetOutcomeStatus = "under" | "on" | "over";

export const budgetOutcome = (
  trip: ShoppingTrip,
  locale: string,
): { readonly status: BudgetOutcomeStatus; readonly label: string } => {
  const amount = remaining(trip);

  if (amount === 0) {
    return { status: "on", label: "On budget" };
  }

  return amount > 0
    ? { status: "under", label: `${formatAbsoluteEur(amount, locale)} under budget` }
    : { status: "over", label: `${formatAbsoluteEur(amount, locale)} over budget` };
};

export const remainingFeedback = (
  trip: ActiveTrip,
  locale: string,
): string => {
  const nominalRemaining = remaining(trip);

  if (nominalRemaining < 0) {
    return `${formatAbsoluteEur(nominalRemaining, locale)} over your limit.`;
  }

  if (trip.safetyBufferMinor > 0) {
    const protectedRemaining = safeRemaining(trip);

    if (protectedRemaining >= 0) {
      return `${formatEur(protectedRemaining, locale)} safe to spend.`;
    }

    return `${formatEur(nominalRemaining, locale)} of your ${formatEur(
      trip.safetyBufferMinor,
      locale,
    )} safety buffer left.`;
  }

  return `${formatEur(nominalRemaining, locale)} left.`;
};

export const addedFeedback = (
  trip: ActiveTrip,
  item: CartItem,
  locale: string,
): string =>
  `${formatEur(lineTotal(item), locale)} added. ${remainingFeedback(trip, locale)}`;
