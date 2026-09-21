import { useRef, useState } from "react";

import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import { formatEur, signedMinorUnits } from "../domain/money";
import {
  lineTotal,
  remaining,
  safeRemaining,
  type ActiveTrip,
  type CartItem,
} from "../domain/shopping-trip";
import { ActiveTripScreen } from "../features/shopping/ActiveTripScreen";
import {
  PriceEntrySurface,
  type ValidatedItemIntent,
} from "../features/shopping/PriceEntrySurface";
import { RecoveryScreen } from "../features/shopping/RecoveryScreen";
import { StartTripScreen } from "../features/shopping/StartTripScreen";
import styles from "./ShoppingAppShell.module.css";

export interface ShoppingAppShellProps {
  readonly controller: ShoppingAppController;
}

const formatAbsoluteEur = (value: number, locale: string): string => {
  const amount = signedMinorUnits(Math.abs(value));

  if (!amount.ok) {
    throw new RangeError("Shopping feedback amount exceeded safe integer bounds");
  }

  return formatEur(amount.value, locale);
};

const remainingFeedback = (trip: ActiveTrip, locale: string): string => {
  const nominalRemaining = remaining(trip);

  if (nominalRemaining < 0) {
    return `${formatAbsoluteEur(nominalRemaining, locale)} over your limit.`;
  }

  if (trip.safetyBufferMinor > 0) {
    const protectedRemaining = safeRemaining(trip);

    if (protectedRemaining >= 0) {
      return `${formatEur(protectedRemaining, locale)} safe to spend.`;
    }

    return `${formatEur(nominalRemaining, locale)} remains before your nominal limit.`;
  }

  return `${formatEur(nominalRemaining, locale)} remaining.`;
};

const addedFeedback = (
  trip: ActiveTrip,
  item: CartItem,
  locale: string,
): string =>
  `${formatEur(lineTotal(item), locale)} added. ${remainingFeedback(trip, locale)}`;

export function ShoppingAppShell({
  controller,
}: ShoppingAppShellProps) {
  const state = useShoppingAppState(controller);
  const addPriceButtonRef = useRef<HTMLButtonElement>(null);
  const [priceEntryOpen, setPriceEntryOpen] = useState(false);
  const [lastAddedMessage, setLastAddedMessage] = useState("");

  const returnFocusToAddPrice = (): void => {
    queueMicrotask(() => {
      addPriceButtonRef.current?.focus();
    });
  };

  if (state.lifecycle === "booting") {
    return (
      <main className={styles.loading} aria-busy="true">
        <p>Opening your shopping budget…</p>
      </main>
    );
  }

  if (state.lifecycle === "recovery") {
    return <RecoveryScreen controller={controller} />;
  }

  if (state.lifecycle === "idle") {
    return <StartTripScreen controller={controller} />;
  }

  if (priceEntryOpen && state.activeTrip !== null) {
    return (
      <PriceEntrySurface
        trip={state.activeTrip}
        locale="en-FI"
        onCancel={() => {
          setPriceEntryOpen(false);
          returnFocusToAddPrice();
        }}
        onValidatedItem={(intent: ValidatedItemIntent) => {
          const result = controller.addManualItem(intent);

          if (
            !result.ok ||
            !result.changed ||
            result.state.activeTrip === null
          ) {
            return false;
          }

          const addedItem = result.state.activeTrip.items.at(-1);

          if (addedItem === undefined) {
            return false;
          }

          setLastAddedMessage(
            addedFeedback(result.state.activeTrip, addedItem, "en-FI"),
          );
          setPriceEntryOpen(false);
          returnFocusToAddPrice();
          return true;
        }}
      />
    );
  }

  return (
    <ActiveTripScreen
      controller={controller}
      addPriceButtonRef={addPriceButtonRef}
      feedbackMessage={lastAddedMessage}
      onUndo={() => {
        const result = controller.undo();

        if (
          result.ok &&
          result.changed &&
          result.state.activeTrip !== null
        ) {
          setLastAddedMessage(
            `Last change undone. ${remainingFeedback(
              result.state.activeTrip,
              "en-FI",
            )}`,
          );
          returnFocusToAddPrice();
        }
      }}
      onAddPrice={() => {
        setLastAddedMessage("");
        setPriceEntryOpen(true);
      }}
    />
  );
}
