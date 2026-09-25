import { useEffect, useRef, useState, type ReactNode } from "react";

import { formatEur } from "../../domain/money";
import {
  cartTotal,
  itemCount,
  type ActiveTrip,
} from "../../domain/shopping-trip";
import styles from "./FinishTripSurface.module.css";
import { SHOPPING_LOCALE } from "./shopping-locale";

export type FinishTripFailure = "not-saved" | "history-unreadable";

export interface FinishTripSurfaceProps {
  readonly trip: ActiveTrip;
  readonly onCancel: () => void;
  readonly onConfirm: () => boolean | void | FinishTripFailure;
  readonly locale?: string;
  /** Stored-history notice, rendered inside the surface when present. */
  readonly historyNotice?: ReactNode;
  /** True while stored history must be resolved before finishing. */
  readonly historyNeedsAttention?: boolean;
}

const failureMessage = (failure: FinishTripFailure): string => {
  switch (failure) {
    case "history-unreadable":
      return "Saved trip history needs attention before this trip can be added to it. The trip is still open here.";
    case "not-saved":
      return "Trip history could not be saved. Your active trip is still intact.";
    default: {
      const exhaustive: never = failure;
      return exhaustive;
    }
  }
};

export function FinishTripSurface({
  trip,
  onCancel,
  onConfirm,
  locale = SHOPPING_LOCALE,
  historyNotice,
  historyNeedsAttention = false,
}: FinishTripSurfaceProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [failure, setFailure] = useState<FinishTripFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Once the history notice is resolved, its failure no longer applies.
  const visibleFailure =
    failure === "history-unreadable" && !historyNeedsAttention
      ? null
      : failure;

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const total = cartTotal(trip);
  const quantity = itemCount(trip);

  const finish = (): void => {
    if (submitting) {
      return;
    }

    setFailure(null);
    setSubmitting(true);
    const outcome = onConfirm();

    if (outcome === true || outcome === undefined) {
      return;
    }

    setSubmitting(false);
    setFailure(outcome === false ? "not-saved" : outcome);
  };

  return (
    <main
      className={styles.screen}
      aria-labelledby="finish-trip-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <section className={styles.panel}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Finish shopping</p>
          <h1 id="finish-trip-title">Ready to finish this trip?</h1>
          <p>
            We’ll keep this trip in local history. You can add the actual
            checkout total afterwards if you want to compare it with what
            you tracked.
          </p>
        </header>

        <section className={styles.summary} aria-label="Trip review">
          <div>
            <span>Tracked cart</span>
            <strong>{formatEur(total, locale)}</strong>
          </div>
          <div>
            <span>Budget</span>
            <strong>{formatEur(trip.budgetMinor, locale)}</strong>
          </div>
          <div>
            <span>Items</span>
            <strong>{quantity}</strong>
          </div>
        </section>

        <p className={styles.safety}>
          Finishing locks this trip against ordinary cart edits. If history
          cannot be written safely, the active trip will stay open instead
          of being discarded.
        </p>

        {visibleFailure !== null ? (
          <p className={styles.error} role="alert">
            {failureMessage(visibleFailure)}
          </p>
        ) : null}

        {historyNotice}

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Keep shopping
          </button>
          <button
            type="button"
            className={styles.finishButton}
            disabled={submitting}
            onClick={finish}
          >
            {submitting ? "Finishing…" : "Finish trip"}
          </button>
        </div>
      </section>
    </main>
  );
}
