import { useEffect, useMemo, useRef, useState } from "react";

import { formatEur, signedMinorUnits } from "../../domain/money";
import {
  priceMemoryAgeDays,
  recentPriceMemories,
  type PriceMemoryRecord,
} from "../../domain/price-memory";
import {
  isoTimestamp,
  projectAddItem,
  type ActiveTrip,
  type IsoTimestamp,
} from "../../domain/shopping-trip";
import styles from "./RecentItemsSection.module.css";

export interface RecentItemsSectionProps {
  readonly trip: ActiveTrip;
  readonly records: readonly PriceMemoryRecord[];
  readonly now?: IsoTimestamp;
  readonly onUseRemembered: (
    record: PriceMemoryRecord,
  ) => boolean | void;
  readonly onEnterCurrentPrice: (
    record: PriceMemoryRecord,
  ) => void;
  readonly locale?: string;
  readonly limit?: number;
  readonly persistenceDegraded?: boolean;
}

const ageLabel = (
  record: PriceMemoryRecord,
  now: IsoTimestamp,
): string => {
  const days = priceMemoryAgeDays(record, now);

  if (days === 0) {
    return "Seen today";
  }

  if (days === 1) {
    return "Seen 1 day ago";
  }

  return `Seen ${days} days ago`;
};

const absoluteMoney = (
  value: number,
  locale: string,
): string => {
  const amount = signedMinorUnits(Math.abs(value));

  if (!amount.ok) {
    throw new RangeError("Recent-item projection exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

const currentTimestamp = (): IsoTimestamp => {
  const parsed = isoTimestamp(new Date().toISOString());

  if (!parsed.ok) {
    throw new RangeError("Browser produced an invalid canonical timestamp");
  }

  return parsed.value;
};

export function RecentItemsSection({
  trip,
  records,
  now,
  onUseRemembered,
  onEnterCurrentPrice,
  locale = "en-FI",
  limit = 4,
  persistenceDegraded = false,
}: RecentItemsSectionProps) {
  const effectiveNow = now ?? currentTimestamp();
  const recent = useMemo(
    () => recentPriceMemories(records, { limit }),
    [limit, records],
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);

  const restoreRememberedTrigger = (memoryId: string): void => {
    queueMicrotask(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        "[data-use-remembered-memory-id]",
      );

      for (const button of buttons) {
        if (button.dataset.useRememberedMemoryId === memoryId) {
          button.focus();
          break;
        }
      }
    });
  };

  const cancelPending = (memoryId: string): void => {
    setPendingId(null);
    restoreRememberedTrigger(memoryId);
  };

  useEffect(() => {
    if (pendingId !== null) {
      confirmationCancelRef.current?.focus();
    }
  }, [pendingId]);

  if (recent.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="recent-items-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Faster repeat shopping</p>
          <h2 id="recent-items-title">Recent Items</h2>
        </div>
        <span>{recent.length} remembered</span>
      </div>

      <p className={styles.intro}>
        These are old observed prices, not live store prices. Use one only
        when it still looks right, or enter the current price instead.
      </p>

      {persistenceDegraded ? (
        <p className={styles.memoryWarning} role="status">
          Recent Items are available now, but price-memory changes are not
          safely saving. Your active cart is still saved independently.
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <ul className={styles.list}>
        {recent.map((record) => {
          const projection = projectAddItem(trip, {
            unitPriceMinor: record.unitPriceMinor,
            quantity: 1,
          });
          const crossesNominalBudget =
            projection.ok && projection.value.crossesNominalBudget;
          const isPending = pendingId === record.id;

          return (
            <li key={record.id} className={styles.item}>
              <div className={styles.identity}>
                <strong>{record.label}</strong>
                <span className={styles.price}>
                  {formatEur(record.unitPriceMinor, locale)}
                </span>
                <small>
                  Remembered · {ageLabel(record, effectiveNow)}
                  {record.storeId === undefined ? "" : " · Store-specific"}
                </small>
              </div>

              {isPending && projection.ok ? (
                <div
                  className={styles.confirmation}
                  aria-label={`Confirm remembered price for ${record.label}`}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelPending(record.id);
                    }
                  }}
                >
                  <p>
                    This remembered price would put you{" "}
                    <strong>
                      {absoluteMoney(
                        projection.value.nominalOverageMinor,
                        locale,
                      )}
                    </strong>{" "}
                    over your limit.
                  </p>
                  <div className={styles.confirmationActions}>
                    <button
                      ref={confirmationCancelRef}
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        cancelPending(record.id);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => {
                        setErrorMessage("");
                        const accepted = onUseRemembered(record);

                        if (accepted === false) {
                          setErrorMessage(
                            `Could not add ${record.label}. Try again or enter the current price.`,
                          );
                          return;
                        }

                        setPendingId(null);
                        restoreRememberedTrigger(record.id);
                      }}
                    >
                      Add anyway
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.rememberedButton}
                    aria-label={`Use remembered price for ${record.label}`}
                    data-use-remembered-memory-id={record.id}
                    onClick={() => {
                      setErrorMessage("");

                      if (crossesNominalBudget) {
                        setPendingId(record.id);
                        return;
                      }

                      const accepted = onUseRemembered(record);

                      if (accepted === false) {
                        setErrorMessage(
                          `Could not add ${record.label}. Try again or enter the current price.`,
                        );
                      }
                    }}
                  >
                    Use remembered price
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    aria-label={`Enter current price for ${record.label}`}
                    data-current-price-memory-id={record.id}
                    onClick={() => {
                      setPendingId(null);
                      setErrorMessage("");
                      onEnterCurrentPrice(record);
                    }}
                  >
                    Enter current price
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
