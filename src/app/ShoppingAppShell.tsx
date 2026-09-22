import { useEffect, useRef, useState } from "react";

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
import { RetentionBetaPanel } from "../qa/RetentionBetaPanel";
import { ShoppingTimingQaPanel } from "../qa/ShoppingTimingQaPanel";
import {
  appendRetentionBetaEvent,
  createRetentionBetaSession,
  currentRetentionTripOrdinal,
  loadRetentionBetaSession,
  nextRetentionTripOrdinal,
  persistRetentionBetaSession,
  type RetentionBetaEvent,
  type RetentionBetaSession,
  type RetentionBetaTripSource,
} from "../qa/retention-beta";
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
  updateQaInputMethodLabel,
  updateQaPhysicalContext,
  updateQaSpotCheck,
  updateQaTimingNotes,
  type QaPhysicalContext,
  type QaSpotChecks,
  type QaSpotCheckStatus,
  type QaTimingSession,
} from "../qa/shopping-timing";
import "./shopping-theme.css";
import styles from "./ShoppingAppShell.module.css";

export interface ShoppingAppShellProps {
  readonly controller: ShoppingAppController;
}

const qaTimingEnabled =
  import.meta.env.VITE_SHOPPING_QA_TIMING === "1";

const betaEvidenceEnabled =
  import.meta.env.VITE_SHOPPING_BETA_EVIDENCE === "1";

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
  const betaManualStartedAtRef = useRef<number | null>(null);
  const betaRestoreRecordedRef = useRef(false);
  const betaInitialActiveTripRef = useRef(state.activeTrip !== null);
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
  const [betaSession, setBetaSession] =
    useState<RetentionBetaSession | null>(() => {
      if (!betaEvidenceEnabled) {
        return null;
      }

      const now = new Date().toISOString();

      try {
        return loadRetentionBetaSession(localStorage, now);
      } catch {
        return createRetentionBetaSession(now);
      }
    });

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

  const updateBetaSessionState = (
    updater: (current: RetentionBetaSession) => RetentionBetaSession,
  ): void => {
    setBetaSession((current) => {
      if (current === null) {
        return null;
      }

      const next = updater(current);

      try {
        persistRetentionBetaSession(localStorage, next);
      } catch {
        // Beta evidence must never change shopping product behaviour.
      }

      return next;
    });
  };

  const recordBetaEvent = (event: RetentionBetaEvent): void => {
    if (!betaEvidenceEnabled) {
      return;
    }

    updateBetaSessionState((current) =>
      appendRetentionBetaEvent(current, event),
    );
  };

  const activeTripOrdinal = (): number | null => {
    if (betaSession === null) {
      return null;
    }

    return currentRetentionTripOrdinal(betaSession);
  };

  const recordTripStarted = (
    source: RetentionBetaTripSource,
  ): void => {
    if (betaSession === null) {
      return;
    }

    const snapshot = controller.getSnapshot();

    if (snapshot.activeTrip === null) {
      return;
    }

    recordBetaEvent({
      type: "trip_started",
      at: new Date().toISOString(),
      tripOrdinal: nextRetentionTripOrdinal(betaSession),
      source,
    });
  };

  const recordCrossedItemMilestones = (
    beforeCount: number,
    afterCount: number,
    tripOrdinal: number,
  ): void => {
    for (const milestone of [1, 5, 10] as const) {
      if (beforeCount < milestone && afterCount >= milestone) {
        recordBetaEvent({
          type: "item_milestone",
          at: new Date().toISOString(),
          tripOrdinal,
          itemCount: milestone,
        });
      }
    }
  };

  useEffect(() => {
    if (
      !betaEvidenceEnabled ||
      betaRestoreRecordedRef.current ||
      !betaInitialActiveTripRef.current ||
      state.activeTrip === null
    ) {
      return;
    }

    betaRestoreRecordedRef.current = true;

    setBetaSession((current) => {
      if (current === null) {
        return null;
      }

      const observedOrdinal = currentRetentionTripOrdinal(current);
      const tripOrdinal =
        observedOrdinal ?? nextRetentionTripOrdinal(current);
      const at = new Date().toISOString();
      let next = current;

      if (observedOrdinal === null) {
        next = appendRetentionBetaEvent(next, {
          type: "trip_started",
          at,
          tripOrdinal,
          source: "resume",
        });
      }

      next = appendRetentionBetaEvent(next, {
        type: "trip_restored",
        at,
        tripOrdinal,
      });

      try {
        persistRetentionBetaSession(localStorage, next);
      } catch {
        // Restore evidence must never change shopping product behaviour.
      }

      return next;
    });
  }, [state.activeTrip]);

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

  const qaPanel = (
    <>
      {qaSession === null ? null : (
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
        onInputMethodLabelChange={(value) => {
          updateQaSessionState((current) =>
            updateQaInputMethodLabel(current, value),
          );
        }}
        onPhysicalContextChange={(
          key: keyof QaPhysicalContext,
          value: boolean,
        ) => {
          updateQaSessionState((current) =>
            updateQaPhysicalContext(current, key, value),
          );
        }}
        onSpotCheckChange={(
          key: keyof QaSpotChecks,
          value: QaSpotCheckStatus,
        ) => {
          updateQaSessionState((current) =>
            updateQaSpotCheck(current, key, value),
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
      )}
      {betaSession === null ||
      state.activeTrip !== null ||
      overlay.kind !== "none" ? null : (
        <RetentionBetaPanel
          session={betaSession}
          onReset={() => {
            const next = createRetentionBetaSession(
              new Date().toISOString(),
            );
            setBetaSession(next);

            try {
              persistRetentionBetaSession(localStorage, next);
            } catch {
              // Reset remains effective in memory when storage is unavailable.
            }
          }}
        />
      )}
    </>
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
            onTripStarted={() => {
              recordTripStarted("repeat");
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
          onTripStarted={recordTripStarted}
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
            onTripStarted={() => {
              recordTripStarted("repeat");
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
              recordTripStarted("repeat");
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
            qaStartedAtRef.current = null;
            qaPendingSampleRef.current = null;

            if (betaManualStartedAtRef.current !== null) {
              recordBetaEvent({
                type: "manual_entry_abandoned",
                at: new Date().toISOString(),
                tripOrdinal: activeTripOrdinal() ?? 1,
              });
              betaManualStartedAtRef.current = null;
            }

            const sourceMemoryId = overlay.sourceMemoryId;
            setOverlay({ kind: "none" });
            returnFocusToPriceTrigger(sourceMemoryId);
          }}
          onValidatedItem={(intent: ValidatedItemIntent) => {
            const beforeCount =
              state.activeTrip === null ? 0 : itemCount(state.activeTrip);
            const tripOrdinal = activeTripOrdinal() ?? 1;
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

            if (betaManualStartedAtRef.current !== null) {
              recordBetaEvent({
                type: "manual_entry_completed",
                at: new Date().toISOString(),
                tripOrdinal,
                durationMs:
                  performance.now() - betaManualStartedAtRef.current,
              });
              betaManualStartedAtRef.current = null;
            }

            recordCrossedItemMilestones(
              beforeCount,
              itemCount(result.state.activeTrip),
              tripOrdinal,
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
            const tripOrdinal = activeTripOrdinal() ?? 1;
            const result = controller.completeTrip();

            if (!result.ok) {
              return false;
            }

            recordBetaEvent({
              type: "trip_finished",
              at: new Date().toISOString(),
              tripOrdinal,
            });
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

          if (betaEvidenceEnabled) {
            betaManualStartedAtRef.current = performance.now();
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
          betaManualStartedAtRef.current = null;
          setLastAddedMessage("");

          const beforeCount =
            state.activeTrip === null ? 0 : itemCount(state.activeTrip);
          const tripOrdinal = activeTripOrdinal() ?? 1;
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
          recordBetaEvent({
            type: "remembered_item_used",
            at: new Date().toISOString(),
            tripOrdinal,
          });
          recordCrossedItemMilestones(
            beforeCount,
            itemCount(result.state.activeTrip),
            tripOrdinal,
          );
          return true;
        }}
        onEnterCurrentPrice={(record: PriceMemoryRecord) => {
          qaStartedAtRef.current = null;
          qaPendingSampleRef.current = null;
          setLastAddedMessage("");
          recordBetaEvent({
            type: "current_price_override_started",
            at: new Date().toISOString(),
            tripOrdinal: activeTripOrdinal() ?? 1,
          });

          if (betaEvidenceEnabled) {
            betaManualStartedAtRef.current = performance.now();
          }

          setOverlay({
            kind: "add-price",
            initialLabel: record.label,
            sourceMemoryId: record.id,
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
