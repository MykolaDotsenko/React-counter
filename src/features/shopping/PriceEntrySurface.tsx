import { useId, useMemo, useRef, useState } from "react";

import {
  formatEur,
  signedMinorUnits,
  type MinorUnits,
  type MoneyDraftMode,
} from "../../domain/money";
import {
  projectAddItem,
  type ActiveTrip,
  type TripProjection,
} from "../../domain/shopping-trip";
import {
  appendPriceDigit,
  appendPriceSeparator,
  backspacePriceEntry,
  classifyPriceEntryDraft,
  clearPriceEntry,
  initialPriceEntryDraft,
  replacePriceEntryRaw,
  setPriceEntryMode,
  type PriceEntryDraft,
  type PriceEntryInvalidReason,
} from "./price-entry-draft";
import styles from "./PriceEntrySurface.module.css";

export interface PriceEntrySurfaceProps {
  readonly trip: ActiveTrip;
  readonly onCancel: () => void;
  readonly onValidatedPrice: (price: MinorUnits) => void;
  readonly locale?: string;
}

const errorMessage = (reason: PriceEntryInvalidReason): string => {
  switch (reason) {
    case "zero-not-allowed":
      return "Enter a price above €0.";
    case "negative-not-allowed":
      return "Item prices cannot be negative.";
    case "too-many-fraction-digits":
      return "Use no more than two decimal places.";
    case "above-product-limit":
    case "unsafe-integer":
      return "That price is too large.";
    case "invalid-format":
      return "Use a price like 4.79 or 4,79.";
    case "empty":
    case "incomplete":
      return "";
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

const KEYPAD_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
] as const;

const formatAbsoluteSigned = (
  value: number,
  locale: string,
): string => {
  const amount = signedMinorUnits(Math.abs(value));

  if (!amount.ok) {
    throw new RangeError("Projected shopping amount exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

const projectionCopy = (
  trip: ActiveTrip,
  projection: TripProjection,
  locale: string,
): {
  readonly primary: string;
  readonly secondary: string | null;
  readonly status: "within" | "reserve" | "over";
} => {
  if (projection.crossesNominalBudget) {
    return {
      primary: `After adding: ${formatAbsoluteSigned(projection.nominalOverageMinor, locale)} over your limit`,
      secondary: `Cart would be ${formatAbsoluteSigned(projection.cartTotalMinor, locale)} of ${formatEur(trip.budgetMinor, locale)}.`,
      status: "over",
    };
  }

  if (trip.safetyBufferMinor > 0) {
    if (projection.safeRemainingMinor >= 0) {
      return {
        primary: `After adding: ${formatAbsoluteSigned(projection.safeRemainingMinor, locale)} safe to spend`,
        secondary: `${formatAbsoluteSigned(projection.remainingMinor, locale)} remains before your nominal limit.`,
        status: "within",
      };
    }

    return {
      primary: `After adding: ${formatAbsoluteSigned(projection.safeRemainingMinor, locale)} into your reserve`,
      secondary: `${formatAbsoluteSigned(projection.remainingMinor, locale)} remains before your nominal limit.`,
      status: "reserve",
    };
  }

  return {
    primary: `After adding: ${formatAbsoluteSigned(projection.remainingMinor, locale)} left`,
    secondary: null,
    status: "within",
  };
};

export function PriceEntrySurface({
  trip,
  onCancel,
  onValidatedPrice,
  locale = "en-FI",
}: PriceEntrySurfaceProps) {
  const amountInputId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<PriceEntryDraft>(
    initialPriceEntryDraft,
  );

  const state = useMemo(
    () => classifyPriceEntryDraft(draft),
    [draft],
  );

  const validPrice =
    state.kind === "valid" ? state.value : null;

  const projectionResult = useMemo(
    () =>
      validPrice === null
        ? null
        : projectAddItem(trip, {
            unitPriceMinor: validPrice,
            quantity: 1,
          }),
    [trip, validPrice],
  );

  const projection =
    projectionResult?.ok === true
      ? projectionResult.value
      : null;

  const consequence =
    projection === null
      ? null
      : projectionCopy(trip, projection, locale);

  const commit = (): void => {
    if (validPrice === null || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitted(true);
    onValidatedPrice(validPrice);
  };

  const updateMode = (mode: MoneyDraftMode): void => {
    setDraft((current) => setPriceEntryMode(current, mode));
    inputRef.current?.focus();
  };

  const pressKey = (key: string): void => {
    setDraft((current) => {
      if (key === "backspace") {
        return backspacePriceEntry(current);
      }

      if (key === ".") {
        return appendPriceSeparator(current);
      }

      return appendPriceDigit(current, key);
    });

    inputRef.current?.focus();
  };

  const invalidCopy =
    state.kind === "invalid"
      ? errorMessage(state.reason)
      : "";

  return (
    <section
      className={styles.screen}
      aria-labelledby="price-entry-title"
    >
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Add price</p>
            <h1 id="price-entry-title">What does this item cost?</h1>
          </div>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        </header>

        <div className={styles.modeGroup}>
          <div
            className={styles.segmented}
            role="group"
            aria-label="Price entry mode"
          >
            <button
              type="button"
              className={styles.modeButton}
              aria-pressed={draft.mode === "decimal"}
              disabled={draft.raw !== ""}
              onClick={() => {
                updateMode("decimal");
              }}
            >
              Euros
            </button>
            <button
              type="button"
              className={styles.modeButton}
              aria-pressed={draft.mode === "auto-cents"}
              disabled={draft.raw !== ""}
              onClick={() => {
                updateMode("auto-cents");
              }}
            >
              Cents mode
            </button>
          </div>
          <p className={styles.modeHint}>
            {draft.mode === "decimal"
              ? "Type 4.79 for €4.79. Comma also works."
              : "Fast entry: 479 becomes €4.79."}
          </p>
        </div>

        <div className={styles.amountBlock}>
          <label htmlFor={amountInputId} className={styles.amountLabel}>
            Price
          </label>
          <div className={styles.amountShell}>
            <span aria-hidden="true">€</span>
            <input
              ref={inputRef}
              id={amountInputId}
              className={styles.amountInput}
              value={draft.raw}
              inputMode={
                draft.mode === "decimal"
                  ? "decimal"
                  : "numeric"
              }
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-describedby={statusId}
              placeholder={
                draft.mode === "decimal" ? "0.00" : "0"
              }
              onChange={(event) => {
                const nextRaw = event.currentTarget.value;

                setDraft((current) =>
                  replacePriceEntryRaw(current, nextRaw),
                );
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancel();
                }
              }}
            />
          </div>

          <div
            id={statusId}
            className={styles.status}
            aria-live="polite"
          >
            {state.kind === "valid" ? (
              <span className={styles.validPreview}>
                {formatEur(state.value, locale)}
              </span>
            ) : invalidCopy ? (
              <span className={styles.error}>{invalidCopy}</span>
            ) : state.kind === "incomplete" ? (
              <span>Finish the amount.</span>
            ) : (
              <span>Price only. Name and category are optional.</span>
            )}
          </div>
        </div>

        {consequence ? (
          <section
            className={styles.projection}
            data-status={consequence.status}
            aria-label="Projected cart result"
            aria-live="polite"
          >
            <strong>{consequence.primary}</strong>
            {consequence.secondary ? (
              <span>{consequence.secondary}</span>
            ) : null}
          </section>
        ) : null}

        <div className={styles.keypad} aria-label="Price keypad">
          {KEYPAD_ROWS.flat().map((key) => {
            const isSeparator = key === ".";
            const isBackspace = key === "backspace";

            if (isSeparator && draft.mode === "auto-cents") {
              return (
                <button
                  key={key}
                  type="button"
                  className={styles.key}
                  disabled
                  aria-label="Decimal separator unavailable in cents mode"
                >
                  .
                </button>
              );
            }

            return (
              <button
                key={key}
                type="button"
                className={styles.key}
                aria-label={
                  isBackspace
                    ? "Backspace"
                    : isSeparator
                      ? "Decimal separator"
                      : `Digit ${key}`
                }
                onClick={() => {
                  pressKey(key);
                }}
              >
                {isBackspace ? "⌫" : key}
              </button>
            );
          })}
        </div>

        <div className={styles.utilityRow}>
          <button
            type="button"
            className={styles.clearButton}
            disabled={draft.raw === ""}
            onClick={() => {
              setDraft((current) => clearPriceEntry(current));
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
          <p>
            {draft.raw === ""
              ? "Start with the price."
              : "Mode is locked until you clear the draft."}
          </p>
        </div>

        <button
          type="button"
          className={styles.addButton}
          disabled={validPrice === null || submitted}
          onClick={commit}
        >
          {submitted
            ? "Adding…"
            : `Add${validPrice === null ? "" : ` · ${formatEur(validPrice, locale)}`}`}
        </button>
      </div>
    </section>
  );
}
