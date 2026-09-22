import { useEffect, useRef, useState } from "react";

import { useShoppingAppState } from "../../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../../application/shopping-app-controller";
import { formatEur, signedMinorUnits } from "../../domain/money";
import {
  cartTotal,
  checkoutDifference,
  itemCount,
  lineTotal,
  remaining,
  type CompletedTrip,
  type TripId,
} from "../../domain/shopping-trip";
import { PersistenceHealthNotice } from "./PersistenceHealthNotice";
import styles from "./HistoryScreen.module.css";

export interface HistoryScreenProps {
  readonly controller: ShoppingAppController;
  readonly onBack: () => void;
  readonly onTripStarted?: () => void;
  readonly locale?: string;
}

type ConfirmationState =
  | { readonly kind: "none" }
  | { readonly kind: "delete-trip"; readonly tripId: TripId }
  | { readonly kind: "clear-history" }
  | { readonly kind: "clear-price-memory" };

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

const budgetOutcomeLabel = (
  trip: CompletedTrip,
  locale: string,
): string => {
  const amount = remaining(trip);

  if (amount === 0) {
    return "On budget";
  }

  return amount > 0
    ? `${formatAbsoluteEur(amount, locale)} under budget`
    : `${formatAbsoluteEur(amount, locale)} over budget`;
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
  controller,
  onBack,
  onTripStarted,
  locale = "en-FI",
}: HistoryScreenProps) {
  const state = useShoppingAppState(controller);
  const ordered = [...state.completedTrips].sort(
    (left, right) =>
      Date.parse(right.completedAt) - Date.parse(left.completedAt),
  );
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    kind: "none",
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const canChangeHistory =
    state.persistence.status === "healthy" &&
    !state.completionCleanupPending;

  useEffect(() => {
    if (confirmation.kind !== "none") {
      confirmationCancelRef.current?.focus();
    }
  }, [confirmation]);

  const resetMessages = (): void => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const restoreDeleteTripFocus = (tripId: TripId): void => {
    queueMicrotask(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        "[data-delete-trip-id]",
      );

      for (const button of buttons) {
        if (button.dataset.deleteTripId === tripId) {
          button.focus();
          return;
        }
      }
    });
  };

  const cancelConfirmation = (): void => {
    const previous = confirmation;
    setConfirmation({ kind: "none" });

    if (previous.kind === "delete-trip") {
      restoreDeleteTripFocus(previous.tripId);
    }
  };

  const startSimilarTrip = (trip: CompletedTrip): void => {
    resetMessages();
    const result = controller.startTripFromCompleted(trip.id);

    if (!result.ok) {
      setErrorMessage(
        "A new trip could not be started from this budget. Check local saving and try again.",
      );
      return;
    }

    onTripStarted?.();
  };

  const deleteTrip = (tripId: TripId): void => {
    resetMessages();
    const result = controller.deleteCompletedTrip(tripId);

    if (!result.ok) {
      setErrorMessage(
        "This trip could not be deleted safely. Nothing was removed.",
      );
      return;
    }

    setConfirmation({ kind: "none" });
    setStatusMessage("Trip deleted from this device.");
  };

  const clearHistory = (): void => {
    resetMessages();
    const result = controller.clearCompletedHistory();

    if (!result.ok) {
      setErrorMessage(
        "Trip history could not be cleared safely. Nothing was removed.",
      );
      return;
    }

    setConfirmation({ kind: "none" });
    setStatusMessage("Trip history cleared from this device.");
  };

  const clearPriceMemory = (): void => {
    resetMessages();
    const result = controller.clearPriceMemory();

    if (!result.ok) {
      setErrorMessage(
        "Remembered prices could not be cleared safely. Nothing was removed.",
      );
      return;
    }

    setConfirmation({ kind: "none" });
    setStatusMessage("Remembered item prices cleared from this device.");
  };

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

        <PersistenceHealthNotice
          controller={controller}
          health={state.persistence}
          context="idle"
        />

        {statusMessage ? (
          <p className={styles.status} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

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
              const isDeleting =
                confirmation.kind === "delete-trip" &&
                confirmation.tripId === trip.id;

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
                    <div>
                      <dt>Budget outcome</dt>
                      <dd>{budgetOutcomeLabel(trip, locale)}</dd>
                    </div>
                  </dl>

                  {difference ? (
                    <p className={styles.difference}>{difference}</p>
                  ) : (
                    <p className={styles.neutral}>
                      No checkout comparison recorded.
                    </p>
                  )}

                  {trip.items.length > 0 ? (
                    <details className={styles.tripDetails}>
                      <summary>
                        View items · {trip.items.length}
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
                      disabled={!canChangeHistory}
                      onClick={() => {
                        startSimilarTrip(trip);
                      }}
                    >
                      Shop again
                    </button>

                  {isDeleting ? (
                    <section
                      className={styles.confirmation}
                      aria-label="Confirm trip deletion"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelConfirmation();
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
                          onClick={cancelConfirmation}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          onClick={() => {
                            deleteTrip(trip.id);
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
                        resetMessages();
                        setConfirmation({
                          kind: "delete-trip",
                          tripId: trip.id,
                        });
                      }}
                    >
                      Delete trip
                    </button>
                  )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <section className={styles.dataControls} aria-labelledby="data-controls-title">
          <div>
            <p className={styles.sectionKicker}>Local data</p>
            <h2 id="data-controls-title">Data controls</h2>
            <p>
              Trip history and remembered prices are separate local records,
              so you can remove either without implying that the other is gone.
            </p>
          </div>

          {!canChangeHistory && state.completedTrips.length > 0 ? (
            <p className={styles.controlNote}>
              Fix the local-save warning before changing trip history.
            </p>
          ) : null}

          {confirmation.kind === "clear-history" ? (
            <section
              className={styles.confirmation}
              aria-label="Confirm clearing trip history"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelConfirmation();
                }
              }}
            >
              <div>
                <strong>Clear all trip history?</strong>
                <p>
                  This removes {state.completedTrips.length} completed{" "}
                  {state.completedTrips.length === 1 ? "trip" : "trips"}.
                  Remembered item prices will stay available.
                </p>
              </div>
              <div className={styles.confirmationActions}>
                <button
                  ref={confirmationCancelRef}
                  type="button"
                  className={styles.secondaryButton}
                  onClick={cancelConfirmation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={clearHistory}
                >
                  Clear trip history
                </button>
              </div>
            </section>
          ) : (
            <button
              type="button"
              className={styles.dataAction}
              disabled={state.completedTrips.length === 0 || !canChangeHistory}
              onClick={() => {
                resetMessages();
                setConfirmation({ kind: "clear-history" });
              }}
            >
              <span>
                <strong>Clear trip history</strong>
                <small>
                  {state.completedTrips.length === 0
                    ? "No completed trips stored"
                    : `${state.completedTrips.length} completed ${state.completedTrips.length === 1 ? "trip" : "trips"}`}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          )}

          {confirmation.kind === "clear-price-memory" ? (
            <section
              className={styles.confirmation}
              aria-label="Confirm clearing remembered prices"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelConfirmation();
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
                  onClick={cancelConfirmation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={clearPriceMemory}
                >
                  Clear remembered prices
                </button>
              </div>
            </section>
          ) : (
            <button
              type="button"
              className={styles.dataAction}
              disabled={
                state.priceMemories.length === 0 &&
                state.priceMemoryPersistence.status === "healthy"
              }
              onClick={() => {
                resetMessages();
                setConfirmation({ kind: "clear-price-memory" });
              }}
            >
              <span>
                <strong>Clear remembered prices</strong>
                <small>
                  {state.priceMemories.length === 0
                    ? state.priceMemoryPersistence.status === "degraded"
                      ? "Reset the damaged price-memory record"
                      : "No remembered prices stored"
                    : `${state.priceMemories.length} remembered ${state.priceMemories.length === 1 ? "item" : "items"}`}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </section>
      </section>
    </main>
  );
}
