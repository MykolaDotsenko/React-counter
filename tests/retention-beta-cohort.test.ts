import { describe, expect, it } from "vitest";

import {
  appendRetentionBetaEvent,
  createRetentionBetaSession,
  type RetentionBetaEvent,
  type RetentionBetaSession,
} from "../src/qa/retention-beta";
import { summarizeRetentionBetaCohort } from "../src/qa/retention-beta-cohort";

const session = (
  events: readonly RetentionBetaEvent[],
  createdAt = "2026-09-01T08:00:00.000Z",
): RetentionBetaSession => {
  let result = createRetentionBetaSession(createdAt);

  for (const event of events) {
    result = appendRetentionBetaEvent(result, event);
  }

  return result;
};

const at = (
  type: RetentionBetaEvent["type"],
  tripOrdinal: number,
  timestamp: string,
  extra: Record<string, unknown> = {},
): RetentionBetaEvent =>
  ({
    type,
    tripOrdinal,
    at: timestamp,
    ...extra,
  }) as RetentionBetaEvent;

describe("retention beta cohort analysis", () => {
  it("returns null rates instead of inventing evidence for an empty cohort", () => {
    expect(summarizeRetentionBetaCohort([])).toMatchObject({
      participantCount: 0,
      activatedParticipants: 0,
      secondTripRate: null,
      thirdTripRate: null,
      tripCompletionRate: null,
      manualEntryAbandonmentRate: null,
      medianManualEntryMs: null,
    });
  });

  it("uses activated participants as the retention denominator", () => {
    const activated = session([
      at("trip_started", 1, "2026-09-01T08:00:00.000Z", { source: "new" }),
      at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
      at("trip_started", 2, "2026-09-06T08:00:00.000Z", { source: "repeat" }),
    ]);
    const notActivated = session([]);

    const summary = summarizeRetentionBetaCohort([
      activated,
      notActivated,
    ]);

    expect(summary.participantCount).toBe(2);
    expect(summary.activatedParticipants).toBe(1);
    expect(summary.secondTripParticipants).toBe(1);
    expect(summary.secondTripRate).toBe(1);
    expect(summary.secondTripWithin7DaysRate).toBe(1);
  });

  it("aggregates retention, completion, milestones and repeat usage", () => {
    const first = session([
      at("trip_started", 1, "2026-09-01T08:00:00.000Z", { source: "new" }),
      at("item_milestone", 1, "2026-09-01T08:01:00.000Z", { itemCount: 1 }),
      at("item_milestone", 1, "2026-09-01T08:02:00.000Z", { itemCount: 5 }),
      at("item_milestone", 1, "2026-09-01T08:03:00.000Z", { itemCount: 10 }),
      at("manual_entry_completed", 1, "2026-09-01T08:04:00.000Z", { durationMs: 2_000 }),
      at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
      at("trip_started", 2, "2026-09-08T08:00:00.000Z", { source: "repeat" }),
      at("remembered_item_used", 2, "2026-09-08T08:01:00.000Z"),
      at("manual_entry_completed", 2, "2026-09-08T08:02:00.000Z", { durationMs: 4_000 }),
      at("trip_finished", 2, "2026-09-08T09:00:00.000Z"),
      at("trip_started", 3, "2026-09-15T08:00:00.000Z", { source: "repeat" }),
    ]);

    const second = session([
      at("trip_started", 1, "2026-09-02T08:00:00.000Z", { source: "new" }),
      at("item_milestone", 1, "2026-09-02T08:01:00.000Z", { itemCount: 1 }),
      at("manual_entry_abandoned", 1, "2026-09-02T08:02:00.000Z"),
    ]);

    const summary = summarizeRetentionBetaCohort([first, second]);

    expect(summary).toMatchObject({
      participantCount: 2,
      activatedParticipants: 2,
      secondTripParticipants: 1,
      thirdTripParticipants: 1,
      secondTripRate: 0.5,
      thirdTripRate: 0.5,
      thirdTripAmongSecondTripRate: 1,
      secondTripWithin7DaysRate: 0.5,
      totalTripsStarted: 4,
      totalTripsFinished: 2,
      tripCompletionRate: 0.5,
      firstItemParticipants: 2,
      fifthItemParticipants: 1,
      tenthItemParticipants: 1,
      firstItemReachRate: 1,
      fifthItemReachRate: 0.5,
      tenthItemReachRate: 0.5,
      repeatTripStarts: 2,
      repeatTripParticipants: 1,
      repeatTripParticipantRate: 0.5,
      manualEntriesCompleted: 2,
      manualEntriesAbandoned: 1,
      manualEntryAbandonmentRate: 1 / 3,
      medianManualEntryMs: 3_000,
      rememberedItemUses: 1,
      rememberedItemParticipants: 1,
      rememberedItemParticipantRate: 0.5,
    });
  });

  it("measures remembered-item reach across activated participants", () => {
    const firstTripOnly = session([
      at("trip_started", 1, "2026-09-01T08:00:00.000Z", { source: "new" }),
      at("remembered_item_used", 1, "2026-09-01T08:01:00.000Z"),
    ]);

    expect(
      summarizeRetentionBetaCohort([firstTripOnly])
        .rememberedItemParticipantRate,
    ).toBe(1);
  });

  it("keeps interaction evidence from a partial session without inflating retention or completion", () => {
    const partial = session([
      at("manual_entry_completed", 1, "2026-09-01T08:30:00.000Z", {
        durationMs: 2_400,
      }),
      at("manual_entry_abandoned", 1, "2026-09-01T08:31:00.000Z"),
      at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
    ]);

    const summary = summarizeRetentionBetaCohort([partial]);

    expect(summary.activatedParticipants).toBe(0);
    expect(summary.totalTripsStarted).toBe(0);
    expect(summary.totalTripsFinished).toBe(0);
    expect(summary.tripCompletionRate).toBeNull();
    expect(summary.manualEntriesCompleted).toBe(1);
    expect(summary.manualEntriesAbandoned).toBe(1);
    expect(summary.manualEntryAbandonmentRate).toBe(0.5);
    expect(summary.medianManualEntryMs).toBe(2_400);
  });
});
