import type { ReactNode } from "react";

import type { ShoppingAppController } from "../application/shopping-app-controller";
import {
  type ActiveTrip,
  type CartItem,
} from "../domain/shopping-trip";
import type { RetentionBetaTripSource } from "./retention-beta";
import {
  useRetentionBetaEvidence,
} from "./use-retention-beta-evidence";
import {
  useShoppingTimingEvidence,
  type ManualEntryEvidence,
} from "./use-shopping-timing-evidence";

export interface ShoppingEvidenceInput {
  readonly controller: ShoppingAppController;
  readonly activeTrip: ActiveTrip | null;
  readonly priceEntryOpen: boolean;
  readonly showBetaPanel: boolean;
}

export interface ShoppingEvidence {
  readonly panel: ReactNode;
  readonly resetQaTiming: () => void;
  readonly startOrdinaryManualEntry: () => void;
  readonly startCurrentPriceOverride: () => void;
  readonly abandonManualEntry: () => void;
  readonly commitManualEntry: (
    intent: ManualEntryEvidence,
    trip: ActiveTrip,
    addedItem: CartItem,
    beforeCount: number,
  ) => void;
  readonly recordTripStarted: (
    source: RetentionBetaTripSource,
  ) => void;
  readonly recordTripFinished: () => void;
  readonly recordRememberedItemUsed: (
    trip: ActiveTrip,
    beforeCount: number,
  ) => void;
}

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
