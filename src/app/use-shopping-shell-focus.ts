import { useRef } from "react";

import type { PriceMemoryId } from "../domain/price-memory";
import type { ItemId } from "../domain/shopping-trip";

export const useShoppingShellFocus = () => {
  const addPriceButtonRef = useRef<HTMLButtonElement>(null);
  const finishTripButtonRef = useRef<HTMLButtonElement>(null);
  const adjustBudgetButtonRef = useRef<HTMLButtonElement>(null);
  const scanBarcodeButtonRef = useRef<HTMLButtonElement>(null);

  const focusAfterRender = (
    findTarget: () => HTMLButtonElement | null,
    fallback?: () => HTMLButtonElement | null,
  ): void => {
    queueMicrotask(() => {
      const target = findTarget() ?? fallback?.() ?? null;
      target?.focus();
    });
  };

  const returnFocusToAddPrice = (): void => {
    focusAfterRender(() => addPriceButtonRef.current);
  };

  const returnFocusToPriceTrigger = (
    sourceMemoryId: PriceMemoryId | undefined,
  ): void => {
    if (sourceMemoryId === undefined) {
      returnFocusToAddPrice();
      return;
    }

    focusAfterRender(
      () => {
        const buttons = document.querySelectorAll<HTMLButtonElement>(
          "[data-current-price-memory-id]",
        );

        for (const button of buttons) {
          if (button.dataset.currentPriceMemoryId === sourceMemoryId) {
            return button;
          }
        }

        return null;
      },
      () => addPriceButtonRef.current,
    );
  };

  const returnFocusToScanBarcode = (): void => {
    focusAfterRender(
      () => scanBarcodeButtonRef.current,
      () => addPriceButtonRef.current,
    );
  };

  const returnFocusToFinishTrip = (): void => {
    focusAfterRender(() => finishTripButtonRef.current);
  };

  const returnFocusToAdjustBudget = (): void => {
    focusAfterRender(() => adjustBudgetButtonRef.current);
  };

  const returnFocusToEditItem = (itemId: ItemId): void => {
    focusAfterRender(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        "[data-edit-item-id]",
      );

      for (const button of buttons) {
        if (button.dataset.editItemId === itemId) {
          return button;
        }
      }

      return null;
    });
  };

  return {
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
  };
};
