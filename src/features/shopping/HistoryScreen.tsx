import { formatEur, signedMinorUnits } from "../../domain/money";
import {
  cartTotal,
  checkoutDifference,
  itemCount,
  type CompletedTrip,
} from "../../domain/shopping-trip";
import styles from "./HistoryScreen.module.css";

export interface HistoryScreenProps {
  readonly trips: readonly CompletedTrip[];
  readonly onBack: () => void;
  readonly locale?: string;
}

const formatAbsoluteEur = (
  value: number,
  locale: string,
): string => {
  const amount = signedMinorUnits(Math.abs(value));

  if (!amount.ok) {
    throw new RangeError("History reconciliation exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

const differenceLabel = (
  trip: CompletedTrip,
  locale: string,
): string | null => {
  const difference = checkoutDifference(trip);

  if (difference === null) {
    return null;
  }

  if (difference === 0) {
    return "Checkout matched";
  }

  return difference > 0
    ? `${formatAbsoluteEur(difference, locale)} more at checkout`
    : `${formatAbsoluteEur(difference, locale)} less at checkout`;
};

const completedLabel = (
  trip: CompletedTrip,
  locale: string,
): string => {
  const date = new Date(trip.completedAt);

  if (!Number.isFinite(date.getTime())) {
    return trip.completedAt;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export function HistoryScreen({
  trips,
  onBack,
  locale = "en-FI",
}: HistoryScreenProps) {
  const ordered = [...trips].sort(
    (left, right) =>
      Date.parse(right.completedAt) - Date.parse(left.completedAt),
  );

  return (
    <main className={styles.screen} aria-labelledby="history-title">
      <section className={styles.shell}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
          >
            Back
          </button>
          <div>
            <p className={styles.eyebrow}>Trip history</p>
            <h1 id="history-title">Past shopping trips</h1>
            <p>
              A simple record of what you tracked and, when provided,
              what checkout actually cost.
            </p>
          </div>
        </header>

        {ordered.length === 0 ? (
          <section className={styles.emptyState}>
            <strong>No completed trips yet.</strong>
            <span>Finish a shopping trip and it will appear here.</span>
          </section>
        ) : (
          <ol className={styles.tripList}>
            {ordered.map((trip) => {
              const tracked = cartTotal(trip);
              const quantity = itemCount(trip);
              const difference = differenceLabel(trip, locale);

              return (
                <li key={trip.id} className={styles.trip}>
                  <div className={styles.tripHeader}>
                    <div>
                      <span className={styles.completedAt}>
                        {completedLabel(trip, locale)}
                      </span>
                      <strong>{formatEur(tracked, locale)} tracked</strong>
                    </div>
                    <span className={styles.itemCount}>
                      {quantity} {quantity === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <dl className={styles.metrics}>
                    <div>
                      <dt>Budget</dt>
                      <dd>{formatEur(trip.budgetMinor, locale)}</dd>
                    </div>
                    <div>
                      <dt>Checkout</dt>
                      <dd>
                        {trip.actualCheckoutMinor === undefined
                          ? "Not added"
                          : formatEur(trip.actualCheckoutMinor, locale)}
                      </dd>
                    </div>
                  </dl>

                  {difference ? (
                    <p className={styles.difference}>{difference}</p>
                  ) : (
                    <p className={styles.neutral}>
                      No checkout comparison recorded.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
