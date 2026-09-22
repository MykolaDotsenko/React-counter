import type { RefObject } from "react";

import styles from "./HistoryScreen.module.css";

export type HistoryDataConfirmation =
  | "none"
  | "clear-history"
  | "clear-price-memory";

export interface HistoryDataControlsProps {
  readonly tripCount: number;
  readonly priceMemoryCount: number;
  readonly priceMemoryDegraded: boolean;
  readonly canChangeHistory: boolean;
  readonly confirmation: HistoryDataConfirmation;
  readonly confirmationCancelRef: RefObject<HTMLButtonElement | null>;
  readonly onRequestClearHistory: () => void;
  readonly onConfirmClearHistory: () => void;
  readonly onRequestClearPriceMemory: () => void;
  readonly onConfirmClearPriceMemory: () => void;
  readonly onCancel: () => void;
}

export function HistoryDataControls({
  tripCount,
  priceMemoryCount,
  priceMemoryDegraded,
  canChangeHistory,
  confirmation,
  confirmationCancelRef,
  onRequestClearHistory,
  onConfirmClearHistory,
  onRequestClearPriceMemory,
  onConfirmClearPriceMemory,
  onCancel,
}: HistoryDataControlsProps) {
  return (
    <section
      className={styles.dataControls}
      aria-labelledby="data-controls-title"
    >
      <div>
        <p className={styles.sectionKicker}>Local data</p>
        <h2 id="data-controls-title">Data controls</h2>
        <p>
          Trip history and remembered prices are separate local records,
          so you can remove either without implying that the other is gone.
        </p>
      </div>

      {!canChangeHistory && tripCount > 0 ? (
        <p className={styles.controlNote}>
          Fix the local-save warning before changing trip history.
        </p>
      ) : null}

      {confirmation === "clear-history" ? (
        <section
          className={styles.confirmation}
          aria-label="Confirm clearing trip history"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        >
          <div>
            <strong>Clear all trip history?</strong>
            <p>
              This removes {tripCount} completed{" "}
              {tripCount === 1 ? "trip" : "trips"}.
              Remembered item prices will stay available.
            </p>
          </div>
          <div className={styles.confirmationActions}>
            <button
              ref={confirmationCancelRef}
              type="button"
              className={styles.secondaryButton}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={onConfirmClearHistory}
            >
              Clear trip history
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className={styles.dataAction}
          disabled={tripCount === 0 || !canChangeHistory}
          onClick={onRequestClearHistory}
        >
          <span>
            <strong>Clear trip history</strong>
            <small>
              {tripCount === 0
                ? "No completed trips stored"
                : `${tripCount} completed ${tripCount === 1 ? "trip" : "trips"}`}
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      {confirmation === "clear-price-memory" ? (
        <section
          className={styles.confirmation}
          aria-label="Confirm clearing remembered prices"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        >
          <div>
            <strong>Clear remembered prices?</strong>
            <p>
              This removes remembered item names and prices used for
              faster repeat shopping. Completed trip history will stay.
            </p>
          </div>
          <div className={styles.confirmationActions}>
            <button
              ref={confirmationCancelRef}
              type="button"
              className={styles.secondaryButton}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={onConfirmClearPriceMemory}
            >
              Clear remembered prices
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className={styles.dataAction}
          disabled={priceMemoryCount === 0 && !priceMemoryDegraded}
          onClick={onRequestClearPriceMemory}
        >
          <span>
            <strong>Clear remembered prices</strong>
            <small>
              {priceMemoryCount === 0
                ? priceMemoryDegraded
                  ? "Reset the damaged price-memory record"
                  : "No remembered prices stored"
                : `${priceMemoryCount} remembered ${priceMemoryCount === 1 ? "item" : "items"}`}
            </small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
