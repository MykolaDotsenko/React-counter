import {
  summarizeRetentionBeta,
  type RetentionBetaEvent,
  type RetentionBetaExport,
} from "./retention-beta";

const DAY_MS = 86_400_000;

export interface RetentionBetaCohortSummary {
  readonly participantCount: number;
  readonly activatedParticipants: number;
  readonly secondTripParticipants: number;
  readonly thirdTripParticipants: number;
  readonly secondTripWithin7DaysParticipants: number;
  readonly secondTripWithin14DaysParticipants: number;
  readonly secondTripWithin30DaysParticipants: number;
  readonly secondTripWithin7DaysEligibleParticipants: number;
  readonly secondTripWithin14DaysEligibleParticipants: number;
  readonly secondTripWithin30DaysEligibleParticipants: number;
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


export const RETENTION_BETA_MIN_INTERPRETABLE_COHORT = 20;
export const RETENTION_BETA_TARGET_COHORT_MAX = 50;

export interface RetentionWindowReadiness {
  readonly eligibleParticipants: number;
  readonly minimumRequired: number;
  readonly ready: boolean;
}

export interface RetentionBetaCohortReadiness {
  readonly participantCount: number;
  readonly minimumParticipants: number;
  readonly targetMaximumParticipants: number;
  readonly participantStatus:
    | "collecting"
    | "target-range"
    | "above-target";
  readonly sevenDay: RetentionWindowReadiness;
  readonly fourteenDay: RetentionWindowReadiness;
  readonly thirtyDay: RetentionWindowReadiness;
}

const windowReadiness = (
  eligibleParticipants: number,
): RetentionWindowReadiness =>
  Object.freeze({
    eligibleParticipants,
    minimumRequired: RETENTION_BETA_MIN_INTERPRETABLE_COHORT,
    ready:
      eligibleParticipants >= RETENTION_BETA_MIN_INTERPRETABLE_COHORT,
  });

export const summarizeRetentionBetaCohortReadiness = (
  summary: RetentionBetaCohortSummary,
): RetentionBetaCohortReadiness => {
  const participantStatus =
    summary.participantCount <
    RETENTION_BETA_MIN_INTERPRETABLE_COHORT
      ? "collecting"
      : summary.participantCount <=
          RETENTION_BETA_TARGET_COHORT_MAX
        ? "target-range"
        : "above-target";

  return Object.freeze({
    participantCount: summary.participantCount,
    minimumParticipants: RETENTION_BETA_MIN_INTERPRETABLE_COHORT,
    targetMaximumParticipants: RETENTION_BETA_TARGET_COHORT_MAX,
    participantStatus,
    sevenDay: windowReadiness(
      summary.secondTripWithin7DaysEligibleParticipants,
    ),
    fourteenDay: windowReadiness(
      summary.secondTripWithin14DaysEligibleParticipants,
    ),
    thirtyDay: windowReadiness(
      summary.secondTripWithin30DaysEligibleParticipants,
    ),
  });
};

interface ParticipantSnapshot {
  readonly report: RetentionBetaExport;
  readonly summary: ReturnType<typeof summarizeRetentionBeta>;
  readonly firstTripStartedAt: string | null;
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

const firstTripStartedAt = (
  events: readonly RetentionBetaEvent[],
): string | null =>
  events.find(
    (event) =>
      event.type === "trip_started" &&
      event.tripOrdinal === 1,
  )?.at ?? null;

const windowMature = (
  snapshot: ParticipantSnapshot,
  windowDays: number,
  alreadySucceeded: boolean,
): boolean => {
  if (alreadySucceeded) {
    return true;
  }

  if (snapshot.firstTripStartedAt === null) {
    return false;
  }

  return (
    Date.parse(snapshot.report.generatedAt) -
      Date.parse(snapshot.firstTripStartedAt) >=
    windowDays * DAY_MS
  );
};

export const summarizeRetentionBetaCohort = (
  reports: readonly RetentionBetaExport[],
): RetentionBetaCohortSummary => {
  const snapshots = reports.map((report) => ({
    report,
    summary: summarizeRetentionBeta(report.session),
    firstTripStartedAt: firstTripStartedAt(report.session.events),
  }));
  const activated = snapshots.filter(
    ({ summary }) => summary.tripsStarted > 0,
  );
  const activatedParticipants = activated.length;

  const secondTripParticipants = activated.filter(
    ({ summary }) => summary.secondTripStarted,
  ).length;
  const thirdTripParticipants = activated.filter(
    ({ summary }) => summary.thirdTripStarted,
  ).length;

  const secondTripWithin7DaysParticipants = activated.filter(
    ({ summary }) => summary.secondTripWithin7Days,
  ).length;
  const secondTripWithin14DaysParticipants = activated.filter(
    ({ summary }) => summary.secondTripWithin14Days,
  ).length;
  const secondTripWithin30DaysParticipants = activated.filter(
    ({ summary }) => summary.secondTripWithin30Days,
  ).length;

  const secondTripWithin7DaysEligibleParticipants = activated.filter(
    (snapshot) =>
      windowMature(
        snapshot,
        7,
        snapshot.summary.secondTripWithin7Days,
      ),
  ).length;
  const secondTripWithin14DaysEligibleParticipants = activated.filter(
    (snapshot) =>
      windowMature(
        snapshot,
        14,
        snapshot.summary.secondTripWithin14Days,
      ),
  ).length;
  const secondTripWithin30DaysEligibleParticipants = activated.filter(
    (snapshot) =>
      windowMature(
        snapshot,
        30,
        snapshot.summary.secondTripWithin30Days,
      ),
  ).length;

  const totalTripsStarted = activated.reduce(
    (sum, { summary }) => sum + summary.tripsStarted,
    0,
  );
  const totalTripsFinished = activated.reduce(
    (sum, { summary }) => sum + summary.tripsFinished,
    0,
  );

  const firstItemParticipants = activated.filter(
    ({ summary }) => summary.firstItemTrips > 0,
  ).length;
  const fifthItemParticipants = activated.filter(
    ({ summary }) => summary.fifthItemTrips > 0,
  ).length;
  const tenthItemParticipants = activated.filter(
    ({ summary }) => summary.tenthItemTrips > 0,
  ).length;

  const repeatTripStarts = activated.reduce(
    (sum, { summary }) => sum + summary.repeatTripStarts,
    0,
  );
  const repeatTripParticipants = activated.filter(
    ({ summary }) => summary.repeatTripStarts > 0,
  ).length;

  const manualDurations = reports.flatMap((report) =>
    report.session.events.flatMap((event) =>
      event.type === "manual_entry_completed" ? [event.durationMs] : [],
    ),
  );
  const manualEntriesCompleted = manualDurations.length;
  const manualEntriesAbandoned = snapshots.reduce(
    (sum, { summary }) => sum + summary.manualEntriesAbandoned,
    0,
  );

  const rememberedItemUses = snapshots.reduce(
    (sum, { summary }) => sum + summary.rememberedItemUses,
    0,
  );
  const rememberedItemParticipants = activated.filter(
    ({ summary }) => summary.rememberedItemUses > 0,
  ).length;

  return Object.freeze({
    participantCount: reports.length,
    activatedParticipants,
    secondTripParticipants,
    thirdTripParticipants,
    secondTripWithin7DaysParticipants,
    secondTripWithin14DaysParticipants,
    secondTripWithin30DaysParticipants,
    secondTripWithin7DaysEligibleParticipants,
    secondTripWithin14DaysEligibleParticipants,
    secondTripWithin30DaysEligibleParticipants,
    secondTripRate: rate(
      secondTripParticipants,
      activatedParticipants,
    ),
    thirdTripRate: rate(
      thirdTripParticipants,
      activatedParticipants,
    ),
    thirdTripAmongSecondTripRate: rate(
      thirdTripParticipants,
      secondTripParticipants,
    ),
    secondTripWithin7DaysRate: rate(
      secondTripWithin7DaysParticipants,
      secondTripWithin7DaysEligibleParticipants,
    ),
    secondTripWithin14DaysRate: rate(
      secondTripWithin14DaysParticipants,
      secondTripWithin14DaysEligibleParticipants,
    ),
    secondTripWithin30DaysRate: rate(
      secondTripWithin30DaysParticipants,
      secondTripWithin30DaysEligibleParticipants,
    ),
    totalTripsStarted,
    totalTripsFinished,
    tripCompletionRate: rate(totalTripsFinished, totalTripsStarted),
    firstItemParticipants,
    fifthItemParticipants,
    tenthItemParticipants,
    firstItemReachRate: rate(
      firstItemParticipants,
      activatedParticipants,
    ),
    fifthItemReachRate: rate(
      fifthItemParticipants,
      activatedParticipants,
    ),
    tenthItemReachRate: rate(
      tenthItemParticipants,
      activatedParticipants,
    ),
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
      activatedParticipants,
    ),
    currentPriceOverrides: snapshots.reduce(
      (sum, { summary }) => sum + summary.currentPriceOverrides,
      0,
    ),
  });
};
