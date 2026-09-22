import { useMemo, useRef, useState } from "react";

import {
  formatEur,
  signedMinorUnits,
  type MinorUnits,
  type SignedMinorUnits,
} from "../../domain/money";
import {
  cartTotal,
  reduceTrip,
  remaining,
  safeRemaining,
  type ActiveTrip,
  type CartItem,
} from "../../domain/shopping-trip";
import {
  classifyPriceEntryDraft,
  replacePriceEntryRaw,
  type PriceEntryDraft,
} from "./price-entry-draft";
import {
  canIncreaseQuantity,
  decreaseQuantity,
  increaseQuantity,
} from "./quantity-draft";
import styles from "./ItemEditSurface.module.css";

export interface ItemEditIntent {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
  readonly label?: string | null;
}

export interface ItemEditSurfaceProps {
  readonly trip: ActiveTrip;
  readonly item: CartItem;
  readonly onCancel: () => void;
  readonly onSave: (intent: ItemEditIntent) => boolean | void;
  readonly onRemove: () => boolean | void;
  readonly locale?: string;
}

const rawPrice = (minor: MinorUnits): string => {
  const euros = Math.floor(minor / 100);
  const cents = minor % 100;
  return `${euros}.${String(cents).padStart(2, "0")}`;
};

const absoluteMoney = (value: number): SignedMinorUnits => {
  const result = signedMinorUnits(Math.abs(value));

  if (!result.ok) {
    throw new RangeError("Edited shopping amount exceeded safe integer bounds");
  }

  return result.value;
};

const confidenceLabel = (item: CartItem): string => {
  switch (item.priceConfidence.kind) {
    case "confirmed":
      return "Confirmed";
    case "remembered":
      return "Remembered";
    case "estimated":
      return "Estimated";
    default: {
      const exhaustive: never = item.priceConfidence;
      return exhaustive;
    }
  }
};

const sourceLabel = (item: CartItem): string => {
  switch (item.priceSource.kind) {
    case "manual":
      return "manual";
    case "price-memory":
      return "price memory";
    case "shelf-scan":
      return "shelf scan";
    case "encoded-barcode":
      return "barcode";
    case "retailer-feed":
      return "retailer feed";
    default: {
      const exhaustive: never = item.priceSource;
      return exhaustive;
    }
  }
};

