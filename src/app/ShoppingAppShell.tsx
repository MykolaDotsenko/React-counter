import { useEffect, useRef, useState } from "react";

import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import { formatEur, signedMinorUnits } from "../domain/money";
import type { PriceMemoryRecord } from "../domain/price-memory";
import {
  lineTotal,
  mostRecentCompletedTrip,
  remaining,
  safeRemaining,
  type ActiveTrip,
  type CartItem,
  type ItemId,
} from "../domain/shopping-trip";
import { ActiveTripScreen } from "../features/shopping/ActiveTripScreen";
import {
  BudgetSettingsSurface,
  type SpendingPlanIntent,
} from "../features/shopping/BudgetSettingsSurface";
import { CompletedSummaryScreen } from "../features/shopping/CompletedSummaryScreen";
import { FinishTripSurface } from "../features/shopping/FinishTripSurface";
import { HistoryScreen } from "../features/shopping/HistoryScreen";
import {
  ItemEditSurface,
  type ItemEditIntent,
} from "../features/shopping/ItemEditSurface";
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

type OverlayState =
  | { readonly kind: "none" }
  | { readonly kind: "add-price"; readonly initialLabel?: string }
  | { readonly kind: "budget-settings" }
  | { readonly kind: "edit-item"; readonly itemId: ItemId }
  | { readonly kind: "finish-trip" }
  | { readonly kind: "history" };

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
  const finishTripButtonRef = useRef<HTMLButtonElement>(null);
  const adjustBudgetButtonRef = useRef<HTMLButtonElement>(null);
  const qaStartedAtRef = useRef<number | null>(null);
  const qaPendingSampleRef = useRef<PendingQaSample | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ kind: "none" });
  const [lastAddedMessage, setLastAddedMessage] = useState("");
  const recentCompletedTrip = mostRecentCompletedTrip(
    state.completedTrips,
  );
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


  const returnFocusToFinishTrip = (): void => {
    queueMicrotask(() => {
      finishTripButtonRef.current?.focus();
    });
  };

  const returnFocusToAdjustBudget = (): void => {
    queueMicrotask(() => {
      adjustBudgetButtonRef.current?.focus();
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
      overlay.kind === "add-price" ||
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
  }, [overlay.kind]);

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
    if (overlay.kind === "history") {
      return (
        <>
          <HistoryScreen
            controller={controller}
            persistenceHealth={state.persistence}
            trips={state.completedTrips}
            onBack={() => {
              setOverlay({ kind: "none" });
            }}
            locale="en-FI"
          />
          {qaPanel}
        </>
      );
    }

    return (
      <>
        <StartTripScreen
          controller={controller}
          completedTripCount={state.completedTrips.length}
          recentTrip={recentCompletedTrip}
          persistenceHealth={state.persistence}
          onOpenHistory={() => {
            qaStartedAtRef.current = null;
            qaPendingSampleRef.current = null;
            setOverlay({ kind: "history" });
          }}
        />
        {qaPanel}
      </>
    );
  }

  if (state.lifecycle === "completed-summary") {
    if (overlay.kind === "history") {
      return (
        <>
          <HistoryScreen
            controller={controller}
            persistenceHealth={state.persistence}
            trips={state.completedTrips}
            onBack={() => {
              setOverlay({ kind: "none" });
            }}
            locale="en-FI"
          />
          {qaPanel}
        </>
      );
    }

    if (state.completedSummary !== null) {
      return (
        <>
          <CompletedSummaryScreen
            controller={controller}
            trip={state.completedSummary}
            locale="en-FI"
            onDone={() => {
              setOverlay({ kind: "none" });
            }}
            onShopAgain={() => {
              setOverlay({ kind: "none" });
              setLastAddedMessage(
                "New trip started with your previous budget.",
              );
            }}
            onViewHistory={() => {
              setOverlay({ kind: "history" });
            }}
          />
          {qaPanel}
        </>
      );
    }
  }

  if (overlay.kind === "add-price" && state.activeTrip !== null) {
    return (
      <>
        <PriceEntrySurface
          trip={state.activeTrip}
          initialLabel={overlay.initialLabel}
          locale="en-FI"
          onCancel={() => {
            qaStartedAtRef.current = null;
            qaPendingSampleRef.current = null;
            setOverlay({ kind: "none" });
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

            setOverlay({ kind: "none" });
            returnFocusToAddPrice();
            return true;
          }}
        />
        {qaPanel}
      </>
    );
  }

  if (
    overlay.kind === "budget-settings" &&
    state.activeTrip !== null
  ) {
    return (
      <>
        <BudgetSettingsSurface
          trip={state.activeTrip}
          locale="en-FI"
          onCancel={() => {
            setOverlay({ kind: "none" });
            returnFocusToAdjustBudget();
          }}
          onSave={(intent: SpendingPlanIntent) => {
            const result = controller.updateSpendingPlan(intent);

            if (!result.ok || result.state.activeTrip === null) {
              return false;
            }

            if (result.changed) {
              setLastAddedMessage(
                `Budget updated. ${remainingFeedback(
                  result.state.activeTrip,
                  "en-FI",
                )}`,
              );
            }

            setOverlay({ kind: "none" });
            returnFocusToAdjustBudget();
            return true;
          }}
        />
        {qaPanel}
      </>
    );
  }

  if (
    overlay.kind === "finish-trip" &&
    state.activeTrip !== null
  ) {
    return (
      <>
        <FinishTripSurface
          trip={state.activeTrip}
          locale="en-FI"
          onCancel={() => {
            setOverlay({ kind: "none" });
            returnFocusToFinishTrip();
          }}
          onConfirm={() => {
            const result = controller.completeTrip();

            if (!result.ok) {
              return false;
            }

            setOverlay({ kind: "none" });
            return true;
          }}
        />
        {qaPanel}
      </>
    );
  }

  if (overlay.kind === "edit-item" && state.activeTrip !== null) {
    const item = state.activeTrip.items.find(
      (candidate) => candidate.id === overlay.itemId,
    );

    if (item !== undefined) {
      return (
        <>
          <ItemEditSurface
            trip={state.activeTrip}
            item={item}
            locale="en-FI"
            onCancel={() => {
              const itemId = item.id;
              setOverlay({ kind: "none" });
              queueMicrotask(() => {
                const buttons = document.querySelectorAll<HTMLButtonElement>(
                  "[data-edit-item-id]",
                );

                for (const button of buttons) {
                  if (button.dataset.editItemId === itemId) {
                    button.focus();
                    break;
                  }
                }
              });
            }}
            onRemove={() => {
              const result = controller.removeItem(item.id);

              if (
                !result.ok ||
                !result.changed ||
                result.state.activeTrip === null
              ) {
                return false;
              }

              setLastAddedMessage(
                `Item removed. ${remainingFeedback(
                  result.state.activeTrip,
                  "en-FI",
                )}`,
              );
              setOverlay({ kind: "none" });
              returnFocusToAddPrice();
              return true;
            }}
            onSave={(intent: ItemEditIntent) => {
              const result = controller.updateManualItem({
                itemId: item.id,
                unitPriceMinor: intent.unitPriceMinor,
                quantity: intent.quantity,
                ...(intent.label === undefined
                  ? {}
                  : { label: intent.label }),
              });

              if (
                !result.ok ||
                !result.changed ||
                result.state.activeTrip === null
              ) {
                return false;
              }

              setLastAddedMessage(
                `Item corrected. ${remainingFeedback(
                  result.state.activeTrip,
                  "en-FI",
                )}`,
              );
              setOverlay({ kind: "none" });

              queueMicrotask(() => {
                const buttons = document.querySelectorAll<HTMLButtonElement>(
                  "[data-edit-item-id]",
                );

                for (const button of buttons) {
                  if (button.dataset.editItemId === item.id) {
                    button.focus();
                    break;
                  }
                }
              });

              return true;
            }}
          />
          {qaPanel}
        </>
      );
    }
  }

  return (
    <>
      <ActiveTripScreen
        controller={controller}
        addPriceButtonRef={addPriceButtonRef}
        finishTripButtonRef={finishTripButtonRef}
        adjustBudgetButtonRef={adjustBudgetButtonRef}
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

          setOverlay({ kind: "add-price" });
        }}
        onAdjustBudget={() => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          setLastAddedMessage("");
          setOverlay({ kind: "budget-settings" });
        }}
        onFinishTrip={() => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          setLastAddedMessage("");
          setOverlay({ kind: "finish-trip" });
        }}
        onEditItem={(item) => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          setLastAddedMessage("");
          setOverlay({ kind: "edit-item", itemId: item.id });
        }}
        onUseRemembered={(record: PriceMemoryRecord) => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          setLastAddedMessage("");

          const result = controller.addRememberedItem({
            memoryId: record.id,
          });

          if (
            !result.ok ||
            !result.changed ||
            result.state.activeTrip === null
          ) {
            return false;
          }

          setLastAddedMessage(
            `${record.label} added from a remembered price. ${remainingFeedback(
              result.state.activeTrip,
              "en-FI",
            )}`,
          );
          returnFocusToAddPrice();
          return true;
        }}
        onEnterCurrentPrice={(record: PriceMemoryRecord) => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          setLastAddedMessage("");
          setOverlay({
            kind: "add-price",
            initialLabel: record.label,
          });
        }}
        onRemoveItem={(item) => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          const result = controller.removeItem(item.id);

          if (
            result.ok &&
            result.changed &&
            result.state.activeTrip !== null
          ) {
            setLastAddedMessage(
              `Item removed. ${remainingFeedback(
                result.state.activeTrip,
                "en-FI",
              )}`,
            );
            returnFocusToAddPrice();
          }
        }}
      />
      {qaPanel}
    </>
  );
}
