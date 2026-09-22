import { useEffect, useMemo, useRef, useState } from "react";

import type { PersistenceHealth } from "../../application/shopping-app-controller";
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
  type TripProjection,
} from "../../domain/shopping-trip";
import styles from "./RecentItemsPanel.module.css";

export interface RecentItemsPanelProps {
  readonly trip: ActiveTrip;
  readonly records: readonly PriceMemoryRecord[];
  readonly persistenceHealth: PersistenceHealth;
  readonly onUseRemembered: (
    record: PriceMemoryRecord,
  ) => boolean | void;
  readonly onEnterCurrentPrice: (record: PriceMemoryRecord) => void;
  readonly locale?: string;
}

interface PendingRememberedItem {
  readonly record: PriceMemoryRecord;
  readonly projection: TripProjection;
}

const currentTimestamp = (): IsoTimestamp => {
  const result = isoTimestamp(new Date().toISOString());

  if (!result.ok) {
    throw new Error("Browser clock did not produce a canonical timestamp");
  }

  return result.value;
};

const ageLabel = (
  record: PriceMemoryRecord,
  now: IsoTimestamp,
): string => {
  const days = priceMemoryAgeDays(record, now);

  if (days === 0) {
    return "today";
  }

  if (days === 1) {
    return "1 day ago";
  }

  return `${days} days ago`;
};

const formatAbsoluteEur = (
  value: number,
  locale: string,
): string => {
  const amount = signedMinorUnits(Math.abs(value));

  if (!amount.ok) {
    throw new RangeError("Recent-item projection exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

export function RecentItemsPanel({
  trip,
  records,
  persistenceHealth,
  onUseRemembered,
  onEnterCurrentPrice,
  locale = "en-FI",
}: RecentItemsPanelProps) {
  const now = useMemo(currentTimestamp, []);
  const recent = useMemo(
    () => recentPriceMemories(records, { limit: 4 }),
    [records],
  );
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<PendingRememberedItem | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (pending !== null) {
      cancelRef.current?.focus();
    }
  }, [pending]);

  if (recent.length === 0) {
    return null;
  }

  const addRemembered = (record: PriceMemoryRecord): void => {
    setErrorMessage("");

    const projection = projectAddItem(trip, {
      unitPriceMinor: record.unitPriceMinor,
      quantity: 1,
      label: record.label,
    });

    if (!projection.ok) {
      setErrorMessage("This remembered item cannot be added right now.");
      return;
    }

    if (projection.value.crossesNominalBudget) {
      setPending({
        record,
        projection: projection.value,
      });
      return;
    }

    if (onUseRemembered(record) === false) {
      setErrorMessage("Could not add this remembered item. Try again.");
    }
  };

  const confirmPending = (): void => {
    if (pending === null) {
      return;
    }

    const accepted = onUseRemembered(pending.record);

    if (accepted === false) {
      setErrorMessage("Could not add this remembered item. Try again.");
      return;
    }

    setPending(null);
  };

  return (
    <section
      className={styles.panel}
      aria-labelledby="recent-items-title"
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Faster this trip</p>
          <h2 id="recent-items-title">Recent Items</h2>
        </div>
        <span>{recent.length} remembered</span>
      </div>

      <p className={styles.supporting}>
        Reuse a previous price, or enter today&apos;s price instead.
        Remembered prices are never treated as current automatically.
      </p>

      {persistenceHealth.status === "degraded" ? (
        <p className={styles.persistenceNote} role="status">
          Recent Items are available now, but new memories may not survive a reload.
        </p>
      ) : null}

      {pending === null ? (
        <ul className={styles.list}>
          {recent.map((record) => (
            <li key={record.id} className={styles.item}>
              <div className={styles.identity}>
                <strong>{record.label}</strong>
                <span>
                  Remembered {formatEur(record.unitPriceMinor, locale)} ·{" "}
                  {ageLabel(record, now)}
                </span>
                {record.storeId !== undefined ? (
                  <small>Store-specific memory</small>
                ) : null}
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.useButton}
                  onClick={() => {
                    addRemembered(record);
                  }}
                >
                  Use {formatEur(record.unitPriceMinor, locale)}
                </button>
                <button
                  type="button"
                  className={styles.currentButton}
                  onClick={() => {
                    setErrorMessage("");
                    onEnterCurrentPrice(record);
                  }}
                >
                  Enter current price
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section
          className={styles.confirmation}
          aria-labelledby="remembered-over-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setPending(null);
            }
          }}
        >
          <div>
            <p className={styles.confirmationEyebrow}>Over budget</p>
            <h3 id="remembered-over-title">
              Use the remembered price anyway?
            </h3>
            <p>
              {pending.record.label} at{" "}
              {formatEur(pending.record.unitPriceMinor, locale)} would put
              you{" "}
              <strong>
                {formatAbsoluteEur(
                  pending.projection.nominalOverageMinor,
                  locale,
                )}
              </strong>{" "}
              over your limit. The price is still remembered, not
              confirmed current.
            </p>
          </div>

          <div className={styles.confirmationActions}>
            <button
              ref={cancelRef}
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                setPending(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.addAnywayButton}
              onClick={confirmPending}
            >
              Add remembered price
            </button>
          </div>
        </section>
      )}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
