import {
  summarizeRetentionBeta,
  type RetentionBetaSession,
} from "./retention-beta";

export interface RetentionBetaCohortSummary {
  readonly participantCount: number;
  readonly activatedParticipants: number;
  readonly secondTripParticipants: number;
  readonly thirdTripParticipants: number;
  readonly secondTripWithin7DaysParticipants: number;
  readonly secondTripWithin14DaysParticipants: number;
  readonly secondTripWithin30DaysParticipants: number;
  readonly secondTripRate: number | null;
  readonly thirdTripRate: number | null;
  readonly thirdTripAmongSecondTripRate: number | null;
  readonly secondTripWithin7DaysRate: number | null;
  readonly secondTripWithin14DaysRate: number | null;
  readonly secondTripWithin30DaysRate: number | null;
  readonly totalTripsStarted: number;
  readonly totalTripsFinished: number;
  readonly tripCompletionRate: number | null;
  readonly firstItemParticipants: number;
  readonly fifthItemParticipants: number;
  readonly tenthItemParticipants: number;
  readonly firstItemReachRate: number | null;
  readonly fifthItemReachRate: number | null;
  readonly tenthItemReachRate: number | null;
  readonly repeatTripStarts: number;
  readonly repeatTripParticipants: number;
  readonly repeatTripParticipantRate: number | null;
  readonly manualEntriesCompleted: number;
  readonly manualEntriesAbandoned: number;
  readonly manualEntryAbandonmentRate: number | null;
  readonly medianManualEntryMs: number | null;
  readonly rememberedItemUses: number;
  readonly rememberedItemParticipants: number;
  readonly rememberedItemParticipantRate: number | null;
  readonly currentPriceOverrides: number;
}

const rate = (
  numerator: number,
  denominator: number,
): number | null => (denominator === 0 ? null : numerator / denominator);

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const lower = sorted[middle - 1];
  const upper = sorted[middle];

  return lower === undefined || upper === undefined
    ? null
    : (lower + upper) / 2;
};

export const summarizeRetentionBetaCohort = (
  sessions: readonly RetentionBetaSession[],
): RetentionBetaCohortSummary => {
  const summaries = sessions.map(summarizeRetentionBeta);
  const activated = summaries.filter((summary) => summary.tripsStarted > 0);
  const activatedParticipants = activated.length;

  const secondTripParticipants = activated.filter(
    (summary) => summary.secondTripStarted,
  ).length;
  const thirdTripParticipants = activated.filter(
    (summary) => summary.thirdTripStarted,
  ).length;
  const secondTripWithin7DaysParticipants = activated.filter(
    (summary) => summary.secondTripWithin7Days,
  ).length;
  const secondTripWithin14DaysParticipants = activated.filter(
    (summary) => summary.secondTripWithin14Days,
  ).length;
  const secondTripWithin30DaysParticipants = activated.filter(
    (summary) => summary.secondTripWithin30Days,
  ).length;

  const totalTripsStarted = activated.reduce(
    (sum, summary) => sum + summary.tripsStarted,
    0,
  );
  const totalTripsFinished = activated.reduce(
    (sum, summary) => sum + summary.tripsFinished,
    0,
  );

  const firstItemParticipants = activated.filter(
    (summary) => summary.firstItemTrips > 0,
  ).length;
  const fifthItemParticipants = activated.filter(
    (summary) => summary.fifthItemTrips > 0,
  ).length;
  const tenthItemParticipants = activated.filter(
    (summary) => summary.tenthItemTrips > 0,
  ).length;

  const repeatTripStarts = activated.reduce(
    (sum, summary) => sum + summary.repeatTripStarts,
    0,
  );
  const repeatTripParticipants = activated.filter(
    (summary) => summary.repeatTripStarts > 0,
  ).length;

  const manualDurations = sessions.flatMap((session) =>
    session.events.flatMap((event) =>
      event.type === "manual_entry_completed" ? [event.durationMs] : [],
    ),
  );
  const manualEntriesCompleted = manualDurations.length;
  const manualEntriesAbandoned = activated.reduce(
    (sum, summary) => sum + summary.manualEntriesAbandoned,
    0,
  );

  const rememberedItemUses = activated.reduce(
    (sum, summary) => sum + summary.rememberedItemUses,
    0,
  );
  const rememberedItemParticipants = activated.filter(
    (summary) => summary.rememberedItemUses > 0,
  ).length;

  return Object.freeze({
    participantCount: sessions.length,
    activatedParticipants,
    secondTripParticipants,
    thirdTripParticipants,
    secondTripWithin7DaysParticipants,
    secondTripWithin14DaysParticipants,
    secondTripWithin30DaysParticipants,
    secondTripRate: rate(secondTripParticipants, activatedParticipants),
    thirdTripRate: rate(thirdTripParticipants, activatedParticipants),
    thirdTripAmongSecondTripRate: rate(
      thirdTripParticipants,
      secondTripParticipants,
    ),
    secondTripWithin7DaysRate: rate(
      secondTripWithin7DaysParticipants,
      activatedParticipants,
    ),
    secondTripWithin14DaysRate: rate(
      secondTripWithin14DaysParticipants,
      activatedParticipants,
    ),
    secondTripWithin30DaysRate: rate(
      secondTripWithin30DaysParticipants,
      activatedParticipants,
    ),
    totalTripsStarted,
    totalTripsFinished,
    tripCompletionRate: rate(totalTripsFinished, totalTripsStarted),
    firstItemParticipants,
    fifthItemParticipants,
    tenthItemParticipants,
    firstItemReachRate: rate(firstItemParticipants, activatedParticipants),
    fifthItemReachRate: rate(fifthItemParticipants, activatedParticipants),
    tenthItemReachRate: rate(tenthItemParticipants, activatedParticipants),
    repeatTripStarts,
    repeatTripParticipants,
    repeatTripParticipantRate: rate(
      repeatTripParticipants,
      activatedParticipants,
    ),
    manualEntriesCompleted,
    manualEntriesAbandoned,
    manualEntryAbandonmentRate: rate(
      manualEntriesAbandoned,
      manualEntriesCompleted + manualEntriesAbandoned,
    ),
    medianManualEntryMs: median(manualDurations),
    rememberedItemUses,
    rememberedItemParticipants,
    rememberedItemParticipantRate: rate(
      rememberedItemParticipants,
      secondTripParticipants,
    ),
    currentPriceOverrides: activated.reduce(
      (sum, summary) => sum + summary.currentPriceOverrides,
      0,
    ),
  });
};
