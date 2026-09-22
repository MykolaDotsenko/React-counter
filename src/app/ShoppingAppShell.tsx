import { useRef, useState } from "react";

import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import { formatEur, signedMinorUnits } from "../domain/money";
import type {
  PriceMemoryId,
  PriceMemoryRecord,
} from "../domain/price-memory";
import {
  itemCount,
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
import { useShoppingEvidence } from "../qa/use-shopping-evidence";
import "./shopping-theme.css";
import styles from "./ShoppingAppShell.module.css";

export interface ShoppingAppShellProps {
  readonly controller: ShoppingAppController;
}

type OverlayState =
  | { readonly kind: "none" }
  | {
      readonly kind: "add-price";
      readonly initialLabel?: string;
      readonly sourceMemoryId?: PriceMemoryId;
    }
  | { readonly kind: "budget-settings" }
  | { readonly kind: "edit-item"; readonly itemId: ItemId }
  | { readonly kind: "finish-trip" }
  | { readonly kind: "history" };

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
  const [overlay, setOverlay] = useState<OverlayState>({ kind: "none" });
  const [lastAddedMessage, setLastAddedMessage] = useState("");
  const recentCompletedTrip = mostRecentCompletedTrip(
    state.completedTrips,
  );
  const evidence = useShoppingEvidence({
    controller,
    activeTrip: state.activeTrip,
    priceEntryOpen: overlay.kind === "add-price",
    showBetaPanel:
      state.activeTrip === null && overlay.kind === "none",
  });
  const qaPanel = evidence.panel;

  const returnFocusToAddPrice = (): void => {
    queueMicrotask(() => {
      addPriceButtonRef.current?.focus();
    });
  };

  const returnFocusToPriceTrigger = (
    sourceMemoryId: PriceMemoryId | undefined,
  ): void => {
    if (sourceMemoryId === undefined) {
      returnFocusToAddPrice();
      return;
    }

    queueMicrotask(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        "[data-current-price-memory-id]",
      );

      for (const button of buttons) {
        if (button.dataset.currentPriceMemoryId === sourceMemoryId) {
          button.focus();
          return;
        }
      }

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
            onTripStarted={() => {
              evidence.recordTripStarted("repeat");
            }}
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
          onTripStarted={evidence.recordTripStarted}
          completedTripCount={state.completedTrips.length}
          rememberedPriceCount={state.priceMemories.length}
          recentTrip={recentCompletedTrip}
          persistenceHealth={state.persistence}
          onOpenHistory={() => {
            evidence.resetQaTiming();
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
            onTripStarted={() => {
              evidence.recordTripStarted("repeat");
            }}
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
              evidence.recordTripStarted("repeat");
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
          {...(overlay.initialLabel === undefined
            ? {}
            : { initialLabel: overlay.initialLabel })}
          locale="en-FI"
          onCancel={() => {
            evidence.abandonManualEntry();

            const sourceMemoryId = overlay.sourceMemoryId;
            setOverlay({ kind: "none" });
            returnFocusToPriceTrigger(sourceMemoryId);
          }}
          onValidatedItem={(intent: ValidatedItemIntent) => {
            const beforeCount =
              state.activeTrip === null ? 0 : itemCount(state.activeTrip);
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

            evidence.commitManualEntry(
              intent,
              result.state.activeTrip,
              addedItem,
              beforeCount,
            );

            const sourceMemoryId = overlay.sourceMemoryId;
            setOverlay({ kind: "none" });
            returnFocusToPriceTrigger(sourceMemoryId);
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

            evidence.recordTripFinished();
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
          evidence.startOrdinaryManualEntry();
          setOverlay({ kind: "add-price" });
        }}
        onAdjustBudget={() => {
          evidence.resetQaTiming();
          setLastAddedMessage("");
          setOverlay({ kind: "budget-settings" });
        }}
        onFinishTrip={() => {
          evidence.resetQaTiming();
          setLastAddedMessage("");
          setOverlay({ kind: "finish-trip" });
        }}
        onEditItem={(item) => {
          evidence.resetQaTiming();
          setLastAddedMessage("");
          setOverlay({ kind: "edit-item", itemId: item.id });
        }}
        onUseRemembered={(record: PriceMemoryRecord) => {
          evidence.resetQaTiming();
          setLastAddedMessage("");

          const beforeCount =
            state.activeTrip === null ? 0 : itemCount(state.activeTrip);
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
          evidence.recordRememberedItemUsed(
            result.state.activeTrip,
            beforeCount,
          );
          return true;
        }}
        onEnterCurrentPrice={(record: PriceMemoryRecord) => {
          setLastAddedMessage("");
          evidence.startCurrentPriceOverride();

          setOverlay({
            kind: "add-price",
            initialLabel: record.label,
            sourceMemoryId: record.id,
          });
        }}
        onRemoveItem={(item) => {
          evidence.resetQaTiming();
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
