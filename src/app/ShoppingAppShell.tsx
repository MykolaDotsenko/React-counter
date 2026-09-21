import { useRef, useState } from "react";

import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import { formatEur } from "../domain/money";
import { lineTotal } from "../domain/shopping-trip";
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
            `${formatEur(lineTotal(addedItem), "en-FI")} added`,
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
      onAddPrice={() => {
        setLastAddedMessage("");
        setPriceEntryOpen(true);
      }}
    />
  );
}
