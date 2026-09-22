import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ShoppingAppController } from "../application/shopping-app-controller";
import {
  itemCount,
  type ActiveTrip,
} from "../domain/shopping-trip";
import { RetentionBetaPanel } from "./RetentionBetaPanel";
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

const betaEvidenceEnabled =
  import.meta.env.VITE_SHOPPING_BETA_EVIDENCE === "1";

export interface RetentionBetaEvidence {
  readonly panel: ReactNode;
  readonly recordTripStarted: (
    source: RetentionBetaTripSource,
  ) => void;
  readonly startManualEntry: () => void;
  readonly startCurrentPriceOverride: () => void;
  readonly abandonManualEntry: () => void;
  readonly commitManualEntry: (
    trip: ActiveTrip,
    beforeCount: number,
  ) => void;
  readonly recordTripFinished: () => void;
  readonly recordRememberedItemUsed: (
    trip: ActiveTrip,
    beforeCount: number,
  ) => void;
}

export interface RetentionBetaEvidenceInput {
  readonly controller: ShoppingAppController;
  readonly activeTrip: ActiveTrip | null;
  readonly showPanel: boolean;
}

export function useRetentionBetaEvidence({
  controller,
  activeTrip,
  showPanel,
}: RetentionBetaEvidenceInput): RetentionBetaEvidence {
  const manualStartedAtRef = useRef<number | null>(null);
  const restoreRecordedRef = useRef(false);
  const initialActiveTripRef = useRef(activeTrip !== null);
  const [session, setSession] =
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

  const updateSession = (
    updater: (current: RetentionBetaSession) => RetentionBetaSession,
  ): void => {
    setSession((current) => {
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

  const recordEvent = (event: RetentionBetaEvent): void => {
    if (!betaEvidenceEnabled) {
      return;
    }

    updateSession((current) =>
      appendRetentionBetaEvent(current, event),
    );
  };

  const activeTripOrdinal = (): number | null => {
    if (session === null) {
      return null;
    }

    return currentRetentionTripOrdinal(session);
  };

  const recordTripStarted = (
    source: RetentionBetaTripSource,
  ): void => {
    if (session === null) {
      return;
    }

    if (controller.getSnapshot().activeTrip === null) {
      return;
    }

    recordEvent({
      type: "trip_started",
      at: new Date().toISOString(),
      tripOrdinal: nextRetentionTripOrdinal(session),
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
        recordEvent({
          type: "item_milestone",
          at: new Date().toISOString(),
          tripOrdinal,
          itemCount: milestone,
        });
      }
    }
  };

  const startManualEntry = (): void => {
    if (betaEvidenceEnabled) {
      manualStartedAtRef.current = performance.now();
    }
  };

  const startCurrentPriceOverride = (): void => {
    recordEvent({
      type: "current_price_override_started",
      at: new Date().toISOString(),
      tripOrdinal: activeTripOrdinal() ?? 1,
    });
    startManualEntry();
  };

  const abandonManualEntry = (): void => {
    if (manualStartedAtRef.current === null) {
      return;
    }

    recordEvent({
      type: "manual_entry_abandoned",
      at: new Date().toISOString(),
      tripOrdinal: activeTripOrdinal() ?? 1,
    });
    manualStartedAtRef.current = null;
  };

  const commitManualEntry = (
    trip: ActiveTrip,
    beforeCount: number,
  ): void => {
    const tripOrdinal = activeTripOrdinal() ?? 1;

    if (manualStartedAtRef.current !== null) {
      recordEvent({
        type: "manual_entry_completed",
        at: new Date().toISOString(),
        tripOrdinal,
        durationMs:
          performance.now() - manualStartedAtRef.current,
      });
      manualStartedAtRef.current = null;
    }

    recordCrossedItemMilestones(
      beforeCount,
      itemCount(trip),
      tripOrdinal,
    );
  };

  const recordTripFinished = (): void => {
    recordEvent({
      type: "trip_finished",
      at: new Date().toISOString(),
      tripOrdinal: activeTripOrdinal() ?? 1,
    });
  };

  const recordRememberedItemUsed = (
    trip: ActiveTrip,
    beforeCount: number,
  ): void => {
    manualStartedAtRef.current = null;
    const tripOrdinal = activeTripOrdinal() ?? 1;

    recordEvent({
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
      restoreRecordedRef.current ||
      !initialActiveTripRef.current ||
      activeTrip === null
    ) {
      return;
    }

    restoreRecordedRef.current = true;

    setSession((current) => {
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

  const panel =
    session === null || !showPanel ? null : (
      <RetentionBetaPanel
        session={session}
        onReset={() => {
          const next = createRetentionBetaSession(
            new Date().toISOString(),
          );
          setSession(next);

          try {
            persistRetentionBetaSession(localStorage, next);
          } catch {
            // Reset remains effective in memory when storage is unavailable.
          }
        }}
      />
    );

  return {
    panel,
    recordTripStarted,
    startManualEntry,
    startCurrentPriceOverride,
    abandonManualEntry,
    commitManualEntry,
    recordTripFinished,
    recordRememberedItemUsed,
  };
}
