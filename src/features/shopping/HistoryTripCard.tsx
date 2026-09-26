import type { RefObject } from "react";

import { formatEur } from "../../domain/money";
import {
  cartTotal,
  checkoutDifference,
  itemCount,
  lineTotal,
  type CompletedTrip,
} from "../../domain/shopping-trip";
import styles from "./HistoryScreen.module.css";
import { budgetOutcome, formatAbsoluteEur } from "./shopping-feedback";

export interface HistoryTripCardProps {
  readonly trip: CompletedTrip;
  readonly locale: string;
  readonly canChangeHistory: boolean;
  readonly canRepeat: boolean;
  readonly deleting: boolean;
  readonly confirmationCancelRef: RefObject<HTMLButtonElement | null>;
  readonly onStartSimilar: (trip: CompletedTrip) => void;
  readonly onRequestDelete: (trip: CompletedTrip) => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: (trip: CompletedTrip) => void;
}

const differenceLabel = (
  trip: CompletedTrip,
  locale: string,
): string | null => {
  const difference = checkoutDifference(trip);

  if (difference === null) {
    return null;
  }

  if (difference === 0) {
    return "Receipt matched";
  }

  return difference > 0
    ? `Paid ${formatAbsoluteEur(difference, locale)} more`
    : `Paid ${formatAbsoluteEur(difference, locale)} less`;
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

export function HistoryTripCard({
  trip,
  locale,
  canChangeHistory,
  canRepeat,
  deleting,
  confirmationCancelRef,
  onStartSimilar,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: HistoryTripCardProps) {
  const tracked = cartTotal(trip);
  const quantity = itemCount(trip);
  const difference = differenceLabel(trip, locale);
  const outcome = budgetOutcome(trip, locale);

  return (
    <li className={styles.trip}>
      <div className={styles.tripHeader}>
        <div>
          <span className={styles.completedAt}>
            {completedLabel(trip, locale)}
          </span>
          <strong>{formatEur(tracked, locale)} cart total</strong>
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
          <dt>Receipt</dt>
          <dd>
            {trip.actualCheckoutMinor === undefined
              ? "Not added"
              : formatEur(trip.actualCheckoutMinor, locale)}
          </dd>
        </div>
        <div>
          <dt>Budget outcome</dt>
          <dd data-outcome={outcome.status}>{outcome.label}</dd>
        </div>
      </dl>

      {difference ? (
        <p
          className={styles.difference}
          data-direction={(checkoutDifference(trip) ?? 0) > 0 ? "more" : "within"}
        >
          {difference}
        </p>
      ) : null}

      {trip.items.length > 0 ? (
        <details className={styles.tripDetails}>
          <summary>
            View {quantity} {quantity === 1 ? "item" : "items"}
          </summary>
          <ul>
            {trip.items.map((item, index) => (
              <li key={item.id}>
                <span>
                  {item.label ?? `Item ${index + 1}`}
                  {item.quantity > 1
                    ? ` · ${formatEur(item.unitPriceMinor, locale)} × ${item.quantity}`
                    : ""}
                </span>
                <strong>
                  {formatEur(lineTotal(item), locale)}
                </strong>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className={styles.tripActions}>
        <button
          type="button"
          className={styles.repeatTripButton}
          disabled={!canRepeat}
          onClick={() => {
            onStartSimilar(trip);
          }}
        >
          Shop again
        </button>

        {deleting ? (
          <section
            className={styles.confirmation}
            aria-label="Confirm trip deletion"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelDelete();
              }
            }}
          >
            <div>
              <strong>Delete this trip?</strong>
              <p>
                This removes the trip record from this device.
                Remembered item prices are stored separately.
              </p>
            </div>
            <div className={styles.confirmationActions}>
              <button
                ref={confirmationCancelRef}
                type="button"
                className={styles.secondaryButton}
                onClick={onCancelDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => {
                  onConfirmDelete(trip);
                }}
              >
                Delete trip
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            className={styles.deleteTripButton}
            data-delete-trip-id={trip.id}
            disabled={!canChangeHistory}
            onClick={() => {
              onRequestDelete(trip);
            }}
          >
            Delete trip
          </button>
        )}
      </div>
    </li>
  );
}
