import { useEffect, useRef, useState } from "react";

import { formatEur } from "../../domain/money";
import {
  cartTotal,
  itemCount,
  type ActiveTrip,
} from "../../domain/shopping-trip";
import styles from "./FinishTripSurface.module.css";

export interface FinishTripSurfaceProps {
  readonly trip: ActiveTrip;
  readonly onCancel: () => void;
  readonly onConfirm: () => boolean | void;
  readonly locale?: string;
}

export function FinishTripSurface({
  trip,
  onCancel,
  onConfirm,
  locale = "en-FI",
}: FinishTripSurfaceProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const total = cartTotal(trip);
  const quantity = itemCount(trip);

  const finish = (): void => {
    if (submitting) {
      return;
    }

    setErrorMessage("");
    setSubmitting(true);
    const accepted = onConfirm();

    if (accepted === false) {
      setSubmitting(false);
      setErrorMessage(
        "Trip history could not be saved. Your active trip is still intact.",
      );
    }
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

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

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
