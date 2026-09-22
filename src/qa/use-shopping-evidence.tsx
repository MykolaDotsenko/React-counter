import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ShoppingAppController } from "../application/shopping-app-controller";
import type { MinorUnits } from "../domain/money";
import {
  itemCount,
  lineTotal,
  type ActiveTrip,
  type CartItem,
} from "../domain/shopping-trip";
import { RetentionBetaPanel } from "./RetentionBetaPanel";
import { ShoppingTimingQaPanel } from "./ShoppingTimingQaPanel";
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
} from "./retention-beta";
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
} from "./shopping-timing";

const qaTimingEnabled =
  import.meta.env.VITE_SHOPPING_QA_TIMING === "1";

const betaEvidenceEnabled =
  import.meta.env.VITE_SHOPPING_BETA_EVIDENCE === "1";

interface ManualEntryEvidence {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
}

interface PendingQaSample {
  readonly unitPriceMinor: number;
  readonly quantity: number;
  readonly lineTotalMinor: number;
  readonly budgetMinor: number;
  readonly safetyBufferMinor: number;
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

export function useShoppingEvidence({
  controller,
  activeTrip,
  priceEntryOpen,
  showBetaPanel,
}: ShoppingEvidenceInput): ShoppingEvidence {
  const qaStartedAtRef = useRef<number | null>(null);
  const qaPendingSampleRef = useRef<PendingQaSample | null>(null);
  const betaManualStartedAtRef = useRef<number | null>(null);
  const betaRestoreRecordedRef = useRef(false);
  const betaInitialActiveTripRef = useRef(activeTrip !== null);

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

  const resetQaTiming = (): void => {
    qaStartedAtRef.current = null;
    qaPendingSampleRef.current = null;
  };

  const startOrdinaryManualEntry = (): void => {
    if (qaTimingEnabled) {
      qaStartedAtRef.current = performance.now();
      qaPendingSampleRef.current = null;
    }

    if (betaEvidenceEnabled) {
      betaManualStartedAtRef.current = performance.now();
    }
  };

  const startCurrentPriceOverride = (): void => {
    resetQaTiming();
    recordBetaEvent({
      type: "current_price_override_started",
      at: new Date().toISOString(),
      tripOrdinal: activeTripOrdinal() ?? 1,
    });

    if (betaEvidenceEnabled) {
      betaManualStartedAtRef.current = performance.now();
    }
  };

  const abandonManualEntry = (): void => {
    resetQaTiming();

    if (betaManualStartedAtRef.current === null) {
      return;
    }

    recordBetaEvent({
      type: "manual_entry_abandoned",
      at: new Date().toISOString(),
      tripOrdinal: activeTripOrdinal() ?? 1,
    });
    betaManualStartedAtRef.current = null;
  };

  const commitManualEntry = (
    intent: ManualEntryEvidence,
    trip: ActiveTrip,
    addedItem: CartItem,
    beforeCount: number,
  ): void => {
    const tripOrdinal = activeTripOrdinal() ?? 1;

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
      itemCount(trip),
      tripOrdinal,
    );

    if (qaTimingEnabled && qaStartedAtRef.current !== null) {
      qaPendingSampleRef.current = {
        unitPriceMinor: intent.unitPriceMinor,
        quantity: intent.quantity,
        lineTotalMinor: lineTotal(addedItem),
        budgetMinor: trip.budgetMinor,
        safetyBufferMinor: trip.safetyBufferMinor,
      };
    }
  };

  const recordTripFinished = (): void => {
    recordBetaEvent({
      type: "trip_finished",
      at: new Date().toISOString(),
      tripOrdinal: activeTripOrdinal() ?? 1,
    });
  };

  const recordRememberedItemUsed = (
    trip: ActiveTrip,
    beforeCount: number,
  ): void => {
    resetQaTiming();
    betaManualStartedAtRef.current = null;
    const tripOrdinal = activeTripOrdinal() ?? 1;

    recordBetaEvent({
      type: "remembered_item_used",
      at: new Date().toISOString(),
      tripOrdinal,
    });
    recordCrossedItemMilestones(
      beforeCount,
      itemCount(trip),
      tripOrdinal,
    );
  };

  useEffect(() => {
    if (
      !betaEvidenceEnabled ||
      betaRestoreRecordedRef.current ||
      !betaInitialActiveTripRef.current ||
      activeTrip === null
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
  }, [activeTrip]);

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

  const panel = (
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

      {betaSession === null || !showBetaPanel ? null : (
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

  return {
    panel,
    resetQaTiming,
    startOrdinaryManualEntry,
    startCurrentPriceOverride,
    abandonManualEntry,
    commitManualEntry,
    recordTripStarted,
    recordTripFinished,
    recordRememberedItemUsed,
  };
}
