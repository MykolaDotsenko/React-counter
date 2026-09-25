import { useEffect, useMemo, useRef, useState } from "react";

import { useShoppingAppState } from "../../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../../application/shopping-app-controller";
import { settleMotion } from "../../app/motion";
import {
  formatEur,
  parseEurDraft,
  signedMinorUnits,
} from "../../domain/money";
import {
  cartTotal,
  checkoutDifference,
  itemCount,
  type CompletedTrip,
} from "../../domain/shopping-trip";
import { PersistenceHealthNotice } from "./PersistenceHealthNotice";
import styles from "./CompletedSummaryScreen.module.css";

export interface CompletedSummaryScreenProps {
  readonly controller: ShoppingAppController;
  readonly trip: CompletedTrip;
  readonly onDone: () => void;
  readonly onShopAgain: () => void;
  readonly onViewHistory: () => void;
  readonly locale?: string;
}

const rawMoney = (minor: number): string => {
  const euros = Math.floor(minor / 100);
  const cents = minor % 100;
  return `${euros}.${String(cents).padStart(2, "0")}`;
};

const formatAbsoluteEur = (
  value: number,
  locale: string,
): string => {
  const result = signedMinorUnits(Math.abs(value));

  if (!result.ok) {
    throw new RangeError("Checkout difference exceeded safe integer bounds");
  }

  return formatEur(result.value, locale);
};

const reconciliationCopy = (
  trip: CompletedTrip,
  locale: string,
): string | null => {
  const difference = checkoutDifference(trip);

  if (difference === null) {
    return null;
  }

  if (difference === 0) {
    return "Checkout matched the tracked cart exactly.";
  }

  if (difference > 0) {
    return `${formatAbsoluteEur(
      difference,
      locale,
    )} more than the tracked cart.`;
  }

  return `${formatAbsoluteEur(
    difference,
    locale,
  )} less than the tracked cart.`;
};

export function CompletedSummaryScreen({
  controller,
  trip,
  onDone,
  onShopAgain,
  onViewHistory,
  locale = "en-FI",
}: CompletedSummaryScreenProps) {
  const state = useShoppingAppState(controller);
  const shellMotionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    settleMotion(shellMotionRef.current, 180);
  }, []);
  const [checkoutRaw, setCheckoutRaw] = useState(() =>
    trip.actualCheckoutMinor === undefined
      ? ""
      : rawMoney(trip.actualCheckoutMinor),
  );
  const [inputError, setInputError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const currentTrip =
    state.completedSummary?.id === trip.id
      ? state.completedSummary
      : trip;
  const total = cartTotal(currentTrip);
  const quantity = itemCount(currentTrip);
  const reconciliation = reconciliationCopy(currentTrip, locale);

  const parsedCheckout = useMemo(() => {
    if (checkoutRaw.trim() === "") {
      return null;
    }

    return parseEurDraft({
      raw: checkoutRaw,
      mode: "decimal",
    });
  }, [checkoutRaw]);

  const saveCheckout = (): void => {
    setInputError("");
    setStatusMessage("");

    if (parsedCheckout === null) {
      setInputError("Enter the checkout total first.");
      return;
    }

    if (!parsedCheckout.ok) {
      setInputError(
        "Enter a valid euro total with no more than two decimals.",
      );
      return;
    }

    const result = controller.setActualCheckout(parsedCheckout.value);

    if (!result.ok) {
      setInputError("Could not apply that checkout total.");
      return;
    }

    if (!result.changed) {
      setStatusMessage("Checkout total is already up to date.");
      return;
    }

    setStatusMessage(
      result.durability === "persisted"
        ? "Checkout total saved."
        : "Checkout total updated here, but it is not safely saved yet.",
    );
  };

  const shopAgain = (): void => {
    setStatusMessage("");
    const result = controller.startTripFromCompleted(currentTrip.id);

    if (!result.ok) {
      setStatusMessage(
        result.error.kind === "application" &&
        result.error.code === "repeat-source-unavailable"
          ? "Retry saving before starting another trip from this budget."
          : "Could not start another trip from this budget.",
      );
      return;
    }

    onShopAgain();
  };

  const done = (): void => {
    setStatusMessage("");
    const result = controller.dismissCompletedSummary();

    if (!result.ok) {
      setStatusMessage(
        "Retry saving before leaving this completed-trip summary.",
      );
      return;
    }

    onDone();
  };

  return (
    <main className={styles.screen} aria-labelledby="completed-title">
      <section ref={shellMotionRef} className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Trip finished</p>
          <h1 id="completed-title">Your shopping trip is complete</h1>
          <p>
            The tracked trip is now history. Adding the checkout total is
            optional and only helps explain any difference.
          </p>
        </header>

        <PersistenceHealthNotice
          controller={controller}
          health={state.persistence}
          context="completed"
        />

        <section className={styles.hero} aria-label="Completed trip summary">
          <span>Tracked cart</span>
          <strong>{formatEur(total, locale)}</strong>
          <small>
            {quantity} {quantity === 1 ? "item" : "items"} · budget{" "}
            {formatEur(currentTrip.budgetMinor, locale)}
          </small>
        </section>

        <section
          className={styles.reconciliation}
          aria-labelledby="checkout-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>Optional reconciliation</p>
              <h2 id="checkout-title">What did checkout actually cost?</h2>
            </div>
            {currentTrip.actualCheckoutMinor !== undefined ? (
              <strong>
                {formatEur(currentTrip.actualCheckoutMinor, locale)}
              </strong>
            ) : null}
          </div>

          <p className={styles.supporting}>
            Enter the receipt or checkout total if you want to compare it
            with your tracked cart. This does not change the cart itself.
          </p>

          <div className={styles.checkoutRow}>
            <label className={styles.field}>
              <span>Actual checkout total</span>
              <div className={styles.inputShell}>
                <span aria-hidden="true">€</span>
                <input
                  value={checkoutRaw}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={rawMoney(total)}
                  aria-invalid={Boolean(inputError)}
                  onChange={(event) => {
                    setCheckoutRaw(event.currentTarget.value);
                    setInputError("");
                    setStatusMessage("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveCheckout();
                    }
                  }}
                />
              </div>
            </label>
            <button
              type="button"
              className={styles.saveButton}
              onClick={saveCheckout}
            >
              Save checkout total
            </button>
          </div>

          {inputError ? (
            <p className={styles.error} role="alert">
              {inputError}
            </p>
          ) : null}

          {reconciliation ? (
            <p className={styles.difference} role="status">
              {reconciliation}
            </p>
          ) : (
            <p className={styles.neutral}>
              No checkout total added. Your completed trip is still valid.
            </p>
          )}
        </section>

        {statusMessage ? (
          <p className={styles.status} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.repeatButton}
            onClick={shopAgain}
          >
            Shop again
          </button>
          <button
            type="button"
            className={styles.historyButton}
            onClick={onViewHistory}
          >
            View trip history
          </button>
          <button
            type="button"
            className={styles.doneButton}
            onClick={done}
          >
            Done
          </button>
        </div>
      </section>
    </main>
  );
}
