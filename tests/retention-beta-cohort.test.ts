import { describe, expect, it } from "vitest";

import {
  appendRetentionBetaEvent,
  buildRetentionBetaExport,
  createRetentionBetaSession,
  type RetentionBetaEvent,
  type RetentionBetaExport,
  type RetentionBetaSession,
} from "../src/qa/retention-beta";
import {
  RETENTION_BETA_MIN_INTERPRETABLE_COHORT,
  summarizeRetentionBetaCohort,
  summarizeRetentionBetaCohortReadiness,
} from "../src/qa/retention-beta-cohort";

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

const report = (
  events: readonly RetentionBetaEvent[],
  generatedAt: string,
  createdAt = "2026-09-01T08:00:00.000Z",
): RetentionBetaExport =>
  buildRetentionBetaExport(
    session(events, createdAt),
    generatedAt,
  );

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
      secondTripWithin7DaysEligibleParticipants: 0,
      secondTripWithin14DaysEligibleParticipants: 0,
      secondTripWithin30DaysEligibleParticipants: 0,
      secondTripWithin7DaysRate: null,
      secondTripWithin14DaysRate: null,
      secondTripWithin30DaysRate: null,
      tripCompletionRate: null,
      manualEntryAbandonmentRate: null,
      medianManualEntryMs: null,
    });
  });

  it("uses activated participants as the overall retention denominator", () => {
    const activated = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
        at("trip_started", 2, "2026-09-06T08:00:00.000Z", {
          source: "repeat",
        }),
      ],
      "2026-09-06T08:05:00.000Z",
    );
    const notActivated = report(
      [],
      "2026-09-06T08:05:00.000Z",
    );

    const summary = summarizeRetentionBetaCohort([
      activated,
      notActivated,
    ]);

    expect(summary.participantCount).toBe(2);
    expect(summary.activatedParticipants).toBe(1);
    expect(summary.secondTripParticipants).toBe(1);
    expect(summary.secondTripRate).toBe(1);
    expect(summary.secondTripWithin7DaysEligibleParticipants).toBe(1);
    expect(summary.secondTripWithin7DaysRate).toBe(1);
  });

  it("uses mature observation windows instead of counting censored users as failures", () => {
    const immature = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
      ],
      "2026-09-03T08:00:00.000Z",
    );

    const summary = summarizeRetentionBetaCohort([immature]);

    expect(summary.activatedParticipants).toBe(1);
    expect(summary.secondTripParticipants).toBe(0);
    expect(summary.secondTripRate).toBe(0);
    expect(summary.secondTripWithin7DaysEligibleParticipants).toBe(0);
    expect(summary.secondTripWithin14DaysEligibleParticipants).toBe(0);
    expect(summary.secondTripWithin30DaysEligibleParticipants).toBe(0);
    expect(summary.secondTripWithin7DaysRate).toBeNull();
    expect(summary.secondTripWithin14DaysRate).toBeNull();
    expect(summary.secondTripWithin30DaysRate).toBeNull();
  });

  it("counts an observed early return as eligible before the full window elapses", () => {
    const earlyReturn = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("trip_started", 2, "2026-09-03T08:00:00.000Z", {
          source: "repeat",
        }),
      ],
      "2026-09-03T08:05:00.000Z",
    );

    const summary = summarizeRetentionBetaCohort([earlyReturn]);

    expect(summary.secondTripWithin7DaysParticipants).toBe(1);
    expect(summary.secondTripWithin14DaysParticipants).toBe(1);
    expect(summary.secondTripWithin30DaysParticipants).toBe(1);
    expect(summary.secondTripWithin7DaysEligibleParticipants).toBe(1);
    expect(summary.secondTripWithin14DaysEligibleParticipants).toBe(1);
    expect(summary.secondTripWithin30DaysEligibleParticipants).toBe(1);
    expect(summary.secondTripWithin7DaysRate).toBe(1);
    expect(summary.secondTripWithin14DaysRate).toBe(1);
    expect(summary.secondTripWithin30DaysRate).toBe(1);
  });

  it("aggregates retention, completion, milestones and repeat usage", () => {
    const first = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("item_milestone", 1, "2026-09-01T08:01:00.000Z", {
          itemCount: 1,
        }),
        at("item_milestone", 1, "2026-09-01T08:02:00.000Z", {
          itemCount: 5,
        }),
        at("item_milestone", 1, "2026-09-01T08:03:00.000Z", {
          itemCount: 10,
        }),
        at(
          "manual_entry_completed",
          1,
          "2026-09-01T08:04:00.000Z",
          { durationMs: 2_000 },
        ),
        at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
        at("trip_started", 2, "2026-09-08T08:00:00.000Z", {
          source: "repeat",
        }),
        at("remembered_item_used", 2, "2026-09-08T08:01:00.000Z"),
        at(
          "manual_entry_completed",
          2,
          "2026-09-08T08:02:00.000Z",
          { durationMs: 4_000 },
        ),
        at("trip_finished", 2, "2026-09-08T09:00:00.000Z"),
        at("trip_started", 3, "2026-09-15T08:00:00.000Z", {
          source: "repeat",
        }),
      ],
      "2026-09-15T09:00:00.000Z",
    );

    const second = report(
      [
        at("trip_started", 1, "2026-09-02T08:00:00.000Z", {
          source: "new",
        }),
        at("item_milestone", 1, "2026-09-02T08:01:00.000Z", {
          itemCount: 1,
        }),
        at(
          "manual_entry_abandoned",
          1,
          "2026-09-02T08:02:00.000Z",
        ),
      ],
      "2026-09-20T08:00:00.000Z",
      "2026-09-02T08:00:00.000Z",
    );

    const summary = summarizeRetentionBetaCohort([first, second]);

    expect(summary).toMatchObject({
      participantCount: 2,
      activatedParticipants: 2,
      secondTripParticipants: 1,
      thirdTripParticipants: 1,
      secondTripRate: 0.5,
      thirdTripRate: 0.5,
      thirdTripAmongSecondTripRate: 1,
      secondTripWithin7DaysParticipants: 1,
      secondTripWithin7DaysEligibleParticipants: 2,
      secondTripWithin7DaysRate: 0.5,
      secondTripWithin14DaysEligibleParticipants: 2,
      secondTripWithin14DaysRate: 0.5,
      secondTripWithin30DaysEligibleParticipants: 1,
      secondTripWithin30DaysRate: 1,
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
    const firstTripOnly = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("remembered_item_used", 1, "2026-09-01T08:01:00.000Z"),
      ],
      "2026-09-01T08:05:00.000Z",
    );

    expect(
      summarizeRetentionBetaCohort([firstTripOnly])
        .rememberedItemParticipantRate,
    ).toBe(1);
  });

  it("keeps interaction evidence from a partial session without inflating retention or completion", () => {
    const partial = report(
      [
        at(
          "manual_entry_completed",
          1,
          "2026-09-01T08:30:00.000Z",
          { durationMs: 2_400 },
        ),
        at(
          "manual_entry_abandoned",
          1,
          "2026-09-01T08:31:00.000Z",
        ),
        at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
      ],
      "2026-09-01T09:05:00.000Z",
    );

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

  it("does not inflate cohort retention from a skipped trip ordinal", () => {
    const malformedJourney = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("trip_started", 3, "2026-09-03T08:00:00.000Z", {
          source: "repeat",
        }),
      ],
      "2026-10-05T08:00:00.000Z",
    );

    const summary = summarizeRetentionBetaCohort([
      malformedJourney,
    ]);

    expect(summary.activatedParticipants).toBe(1);
    expect(summary.secondTripParticipants).toBe(0);
    expect(summary.thirdTripParticipants).toBe(0);
    expect(summary.secondTripRate).toBe(0);
    expect(summary.thirdTripRate).toBe(0);
    expect(summary.repeatTripStarts).toBe(0);
  });


  it("requires the cohort minimum before marking recruitment readiness", () => {
    const summary = summarizeRetentionBetaCohort([]);
    const nineteen = summarizeRetentionBetaCohortReadiness({
      ...summary,
      participantCount: 19,
    });
    const twenty = summarizeRetentionBetaCohortReadiness({
      ...summary,
      participantCount: RETENTION_BETA_MIN_INTERPRETABLE_COHORT,
    });

    expect(nineteen.participantStatus).toBe("collecting");
    expect(twenty.participantStatus).toBe("target-range");
  });

  it("tracks 7/14/30-day interpretation readiness from eligible denominators independently", () => {
    const base = summarizeRetentionBetaCohort([]);
    const readiness = summarizeRetentionBetaCohortReadiness({
      ...base,
      participantCount: 25,
      secondTripWithin7DaysEligibleParticipants: 20,
      secondTripWithin14DaysEligibleParticipants: 12,
      secondTripWithin30DaysEligibleParticipants: 4,
    });

    expect(readiness.participantStatus).toBe("target-range");
    expect(readiness.sevenDay).toMatchObject({
      eligibleParticipants: 20,
      minimumRequired: 20,
      ready: true,
    });
    expect(readiness.fourteenDay.ready).toBe(false);
    expect(readiness.thirtyDay.ready).toBe(false);
  });

});
