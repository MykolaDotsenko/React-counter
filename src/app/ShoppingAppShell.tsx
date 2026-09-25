import { Suspense, lazy, useEffect, useState } from "react";

import type {
  BarcodeScannerPort,
  ProductLookupPort,
} from "../application/barcode-ports";
import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import { needsSaveAttention } from "../application/session-only-persistence";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import type {
  PriceMemoryId,
  PriceMemoryRecord,
} from "../domain/price-memory";
import type { Gtin } from "../domain/product-code";
import {
  itemCount,
  mostRecentCompletedTrip,
  type ItemId,
  type TripId,
} from "../domain/shopping-trip";
import { ActiveTripScreen } from "../features/shopping/ActiveTripScreen";
import {
  BudgetSettingsSurface,
  type SpendingPlanIntent,
} from "../features/shopping/BudgetSettingsSurface";
import { CompletedSummaryScreen } from "../features/shopping/CompletedSummaryScreen";
import { FinishTripSurface } from "../features/shopping/FinishTripSurface";
import { HistoryIntegrityNotice } from "../features/shopping/HistoryIntegrityNotice";
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
import { useShoppingEvidence } from "#shopping-evidence";
import { addedFeedback, remainingFeedback } from "../features/shopping/shopping-feedback";
import { AppearanceSwitcher } from "./AppearanceSwitcher";
import { SHOPPING_LOCALE } from "../features/shopping/shopping-locale";
import { useShoppingShellFocus } from "./use-shopping-shell-focus";
import styles from "./ShoppingAppShell.module.css";

export interface ShoppingAppShellProps {
  readonly controller: ShoppingAppController;
  readonly scanner?: BarcodeScannerPort | null;
  readonly productLookup?: ProductLookupPort | null;
}

const BarcodeScanSurface = lazy(
  () => import("../features/shopping/BarcodeScanSurface"),
);

type TripOverlay =
  | {
      readonly kind: "add-price";
      readonly initialLabel?: string;
      readonly sourceMemoryId?: PriceMemoryId;
      readonly barcode?: Gtin;
    }
  | { readonly kind: "barcode-scan" }
  | { readonly kind: "budget-settings" }
  | { readonly kind: "edit-item"; readonly itemId: ItemId }
  | { readonly kind: "finish-trip" };

type OverlayState =
  | { readonly kind: "none" }
  | { readonly kind: "history" }
  | (TripOverlay & { readonly tripId: TripId });

const NO_OVERLAY: OverlayState = { kind: "none" };

