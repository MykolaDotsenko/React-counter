import { useEffect, useRef, useState, type ReactNode } from "react";

import type { MinorUnits } from "../domain/money";
import {
  lineTotal,
  type ActiveTrip,
  type CartItem,
} from "../domain/shopping-trip";
import { ShoppingTimingQaPanel } from "./ShoppingTimingQaPanel";
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

export interface ManualEntryEvidence {
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

export interface ShoppingTimingEvidence {
  readonly panel: ReactNode;
  readonly reset: () => void;
  readonly start: () => void;
  readonly commit: (
    intent: ManualEntryEvidence,
    trip: ActiveTrip,
    addedItem: CartItem,
  ) => void;
}

export function useShoppingTimingEvidence(
  priceEntryOpen: boolean,
): ShoppingTimingEvidence {
  const startedAtRef = useRef<number | null>(null);
  const pendingSampleRef = useRef<PendingQaSample | null>(null);
  const [session, setSession] = useState<QaTimingSession | null>(() => {
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

  const updateSession = (
    updater: (current: QaTimingSession) => QaTimingSession,
  ): void => {
    setSession((current) => {
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

  const reset = (): void => {
    startedAtRef.current = null;
    pendingSampleRef.current = null;
  };

  const start = (): void => {
    if (!qaTimingEnabled) {
      return;
    }

    startedAtRef.current = performance.now();
    pendingSampleRef.current = null;
  };

  const commit = (
    intent: ManualEntryEvidence,
    trip: ActiveTrip,
    addedItem: CartItem,
  ): void => {
    if (!qaTimingEnabled || startedAtRef.current === null) {
      return;
    }

    pendingSampleRef.current = {
      unitPriceMinor: intent.unitPriceMinor,
      quantity: intent.quantity,
      lineTotalMinor: lineTotal(addedItem),
      budgetMinor: trip.budgetMinor,
      safetyBufferMinor: trip.safetyBufferMinor,
    };
  };

  useEffect(() => {
    if (
      !qaTimingEnabled ||
      priceEntryOpen ||
      pendingSampleRef.current === null ||
      startedAtRef.current === null
    ) {
      return;
    }

    const pending = pendingSampleRef.current;
    const durationMs = performance.now() - startedAtRef.current;

    pendingSampleRef.current = null;
    startedAtRef.current = null;

    setSession((current) => {
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

  const panel = session === null ? null : (
    <ShoppingTimingQaPanel
      session={session}
      onChecklistChange={(key, value) => {
        updateSession((current) =>
          updateQaChecklist(current, key, value),
        );
      }}
      onDeviceLabelChange={(value) => {
        updateSession((current) =>
          updateQaDeviceLabel(current, value),
        );
      }}
      onCompactDeviceLabelChange={(value) => {
        updateSession((current) =>
          updateQaCompactDeviceLabel(current, value),
        );
      }}
      onInputMethodLabelChange={(value) => {
        updateSession((current) =>
          updateQaInputMethodLabel(current, value),
        );
      }}
      onPhysicalContextChange={(
        key: keyof QaPhysicalContext,
        value: boolean,
      ) => {
        updateSession((current) =>
          updateQaPhysicalContext(current, key, value),
        );
      }}
      onSpotCheckChange={(
        key: keyof QaSpotChecks,
        value: QaSpotCheckStatus,
      ) => {
        updateSession((current) =>
          updateQaSpotCheck(current, key, value),
        );
      }}
      onNotesChange={(value) => {
        updateSession((current) =>
          updateQaTimingNotes(current, value),
        );
      }}
      onResetSamples={() => {
        updateSession(resetQaTimingSamples);
      }}
    />
  );

  return {
    panel,
    reset,
    start,
    commit,
  };
}
