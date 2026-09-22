import type {
  ShoppingEvidence,
  ShoppingEvidenceInput,
} from "./shopping-evidence-contract";
import { useRetentionBetaEvidence } from "./use-retention-beta-evidence";
import { useShoppingTimingEvidence } from "./use-shopping-timing-evidence";

export function useShoppingEvidence({
  controller,
  activeTrip,
  priceEntryOpen,
  showBetaPanel,
}: ShoppingEvidenceInput): ShoppingEvidence {
  const timing = useShoppingTimingEvidence(priceEntryOpen);
  const retention = useRetentionBetaEvidence({
    controller,
    activeTrip,
    showPanel: showBetaPanel,
  });

  return {
    panel: (
      <>
        {timing.panel}
        {retention.panel}
      </>
    ),
    resetQaTiming: timing.reset,
    startOrdinaryManualEntry() {
      timing.start();
      retention.startManualEntry();
    },
    startCurrentPriceOverride() {
      timing.reset();
      retention.startCurrentPriceOverride();
    },
    abandonManualEntry() {
      timing.reset();
      retention.abandonManualEntry();
    },
    commitManualEntry(intent, trip, addedItem, beforeCount) {
      retention.commitManualEntry(trip, beforeCount);
      timing.commit(intent, trip, addedItem);
    },
    recordTripStarted: retention.recordTripStarted,
    recordTripFinished: retention.recordTripFinished,
    recordRememberedItemUsed(trip, beforeCount) {
      timing.reset();
      retention.recordRememberedItemUsed(trip, beforeCount);
    },
  };
}

export type {
  ManualEntryEvidence,
  ShoppingEvidence,
  ShoppingEvidenceInput,
} from "./shopping-evidence-contract";