export function ShoppingAppShell({
  controller,
  scanner = null,
  productLookup = null,
}: ShoppingAppShellProps) {
  const state = useShoppingAppState(controller);
  const {
    addPriceButtonRef,
    finishTripButtonRef,
    adjustBudgetButtonRef,
    scanBarcodeButtonRef,
    returnFocusToScanBarcode,
    returnFocusToAddPrice,
    returnFocusToPriceTrigger,
    returnFocusToFinishTrip,
    returnFocusToAdjustBudget,
    returnFocusToEditItem,
  } = useShoppingShellFocus();
  const [openedOverlay, setOverlay] = useState<OverlayState>(NO_OVERLAY);
  const overlay: OverlayState =
    "tripId" in openedOverlay &&
    openedOverlay.tripId !== state.activeTrip?.id
      ? NO_OVERLAY
      : openedOverlay;
  const openTripOverlay = (next: TripOverlay): void => {
    if (state.activeTrip !== null) {
      setOverlay({ ...next, tripId: state.activeTrip.id });
    }
  };
  const [lastAddedMessage, setLastAddedMessage] = useState("");
  const scanning = scanner !== null && scanner.isAvailable() ? scanner : null;

  useEffect(() => {
    if (state.lifecycle === "active") {
      scanning?.prepare();
    }
  }, [scanning, state.lifecycle]);
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

  const historyScreen = (
    <>
      <HistoryScreen
        controller={controller}
        onTripStarted={() => {
          evidence.recordTripStarted("repeat");
          setOverlay(NO_OVERLAY);
        }}
        onBack={() => {
          setOverlay(NO_OVERLAY);
        }}
        locale={SHOPPING_LOCALE}
      />
      {qaPanel}
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
      return historyScreen;
    }

    return (
      <>
        <StartTripScreen
          controller={controller}
          onTripStarted={evidence.recordTripStarted}
          completedTripCount={state.completedTrips.length}
          rememberedPriceCount={state.priceMemories.length}
          priceMemoryNeedsAttention={
            needsSaveAttention(state.priceMemoryPersistence) ||
            needsSaveAttention(state.barcodeLinkPersistence)
          }
          recentTrip={recentCompletedTrip}
          persistenceHealth={state.persistence}
          onOpenHistory={() => {
            evidence.resetQaTiming();
            setOverlay({ kind: "history" });
          }}
          utilityControl={<AppearanceSwitcher />}
        />
        {qaPanel}
      </>
    );
  }

  if (state.lifecycle === "completed-summary") {
    if (overlay.kind === "history") {
      return historyScreen;
    }

    if (state.completedSummary !== null) {
      return (
        <>
          <CompletedSummaryScreen
            controller={controller}
            trip={state.completedSummary}
            locale={SHOPPING_LOCALE}
            onDone={() => {
              setOverlay(NO_OVERLAY);
            }}
            onShopAgain={() => {
              evidence.recordTripStarted("repeat");
              setOverlay(NO_OVERLAY);
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
          locale={SHOPPING_LOCALE}
          onCancel={() => {
            evidence.abandonManualEntry();

            const sourceMemoryId = overlay.sourceMemoryId;
            const fromScan = overlay.barcode !== undefined;
            setOverlay(NO_OVERLAY);

            if (fromScan) {
              returnFocusToScanBarcode();
            } else {
              returnFocusToPriceTrigger(sourceMemoryId);
            }
          }}
          onValidatedItem={(intent: ValidatedItemIntent) => {
            const beforeCount =
              state.activeTrip === null ? 0 : itemCount(state.activeTrip);
            const result = controller.addManualItem(
              overlay.barcode === undefined
                ? intent
                : { ...intent, barcode: overlay.barcode },
            );

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
              addedFeedback(result.state.activeTrip, addedItem, SHOPPING_LOCALE),
            );

            evidence.commitManualEntry(
              intent,
              result.state.activeTrip,
              addedItem,
              beforeCount,
            );

            const sourceMemoryId = overlay.sourceMemoryId;
            const fromScan = overlay.barcode !== undefined;
            setOverlay(NO_OVERLAY);

            if (fromScan) {
              returnFocusToScanBarcode();
            } else {
              returnFocusToPriceTrigger(sourceMemoryId);
            }

            return true;
          }}
        />
        {qaPanel}
      </>
    );
  }

  if (
    overlay.kind === "barcode-scan" &&
    state.activeTrip !== null &&
    scanning !== null
  ) {
    return (
      <>
        <Suspense
          fallback={
            <main className={styles.loading} aria-busy="true">
              <p>Opening the scanner…</p>
            </main>
          }
        >
          <BarcodeScanSurface
            controller={controller}
            scanner={scanning}
            productLookup={productLookup}
            locale={SHOPPING_LOCALE}
            onCancel={() => {
              setOverlay(NO_OVERLAY);
              returnFocusToScanBarcode();
            }}
            onEnterPrice={(target) => {
              evidence.resetQaTiming();
              openTripOverlay({
                kind: "add-price",
                ...(target.label === undefined
                  ? {}
                  : { initialLabel: target.label }),
                ...(target.barcode === undefined
                  ? {}
                  : { barcode: target.barcode }),
              });
            }}
            onUseRemembered={(record, barcode) => {
              const result = controller.addRememberedItem({
                memoryId: record.id,
                barcode,
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
                  SHOPPING_LOCALE,
                )}`,
              );
              setOverlay(NO_OVERLAY);
              returnFocusToScanBarcode();
              return true;
            }}
          />
        </Suspense>
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
          locale={SHOPPING_LOCALE}
          onCancel={() => {
            setOverlay(NO_OVERLAY);
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
                  SHOPPING_LOCALE,
                )}`,
              );
            }

            setOverlay(NO_OVERLAY);
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
          locale={SHOPPING_LOCALE}
          onCancel={() => {
            setOverlay(NO_OVERLAY);
            returnFocusToFinishTrip();
          }}
          onConfirm={() => {
            const result = controller.completeTrip();

            if (result.ok) {
              evidence.recordTripFinished();
              setOverlay(NO_OVERLAY);
              return true;
            }

            if (result.state.activeTrip !== null) {
              setOverlay({
                kind: "finish-trip",
                tripId: result.state.activeTrip.id,
              });
            }

            return result.error.kind === "application" &&
              result.error.code === "history-unreadable"
              ? "history-unreadable"
              : "not-saved";
          }}
          historyNotice={<HistoryIntegrityNotice controller={controller} />}
          historyNeedsAttention={state.historyIntegrity.status === "degraded"}
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
            locale={SHOPPING_LOCALE}
            onCancel={() => {
              const itemId = item.id;
              setOverlay(NO_OVERLAY);
              returnFocusToEditItem(itemId);
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
                  SHOPPING_LOCALE,
                )}`,
              );
              setOverlay(NO_OVERLAY);
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
                  SHOPPING_LOCALE,
                )}`,
              );
              setOverlay(NO_OVERLAY);

              returnFocusToEditItem(item.id);

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
        utilityControl={<AppearanceSwitcher />}
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
                SHOPPING_LOCALE,
              )}`,
            );
            returnFocusToAddPrice();
          }
        }}
        onAddPrice={() => {
          setLastAddedMessage("");
          evidence.startOrdinaryManualEntry();
          openTripOverlay({ kind: "add-price" });
        }}
        {...(scanning === null
          ? {}
          : {
              scanBarcodeButtonRef,
              onScanBarcode: () => {
                evidence.resetQaTiming();
                setLastAddedMessage("");
                openTripOverlay({ kind: "barcode-scan" });
              },
            })}
        onAdjustBudget={() => {
          evidence.resetQaTiming();
          setLastAddedMessage("");
          openTripOverlay({ kind: "budget-settings" });
        }}
        onFinishTrip={() => {
          evidence.resetQaTiming();
          setLastAddedMessage("");
          openTripOverlay({ kind: "finish-trip" });
        }}
        onEditItem={(item) => {
          evidence.resetQaTiming();
          setLastAddedMessage("");
          openTripOverlay({ kind: "edit-item", itemId: item.id });
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
              SHOPPING_LOCALE,
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

          openTripOverlay({
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
                SHOPPING_LOCALE,
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
