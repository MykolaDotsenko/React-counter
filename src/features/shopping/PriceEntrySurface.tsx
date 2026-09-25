import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
  formatEur,
  type MinorUnits,
  type MoneyDraftMode,
} from "../../domain/money";
import {
  MAX_ITEM_LABEL_CODE_POINTS,
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
} from "./price-entry-draft";
import {
  canDecreaseQuantity,
  canIncreaseQuantity,
  decreaseQuantity,
  defaultQuantity,
  increaseQuantity,
} from "./quantity-draft";
import { PriceKeypad } from "./PriceKeypad";
import {
  errorMessage,
  formatAbsoluteSigned,
  projectionCopy,
} from "./price-entry-presentation";
import styles from "./PriceEntrySurface.module.css";
import { SHOPPING_LOCALE } from "./shopping-locale";

export interface ValidatedItemIntent {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
  readonly label?: string;
}

export interface PriceEntrySurfaceProps {
  readonly trip: ActiveTrip;
  readonly onCancel: () => void;
  readonly onValidatedItem: (
    intent: ValidatedItemIntent,
  ) => boolean | void;
  readonly initialLabel?: string;
  readonly locale?: string;
}

const prefersCustomKeypad = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

interface OverBudgetConfirmation {
  readonly intent: ValidatedItemIntent;
  readonly projection: TripProjection;
  readonly sourceTrip: ActiveTrip;
}