export function ItemEditSurface({
  trip,
  item,
  onCancel,
  onSave,
  onRemove,
  locale = "en-FI",
}: ItemEditSurfaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PriceEntryDraft>(() => ({
    raw: rawPrice(item.unitPriceMinor),
    mode: "decimal",
  }));
  const [quantity, setQuantity] = useState(item.quantity);
  const [label, setLabel] = useState(item.label ?? "");
  const [submissionError, setSubmissionError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const priceState = useMemo(
    () => classifyPriceEntryDraft(draft),
    [draft],
  );
  const validPrice =
    priceState.kind === "valid" ? priceState.value : null;

  const projectedTrip = useMemo(() => {
    if (validPrice === null) {
      return null;
    }

    const result = reduceTrip(trip, {
      type: "update-item",
      itemId: item.id,
      patch: {
        unitPriceMinor: validPrice,
        quantity,
      },
      now: item.updatedAt,
    });

    return result.ok && result.value.status === "active"
      ? result.value
      : null;
  }, [item.id, item.updatedAt, quantity, trip, validPrice]);

  const normalizedLabel = label.trim();
  const canonicalLabel = normalizedLabel === "" ? undefined : normalizedLabel;
  const changed =
    validPrice !== null &&
    (validPrice !== item.unitPriceMinor ||
      quantity !== item.quantity ||
      canonicalLabel !== item.label);

  const submit = (): void => {
    if (validPrice === null || !changed || submitted) {
      return;
    }

    setSubmissionError("");
    const accepted = onSave({
      unitPriceMinor: validPrice,
      quantity,
      ...(canonicalLabel === item.label
        ? {}
        : { label: canonicalLabel ?? null }),
    });

    if (accepted === false) {
      setSubmissionError("Could not save this correction. Try again.");
      return;
    }

    setSubmitted(true);
  };

  let projectionPrimary = "";
  let projectionSecondary = "";

  if (projectedTrip !== null) {
    const nominal = remaining(projectedTrip);
    const safe = safeRemaining(projectedTrip);

    if (nominal < 0) {
      projectionPrimary = `After saving: ${formatEur(
        absoluteMoney(nominal),
        locale,
      )} over your limit`;
    } else if (projectedTrip.safetyBufferMinor > 0 && safe < 0) {
      projectionPrimary = "After saving: €0.00 safe to spend";
      projectionSecondary = `${formatEur(
        absoluteMoney(nominal),
        locale,
      )} remains in your nominal budget.`;
    } else if (projectedTrip.safetyBufferMinor > 0) {
      projectionPrimary = `After saving: ${formatEur(
        absoluteMoney(safe),
        locale,
      )} safe to spend`;
      projectionSecondary = `${formatEur(
        absoluteMoney(nominal),
        locale,
      )} remains before your nominal limit.`;
    } else {
      projectionPrimary = `After saving: ${formatEur(
        absoluteMoney(nominal),
        locale,
      )} left`;
    }

    if (projectionSecondary === "") {
      projectionSecondary = `Cart would be ${formatEur(
        cartTotal(projectedTrip),
        locale,
      )} of ${formatEur(projectedTrip.budgetMinor, locale)}.`;
    }
  }

  const invalidMessage =
    priceState.kind === "invalid"
      ? "Enter a valid price above €0 with no more than two decimals."
      : priceState.kind === "incomplete"
        ? "Finish the price."
        : "";

  return (
    <main className={styles.screen} aria-labelledby="edit-item-title">
      <section className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Correct item</p>
            <h1 id="edit-item-title">
              {item.label ?? "Edit price and quantity"}
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

        <p className={styles.trust}>
          {confidenceLabel(item)} · {sourceLabel(item)}
        </p>

        <label className={styles.field}>
          <span>Item name <small>Optional · helps Recent Items</small></span>
          <input
            value={label}
            autoComplete="off"
            spellCheck={false}
            placeholder="Milk 1L"
            onChange={(event) => {
              setLabel(event.currentTarget.value);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>Price</span>
          <div className={styles.priceInput}>
            <span aria-hidden="true">€</span>
            <input
              ref={inputRef}
              value={draft.raw}
              inputMode="decimal"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(invalidMessage)}
              onChange={(event) => {
                const nextRaw = event.currentTarget.value;

                setDraft((current) =>
                  replacePriceEntryRaw(current, nextRaw),
                );
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancel();
                }
              }}
            />
          </div>
          {invalidMessage ? (
            <small className={styles.error} role="status">
              {invalidMessage}
            </small>
          ) : null}
        </label>

        <section
          className={styles.quantitySection}
          aria-labelledby="edit-quantity-title"
        >
          <div>
            <span id="edit-quantity-title">Quantity</span>
            <small>Changes apply immediately when you save.</small>
          </div>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label={
                quantity === 1
                  ? "Remove item by decreasing quantity"
                  : "Decrease edited quantity"
              }
              onClick={() => {
                if (quantity === 1) {
                  onRemove();
                  return;
                }

                setQuantity((current) => decreaseQuantity(current));
              }}
            >
              −
            </button>
            <output aria-label="Edited quantity">{quantity}</output>
            <button
              type="button"
              aria-label="Increase edited quantity"
              disabled={!canIncreaseQuantity(quantity)}
              onClick={() => {
                setQuantity((current) => increaseQuantity(current));
              }}
            >
              +
            </button>
          </div>
        </section>

        {projectionPrimary ? (
          <section className={styles.projection} aria-live="polite">
            <strong>{projectionPrimary}</strong>
            <span>{projectionSecondary}</span>
          </section>
        ) : null}

        <p className={styles.guidance}>
          Correcting a price records your manual value as confirmed.
          Quantity-only changes keep the existing price provenance.
        </p>

        {submissionError ? (
          <p className={styles.error} role="alert">
            {submissionError}
          </p>
        ) : null}

        <button
          type="button"
          className={styles.saveButton}
          disabled={!changed || validPrice === null || submitted}
          onClick={submit}
        >
          {submitted ? "Saving…" : "Save correction"}
        </button>
      </section>
    </main>
  );
}
