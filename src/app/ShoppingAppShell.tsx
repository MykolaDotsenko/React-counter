import { useEffect, useRef, useState } from "react";

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
import { ShoppingTimingQaPanel } from "../qa/ShoppingTimingQaPanel";
import {
  appendQaTimingSample,
  captureQaTimingEnvironment,
  createQaTimingSession,
  loadQaTimingSession,
  persistQaTimingSession,
  resetQaTimingSamples,
  updateQaChecklist,
  updateQaCompactDeviceLabel,
  updateQaDeviceLabel,
  updateQaTimingNotes,
  type QaTimingSession,
} from "../qa/shopping-timing";
import "./shopping-theme.css";
import styles from "./ShoppingAppShell.module.css";

export interface ShoppingAppShellProps {
  readonly controller: ShoppingAppController;
}

const qaTimingEnabled =
  import.meta.env.VITE_SHOPPING_QA_TIMING === "1";

interface PendingQaSample {
  readonly unitPriceMinor: number;
  readonly quantity: number;
  readonly lineTotalMinor: number;
  readonly budgetMinor: number;
  readonly safetyBufferMinor: number;
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
  const qaStartedAtRef = useRef<number | null>(null);
  const qaPendingSampleRef = useRef<PendingQaSample | null>(null);
  const [priceEntryOpen, setPriceEntryOpen] = useState(false);
  const [lastAddedMessage, setLastAddedMessage] = useState("");
  const [qaSession, setQaSession] = useState<QaTimingSession | null>(() => {
    if (!qaTimingEnabled) {
      return null;
    }

    const environment = captureQaTimingEnvironment();

    try {
      return loadQaTimingSession(sessionStorage, environment);
    } catch {
      return createQaTimingSession(environment);
    }
  });

  const returnFocusToAddPrice = (): void => {
    queueMicrotask(() => {
      addPriceButtonRef.current?.focus();
    });
  };

  const updateQaSessionState = (
    updater: (current: QaTimingSession) => QaTimingSession,
  ): void => {
    setQaSession((current) => {
      if (current === null) {
        return null;
      }

      const next = updater(current);

      try {
        persistQaTimingSession(sessionStorage, next);
      } catch {
        // QA persistence must never change shopping product behavior.
      }

      return next;
    });
  };

  useEffect(() => {
    if (
      !qaTimingEnabled ||
      priceEntryOpen ||
      qaPendingSampleRef.current === null ||
      qaStartedAtRef.current === null
    ) {
      return;
    }

    const pending = qaPendingSampleRef.current;
    const durationMs = performance.now() - qaStartedAtRef.current;

    qaPendingSampleRef.current = null;
    qaStartedAtRef.current = null;

    setQaSession((current) => {
      if (current === null) {
        return null;
      }

      const next = appendQaTimingSample(current, {
        id: crypto.randomUUID(),
        durationMs,
        unitPriceMinor: pending.unitPriceMinor,
        quantity: pending.quantity,
        lineTotalMinor: pending.lineTotalMinor,
        budgetMinor: pending.budgetMinor,
        safetyBufferMinor: pending.safetyBufferMinor,
        completedAt: new Date().toISOString(),
      });

      try {
        persistQaTimingSession(sessionStorage, next);
      } catch {
        // Timing evidence still remains visible in memory.
      }

      return next;
    });
  }, [priceEntryOpen]);

  const qaPanel =
    qaSession === null ? null : (
      <ShoppingTimingQaPanel
        session={qaSession}
        onChecklistChange={(key, value) => {
          updateQaSessionState((current) =>
            updateQaChecklist(current, key, value),
          );
        }}
        onDeviceLabelChange={(value) => {
          updateQaSessionState((current) =>
            updateQaDeviceLabel(current, value),
          );
        }}
        onCompactDeviceLabelChange={(value) => {
          updateQaSessionState((current) =>
            updateQaCompactDeviceLabel(current, value),
          );
        }}
        onNotesChange={(value) => {
          updateQaSessionState((current) =>
            updateQaTimingNotes(current, value),
          );
        }}
        onResetSamples={() => {
          updateQaSessionState(resetQaTimingSamples);
        }}
      />
    );

  if (state.lifecycle === "booting") {
    return (
      <>
        <main className={styles.loading} aria-busy="true">
          <p>Opening your shopping budget…</p>
        </main>
        {qaPanel}
      </>
    );
  }

  if (state.lifecycle === "recovery") {
    return (
      <>
        <RecoveryScreen controller={controller} />
        {qaPanel}
      </>
    );
  }

  if (state.lifecycle === "idle") {
    return (
      <>
        <StartTripScreen controller={controller} />
        {qaPanel}
      </>
    );
  }

  if (priceEntryOpen && state.activeTrip !== null) {
    return (
      <>
        <PriceEntrySurface
          trip={state.activeTrip}
          locale="en-FI"
          onCancel={() => {
            qaStartedAtRef.current = null;
            qaPendingSampleRef.current = null;
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

            if (qaTimingEnabled && qaStartedAtRef.current !== null) {
              qaPendingSampleRef.current = {
                unitPriceMinor: intent.unitPriceMinor,
                quantity: intent.quantity,
                lineTotalMinor: lineTotal(addedItem),
                budgetMinor: result.state.activeTrip.budgetMinor,
                safetyBufferMinor:
                  result.state.activeTrip.safetyBufferMinor,
              };
            }

            setPriceEntryOpen(false);
            returnFocusToAddPrice();
            return true;
          }}
        />
        {qaPanel}
      </>
    );
  }

  return (
    <>
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

          if (qaTimingEnabled) {
            qaStartedAtRef.current = performance.now();
            qaPendingSampleRef.current = null;
          }

          setPriceEntryOpen(true);
        }}
      />
      {qaPanel}
    </>
  );
}
