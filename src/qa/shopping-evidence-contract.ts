import type { ReactNode } from "react";

import type { ShoppingAppController } from "../application/shopping-app-controller";
import type { MinorUnits } from "../domain/money";
import type {
  ActiveTrip,
  CartItem,
} from "../domain/shopping-trip";
import type { RetentionBetaTripSource } from "./retention-beta";

export interface ManualEntryEvidence {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
}

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
