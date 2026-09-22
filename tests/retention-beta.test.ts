import { describe, expect, it } from "vitest";

import {
  RETENTION_BETA_EVENT_LIMIT,
  RETENTION_BETA_STORAGE_KEY,
  appendRetentionBetaEvent,
  buildRetentionBetaExport,
  createRetentionBetaSession,
  currentRetentionTripOrdinal,
  loadRetentionBetaSession,
  nextRetentionTripOrdinal,
  persistRetentionBetaSession,
  summarizeRetentionBeta,
  type RetentionBetaEvent,
} from "../src/qa/retention-beta";

const START = "2026-09-22T08:00:00.000Z";
const LATER = "2026-09-22T08:05:00.000Z";

const event = (
  value: {
    readonly type: RetentionBetaEvent["type"];
    readonly at?: string;
    readonly [key: string]: unknown;
  },
): RetentionBetaEvent =>
  ({
    ...value,
    at: value.at ?? LATER,
  }) as RetentionBetaEvent;

const storage = () => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

describe("retention beta evidence", () => {
  it("restores a valid privacy-safe session across local storage", () => {
    const store = storage();
    let session = createRetentionBetaSession(START);

    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
    );

    persistRetentionBetaSession(store, session);

    expect(loadRetentionBetaSession(store, LATER)).toEqual(session);
    expect(store.values.has(RETENTION_BETA_STORAGE_KEY)).toBe(true);
  });

  it("falls back safely when retained evidence is malformed", () => {
    const store = storage();
    store.setItem(RETENTION_BETA_STORAGE_KEY, "{broken");

    const restored = loadRetentionBetaSession(store, START);

    expect(restored.version).toBe(1);
    expect(restored.variant).toBe("repeat-acceleration");
    expect(restored.events).toEqual([]);
    expect(restored.createdAt).toBe(START);
  });

  it("deduplicates item milestones for one trip", () => {
    const base = createRetentionBetaSession(START);
    const milestone = event({
      type: "item_milestone",
      tripOrdinal: 1,
      itemCount: 5,
    });

    const once = appendRetentionBetaEvent(base, milestone);
    const twice = appendRetentionBetaEvent(once, {
      ...milestone,
      at: "2026-09-22T08:06:00.000Z",
    });

    expect(twice).toBe(once);
    expect(twice.events).toHaveLength(1);
  });

  it("keeps a bounded local event history", () => {
    let session = createRetentionBetaSession(START);

    for (let index = 0; index < RETENTION_BETA_EVENT_LIMIT + 10; index += 1) {
      session = appendRetentionBetaEvent(
        session,
        event({
          type: "manual_entry_abandoned",
          tripOrdinal: 1,
        }),
      );
    }

    expect(session.events).toHaveLength(RETENTION_BETA_EVENT_LIMIT);
  });

  it("keeps trip ordinals relative to the beta session rather than shopping history", () => {
    let session = createRetentionBetaSession(START);

    expect(nextRetentionTripOrdinal(session)).toBe(1);
    expect(currentRetentionTripOrdinal(session)).toBeNull();

    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
    );

    expect(currentRetentionTripOrdinal(session)).toBe(1);
    expect(nextRetentionTripOrdinal(session)).toBe(2);

    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_finished",
        tripOrdinal: 1,
      }),
    );

    expect(currentRetentionTripOrdinal(session)).toBeNull();
    expect(nextRetentionTripOrdinal(session)).toBe(2);
  });

  it("keeps mid-trip evidence partial and advances the next observed trip ordinal", () => {
    let session = createRetentionBetaSession(START);

    session = appendRetentionBetaEvent(
      session,
      event({
        type: "manual_entry_completed",
        tripOrdinal: 1,
        durationMs: 2_300,
      }),
    );
    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_finished",
        tripOrdinal: 1,
      }),
    );

    expect(currentRetentionTripOrdinal(session)).toBeNull();
    expect(nextRetentionTripOrdinal(session)).toBe(2);
    expect(summarizeRetentionBeta(session).tripsStarted).toBe(0);
  });

  it("treats restored and mid-beta trips as explicit resume evidence", () => {
    let session = createRetentionBetaSession(START);

    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_started",
        tripOrdinal: 1,
        source: "resume",
      }),
    );
    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_restored",
        tripOrdinal: 1,
      }),
    );

    const summary = summarizeRetentionBeta(session);

    expect(currentRetentionTripOrdinal(session)).toBe(1);
    expect(summary.tripsStarted).toBe(1);
    expect(summary.repeatTripStarts).toBe(0);
    expect(summary.tripRestores).toBe(1);
  });

  it("derives the documented 7, 14 and 30 day second-trip windows", () => {
    let session = createRetentionBetaSession(START);

    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
        at: "2026-09-01T08:00:00.000Z",
      }),
    );
    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_finished",
        tripOrdinal: 1,
        at: "2026-09-01T09:00:00.000Z",
      }),
    );
    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_started",
        tripOrdinal: 2,
        source: "repeat",
        at: "2026-09-11T08:00:00.000Z",
      }),
    );

    expect(summarizeRetentionBeta(session)).toMatchObject({
      daysToSecondTrip: 10,
      secondTripWithin7Days: false,
      secondTripWithin14Days: true,
      secondTripWithin30Days: true,
    });
  });

  it("summarizes repeat retention and manual-entry friction without money", () => {
    let session = createRetentionBetaSession(START);

    const events: readonly RetentionBetaEvent[] = [
      event({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
      event({
        type: "item_milestone",
        tripOrdinal: 1,
        itemCount: 1,
      }),
      event({
        type: "item_milestone",
        tripOrdinal: 1,
        itemCount: 5,
      }),
      event({
        type: "item_milestone",
        tripOrdinal: 1,
        itemCount: 10,
      }),
      event({
        type: "manual_entry_completed",
        tripOrdinal: 1,
        durationMs: 2_100,
      }),
      event({
        type: "manual_entry_completed",
        tripOrdinal: 1,
        durationMs: 2_900,
      }),
      event({
        type: "manual_entry_abandoned",
        tripOrdinal: 1,
      }),
      event({
        type: "trip_finished",
        tripOrdinal: 1,
      }),
      event({
        type: "trip_started",
        tripOrdinal: 2,
        source: "repeat",
      }),
      event({
        type: "remembered_item_used",
        tripOrdinal: 2,
      }),
      event({
        type: "current_price_override_started",
        tripOrdinal: 2,
      }),
      event({
        type: "trip_finished",
        tripOrdinal: 2,
      }),
      event({
        type: "trip_started",
        tripOrdinal: 3,
        source: "repeat",
      }),
    ];

    for (const candidate of events) {
      session = appendRetentionBetaEvent(session, candidate);
    }

    expect(summarizeRetentionBeta(session)).toEqual({
      tripsStarted: 3,
      tripsFinished: 2,
      secondTripStarted: true,
      thirdTripStarted: true,
      secondTripWithin7Days: true,
      secondTripWithin14Days: true,
      secondTripWithin30Days: true,
      daysToSecondTrip: 0,
      repeatTripStarts: 2,
      tripRestores: 0,
      firstItemTrips: 1,
      fifthItemTrips: 1,
      tenthItemTrips: 1,
      manualEntriesCompleted: 2,
      manualEntriesAbandoned: 1,
      medianManualEntryMs: 2_500,
      rememberedItemUses: 1,
      currentPriceOverrides: 1,
    });
  });

  it("exports only event structure and explicit privacy claims", () => {
    let session = createRetentionBetaSession(START);
    session = appendRetentionBetaEvent(
      session,
      event({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
    );

    const report = buildRetentionBetaExport(session, LATER);
    const raw = JSON.stringify(report);

    expect(report.privacy).toEqual({
      networkTransmission: false,
      containsMoney: false,
      containsItemNames: false,
      containsStoreHistory: false,
    });
    expect(raw).not.toContain("budgetMinor");
    expect(raw).not.toContain("price");
    expect(raw).not.toContain("itemName");
    expect(raw).not.toContain("storeId");
  });
});
