import { useState } from "react";

import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import { ActiveTripScreen } from "../features/shopping/ActiveTripScreen";
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
  const [phaseNotice, setPhaseNotice] = useState(false);

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

  return (
    <>
      <ActiveTripScreen
        controller={controller}
        onAddPrice={() => {
          setPhaseNotice(true);
        }}
      />

      {phaseNotice ? (
        <aside
          className={styles.phaseNotice}
          role="status"
          aria-live="polite"
        >
          <strong>Price entry is the next migration step.</strong>
          <span>
            Your current budget and saved trip remain unchanged.
          </span>
          <button
            type="button"
            onClick={() => {
              setPhaseNotice(false);
            }}
          >
            Dismiss
          </button>
        </aside>
      ) : null}
    </>
  );
}
