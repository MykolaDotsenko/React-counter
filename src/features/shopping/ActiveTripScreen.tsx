import type { CSSProperties, Ref } from "react";

import { useShoppingAppState } from "../../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../../application/shopping-app-controller";
import { formatEur, signedMinorUnits } from "../../domain/money";
import {
  cartTotal,
  itemCount,
  lineTotal,
  remaining,
  safeLimit,
  safeRemaining,
  type CartItem,
} from "../../domain/shopping-trip";
import { PersistenceHealthNotice } from "./PersistenceHealthNotice";
import styles from "./ActiveTripScreen.module.css";

export interface ActiveTripScreenProps {
  readonly controller: ShoppingAppController;
  readonly onAddPrice: () => void;
  readonly onFinishTrip?: () => void;
  readonly onAdjustBudget?: () => void;
  readonly addPriceButtonRef?: Ref<HTMLButtonElement>;
  readonly finishTripButtonRef?: Ref<HTMLButtonElement>;
  readonly adjustBudgetButtonRef?: Ref<HTMLButtonElement>;
  readonly feedbackMessage?: string;
  readonly onUndo?: () => void;
  readonly onEditItem?: (item: CartItem) => void;
  readonly onRemoveItem?: (item: CartItem) => void;
  readonly locale?: string;
}

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
      return "Manual";
    case "price-memory":
      return "Price memory";
    case "shelf-scan":
      return "Shelf scan";
    case "encoded-barcode":
      return "Barcode";
    case "retailer-feed":
      return "Retailer feed";
    default: {
      const exhaustive: never = item.priceSource;
      return exhaustive;
    }
  }
};

const clampPercentage = (value: number): number =>
  Math.min(100, Math.max(0, value));