export function PriceEntrySurface({
  trip,
  onCancel,
  onValidatedItem,
  initialLabel,
  locale = SHOPPING_LOCALE,
}: PriceEntrySurfaceProps) {
  const amountInputId = useId();
  const statusId = useId();
  const projectionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [overBudgetConfirmation, setOverBudgetConfirmation] =
    useState<OverBudgetConfirmation | null>(null);
  const [draft, setDraft] = useState<PriceEntryDraft>(
    initialPriceEntryDraft,
  );
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [label, setLabel] = useState(initialLabel ?? "");
  const [labelError, setLabelError] = useState("");

  useEffect(() => {
    if (prefersCustomKeypad()) {
      titleRef.current?.focus();
      return;
    }

    inputRef.current?.focus();
  }, []);

  const focusInputUnlessCoarse = (): void => {
    if (!prefersCustomKeypad()) {
      inputRef.current?.focus();
    }
  };

  const restoreEntryFocus = (): void => {
    queueMicrotask(() => {
      if (prefersCustomKeypad()) {
        titleRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    });
  };

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
            quantity,
          }),
    [trip, validPrice, quantity],
  );

  const projection =
    projectionResult?.ok === true
      ? projectionResult.value
      : null;

  const consequence =
    projection === null
      ? null
      : projectionCopy(trip, projection, locale);

  const activeConfirmation =
    overBudgetConfirmation?.sourceTrip === trip
      ? overBudgetConfirmation
      : null;

  useEffect(() => {
    if (activeConfirmation !== null) {
      confirmationCancelRef.current?.focus();
    }
  }, [activeConfirmation]);

  const submitValidatedItem = (intent: ValidatedItemIntent): void => {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmissionError("");

    const accepted = onValidatedItem(intent);

    if (accepted === false) {
      submittingRef.current = false;
      setSubmitted(false);
      setSubmissionError("Could not add this item. Check the trip and try again.");
      return;
    }

    setSubmitted(true);
  };

  const commit = (): void => {
    if (
      validPrice === null ||
      submittingRef.current ||
      activeConfirmation !== null
    ) {
      return;
    }

    const normalizedLabel = label.trim();
    const intent: ValidatedItemIntent = {
      unitPriceMinor: validPrice,
      quantity,
      ...(normalizedLabel === ""
        ? {}
        : { label: normalizedLabel }),
    };

    if (projection?.crossesNominalBudget === true) {
      setOverBudgetConfirmation({
        intent,
        projection,
        sourceTrip: trip,
      });
      return;
    }

    submitValidatedItem(intent);
  };

  const cancelOverBudgetConfirmation = (): void => {
    setOverBudgetConfirmation(null);
    restoreEntryFocus();
  };

  const confirmOverBudget = (): void => {
    if (activeConfirmation === null) {
      return;
    }

    submitValidatedItem(activeConfirmation.intent);
  };

  const updateMode = (mode: MoneyDraftMode): void => {
    setDraft((current) => setPriceEntryMode(current, mode));
    focusInputUnlessCoarse();
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

    focusInputUnlessCoarse();
  };

  const invalidCopy =
    state.kind === "invalid"
      ? errorMessage(state.reason)
      : "";

  return (
    <main
      className={styles.screen}
      aria-labelledby="price-entry-title"
    >
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Add price</p>
            <h1
              ref={titleRef}
              id="price-entry-title"
              tabIndex={-1}
            >
              What does this item cost?
            </h1>
          </div>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        </header>

        {initialLabel !== undefined ? (
          <p className={styles.currentPriceContext}>
            Current price for <strong>{initialLabel}</strong>
          </p>
        ) : null}

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
              disabled={draft.raw !== "" || activeConfirmation !== null}
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
              disabled={draft.raw !== "" || activeConfirmation !== null}
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
              readOnly={activeConfirmation !== null}
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

                  if (activeConfirmation === null) {
                    commit();
                  }
                }

                if (event.key === "Escape") {
                  event.preventDefault();

                  if (activeConfirmation !== null) {
                    cancelOverBudgetConfirmation();
                  } else {
                    onCancel();
                  }
                }
              }}
            />
          </div>

          <div
            id={statusId}
            className={styles.status}
            aria-live={
              submissionError || invalidCopy ? "polite" : undefined
            }
          >
            {submissionError ? (
              <span className={styles.error}>{submissionError}</span>
            ) : state.kind === "valid" ? (
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

        <section
          className={styles.quantitySection}
          aria-labelledby="quantity-title"
        >
          <div className={styles.quantityCopy}>
            <span id="quantity-title">Quantity</span>
            <small>
              {MIN_MVP_QUANTITY}–{MAX_MVP_QUANTITY}
            </small>
          </div>

          <div className={styles.quantityStepper}>
            <button
              type="button"
              className={styles.quantityButton}
              aria-label="Decrease quantity"
              disabled={
                activeConfirmation !== null ||
                !canDecreaseQuantity(quantity)
              }
              onClick={() => {
                setQuantity((current) => decreaseQuantity(current));
              }}
            >
              −
            </button>
            <output
              className={styles.quantityValue}
              aria-label="Current quantity"
              aria-live="polite"
            >
              {quantity}
            </output>
            <button
              type="button"
              className={styles.quantityButton}
              aria-label="Increase quantity"
              disabled={
                activeConfirmation !== null ||
                !canIncreaseQuantity(quantity)
              }
              onClick={() => {
                setQuantity((current) => increaseQuantity(current));
              }}
            >
              +
            </button>
          </div>
        </section>

        {projection !== null && validPrice !== null && quantity > 1 ? (
          <p className={styles.lineTotal}>
            {formatEur(validPrice, locale)} × {quantity} ={" "}
            {formatAbsoluteSigned(projection.lineTotalMinor, locale)}
          </p>
        ) : null}

        {consequence ? (
          <section
            id={projectionId}
            className={styles.projection}
            data-status={consequence.status}
            aria-label="Projected cart result"
          >
            <strong>{consequence.primary}</strong>
            {consequence.secondary ? (
              <span>{consequence.secondary}</span>
            ) : null}
          </section>
        ) : null}

        {activeConfirmation === null ? (
          <>
          <PriceKeypad mode={draft.mode} onPress={pressKey} />

          <div className={styles.utilityRow}>
            <button
              type="button"
              className={styles.clearButton}
              disabled={draft.raw === ""}
              onClick={() => {
                setDraft((current) => clearPriceEntry(current));
                focusInputUnlessCoarse();
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
            aria-describedby={projection === null ? undefined : projectionId}
            onClick={commit}
          >
            {submitted
              ? "Adding…"
              : `Add${projection === null ? "" : ` · ${formatAbsoluteSigned(projection.lineTotalMinor, locale)}`}`}
          </button>

          <details className={styles.labelDetails}>
            <summary>Name for next time <span>Optional</span></summary>
            <label className={styles.labelField}>
              <span>Item name</span>
              <input
                value={label}
                autoComplete="off"
                spellCheck={false}
                placeholder="Milk 1L"
                aria-invalid={Boolean(labelError)}
                onChange={(event) => {
                  const next = event.currentTarget.value;

                  if ([...next].length > MAX_ITEM_LABEL_CODE_POINTS) {
                    setLabelError(
                      `Keep the name within ${MAX_ITEM_LABEL_CODE_POINTS} characters.`,
                    );
                    return;
                  }

                  setLabel(next);
                  setLabelError("");
                }}
              />
            </label>
            <p className={styles.labelHint}>
              Named confirmed items can appear in Recent Items after this trip is finished.
            </p>
            {labelError ? (
              <p className={styles.labelError} role="alert">
                {labelError}
              </p>
            ) : null}
          </details>
          </>
        ) : (
          <section
            className={styles.overBudgetConfirmation}
            aria-labelledby="over-budget-title"
            aria-describedby="over-budget-detail"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelOverBudgetConfirmation();
              }
            }}
          >
            <div className={styles.confirmationCopy}>
              <p className={styles.confirmationEyebrow}>Over budget</p>
              <h2 id="over-budget-title">
                Add this price anyway?
              </h2>
              <p id="over-budget-detail">
                This puts you{" "}
                <strong>
                  {formatAbsoluteSigned(
                    activeConfirmation.projection.nominalOverageMinor,
                    locale,
                  )}
                </strong>{" "}
                over your limit. Your current trip has not changed.
              </p>
            </div>

            <div className={styles.confirmationActions}>
              <button
                ref={confirmationCancelRef}
                type="button"
                className={styles.confirmationCancel}
                onClick={cancelOverBudgetConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.addAnywayButton}
                disabled={submitted}
                onClick={confirmOverBudget}
              >
                {submitted
                  ? "Adding…"
                  : `Add anyway · ${formatAbsoluteSigned(
                      activeConfirmation.projection.lineTotalMinor,
                      locale,
                    )}`}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
