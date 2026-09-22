import type {
  ShoppingEvidence,
  ShoppingEvidenceInput,
} from "./shopping-evidence-contract";

const noop = (): void => undefined;

export function useShoppingEvidence(
  input: ShoppingEvidenceInput,
): ShoppingEvidence {
  void input;
  return {
    panel: null,
    resetQaTiming: noop,
    startOrdinaryManualEntry: noop,
    startCurrentPriceOverride: noop,
    abandonManualEntry: noop,
    commitManualEntry: noop,
    recordTripStarted: noop,
    recordTripFinished: noop,
    recordRememberedItemUsed: noop,
  };
}

export type {
  ManualEntryEvidence,
  ShoppingEvidence,
  ShoppingEvidenceInput,
} from "./shopping-evidence-contract";