const formatSignedAmount = (
  value: number,
  locale: string,
): string => {
  const amount = signedMinorUnits(value);

  if (!amount.ok) {
    throw new RangeError("Shopping summary amount exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

export function ActiveTripScreen({
  controller,
  onAddPrice,
  onFinishTrip,
  onAdjustBudget,
  addPriceButtonRef,
  finishTripButtonRef,
  adjustBudgetButtonRef,
  feedbackMessage,
  onUndo,
  onEditItem,
  onRemoveItem,
  locale = "en-FI",
}: ActiveTripScreenProps) {
  const state = useShoppingAppState(controller);
  const trip = state.activeTrip;

  if (state.lifecycle !== "active" || trip === null) {
    return null;
  }

  const total = cartTotal(trip);
  const nominalRemaining = remaining(trip);
  const protectedRemaining = safeRemaining(trip);
  const protectedLimit = safeLimit(trip);
  const hasBuffer = trip.safetyBufferMinor > 0;
  const nominalOverBudget = nominalRemaining < 0;
  const reserveInUse =
    hasBuffer && protectedRemaining < 0 && !nominalOverBudget;

  const heroAmount = nominalOverBudget
    ? Math.abs(nominalRemaining)
    : reserveInUse
      ? 0
      : hasBuffer
        ? protectedRemaining
        : nominalRemaining;

  const heroLabel = nominalOverBudget
    ? "over your limit"
    : reserveInUse
      ? "safe to spend"
      : hasBuffer
        ? "safe to spend"
        : "left";

  const spentPercent = clampPercentage(
    (total / trip.budgetMinor) * 100,
  );
  const safeBoundaryPercent = clampPercentage(
    (protectedLimit / trip.budgetMinor) * 100,
  );
  const reservePercent = hasBuffer
    ? clampPercentage(
        (trip.safetyBufferMinor / trip.budgetMinor) * 100,
      )
    : 0;

  const capacityStyle = {
    "--spent-percent": `${spentPercent}%`,
    "--safe-boundary-percent": `${safeBoundaryPercent}%`,
    "--reserve-percent": `${reservePercent}%`,
  } as CSSProperties;

  const totalQuantity = itemCount(trip);
  const remainingContext = nominalOverBudget
    ? `${formatSignedAmount(Math.abs(nominalRemaining), locale)} over your limit`
    : reserveInUse
      ? `Safety buffer reached · ${formatSignedAmount(
          nominalRemaining,
          locale,
        )} remains in your nominal budget`
      : hasBuffer
        ? `${formatSignedAmount(protectedRemaining, locale)} available before your reserve`
        : `${formatSignedAmount(nominalRemaining, locale)} available before your limit`;

  return (
    <main className={styles.screen}>
      <section className={styles.shell} aria-labelledby="active-trip-title">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Shopping trip</p>
            <h1 id="active-trip-title" className={styles.title}>
              Know what’s left
            </h1>
          </div>
          <p className={styles.itemCount}>
            {totalQuantity === 0
              ? "No items yet"
              : `${totalQuantity} ${totalQuantity === 1 ? "item" : "items"}`}
          </p>
        </header>

        <section
          className={styles.hero}
          aria-label="Current spending status"
          data-status={
            nominalOverBudget
              ? "over"
              : reserveInUse
                ? "reserve"
                : "within"
          }
        >
          <p className={styles.heroAmount}>
            {formatSignedAmount(heroAmount, locale)}
          </p>
          <p className={styles.heroLabel}>{heroLabel}</p>
          <p className={styles.heroContext}>{remainingContext}</p>
        </section>

        <PersistenceHealthNotice
          controller={controller}
          health={state.persistence}
        />

        <section className={styles.summary} aria-label="Budget summary">
          <div className={styles.summaryRow}>
            <span>Cart</span>
            <strong>
              {formatEur(total, locale)} of {formatEur(trip.budgetMinor, locale)}
            </strong>
          </div>

          <div
            className={styles.capacity}
            role="progressbar"
            aria-label="Shopping budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(spentPercent)}
            aria-valuetext={
              hasBuffer
                ? `${formatEur(total, locale)} in cart. ${remainingContext}. Reserve ${formatEur(
                    trip.safetyBufferMinor,
                    locale,
                  )}.`
                : `${formatEur(total, locale)} in cart. ${remainingContext}.`
            }
            style={capacityStyle}
          >
            <span className={styles.capacityFill} aria-hidden="true" />
            {hasBuffer ? (
              <span
                className={styles.reserveZone}
                data-consumed={reserveInUse || nominalOverBudget}
                aria-hidden="true"
              />
            ) : null}
          </div>

          <div className={styles.capacityLabels} aria-hidden="true">
            <span>Cart {formatEur(total, locale)}</span>
            <span>
              {hasBuffer
                ? `Safe limit ${formatEur(protectedLimit, locale)} · Reserve ${formatEur(
                    trip.safetyBufferMinor,
                    locale,
                  )}`
                : `Budget ${formatEur(trip.budgetMinor, locale)}`}
            </span>
          </div>

          {hasBuffer ? (
            <p className={styles.reserveNote}>
              {formatEur(trip.safetyBufferMinor, locale)} kept in reserve.
              Nominally{" "}
              {nominalRemaining >= 0
                ? `${formatSignedAmount(nominalRemaining, locale)} remains`
                : `${formatSignedAmount(Math.abs(nominalRemaining), locale)} over budget`}.
            </p>
          ) : null}

          {onAdjustBudget ? (
            <button
              ref={adjustBudgetButtonRef}
              type="button"
              className={styles.adjustBudgetButton}
              onClick={onAdjustBudget}
            >
              Adjust budget
            </button>
          ) : null}
        </section>

        {feedbackMessage || (state.undo !== null && onUndo) ? (
          <div className={styles.feedback}>
            {feedbackMessage ? (
              <p role="status" aria-live="polite">
                {feedbackMessage}
              </p>
            ) : null}
            {state.undo !== null && onUndo ? (
              <button
                type="button"
                className={styles.undoButton}
                onClick={onUndo}
              >
                Undo
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.tripActions}>
          <button
            ref={addPriceButtonRef}
            type="button"
            className={styles.addButton}
            onClick={onAddPrice}
          >
            <span aria-hidden="true">+</span>
            <span>Add price</span>
          </button>
          {onFinishTrip ? (
            <button
              ref={finishTripButtonRef}
              type="button"
              className={styles.finishButton}
              onClick={onFinishTrip}
            >
              Finish trip
            </button>
          ) : null}
        </div>

        <section className={styles.cart} aria-labelledby="cart-title">
          <div className={styles.cartHeading}>
            <div>
              <p className={styles.sectionKicker}>Current cart</p>
              <h2 id="cart-title">What you have added</h2>
            </div>
            <strong>{formatEur(total, locale)}</strong>
          </div>

          {trip.items.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nothing in your cart yet.</p>
              <span>
                Add each price as you shop. A name is optional.
              </span>
            </div>
          ) : (
            <ul className={styles.itemList}>
              {trip.items.map((item, index) => {
                const itemTotal = lineTotal(item);

                return (
                  <li key={item.id} className={styles.item}>
                    <div className={styles.itemIdentity}>
                      <strong>{item.label ?? `Item ${index + 1}`}</strong>
                      {item.quantity > 1 ? (
                        <span>
                          {formatEur(item.unitPriceMinor, locale)} × {item.quantity}
                        </span>
                      ) : null}
                      {item.priceConfidence.kind !== "confirmed" ||
                      item.priceSource.kind !== "manual" ? (
                        <small
                          className={styles.itemTrust}
                          data-confidence={item.priceConfidence.kind}
                        >
                          {confidenceLabel(item)} · {sourceLabel(item)}
                        </small>
                      ) : null}
                    </div>

                    <div className={styles.itemActions}>
                      <strong className={styles.itemTotal}>
                        {formatEur(itemTotal, locale)}
                      </strong>
                      {onEditItem || onRemoveItem ? (
                        <div className={styles.itemButtons}>
                          {onEditItem ? (
                            <button
                              type="button"
                              className={styles.itemActionButton}
                              data-edit-item-id={item.id}
                              onClick={() => {
                                onEditItem(item);
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          {onRemoveItem ? (
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => {
                                onRemoveItem(item);
                              }}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
