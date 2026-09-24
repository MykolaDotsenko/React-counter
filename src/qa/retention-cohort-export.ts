import {
  isImmutableEvidenceBuildRevision,
} from "./evidence-build";
import {
  summarizeRetentionBetaCohortReadiness,
  type RetentionBetaCohortReadiness,
  type RetentionBetaCohortSummary,
} from "./retention-beta-cohort";

export interface RetentionCohortAggregateExport {
  readonly schemaVersion: 3;
  readonly kind: "retention-cohort-summary";
  readonly sourceBuildRevision: string;
  readonly analyzerBuildRevision: string;
  readonly generatedAt: string;
  readonly sourceReportCount: number;
  readonly privacy: {
    readonly containsRawParticipantEvents: false;
    readonly containsParticipantFileNames: false;
    readonly containsParticipantIdentifiers: false;
    readonly networkTransmission: false;
  };
  readonly readiness: RetentionBetaCohortReadiness;
  readonly summary: RetentionBetaCohortSummary;
}

const hasExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const isCanonicalIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const isCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0;

const isDuration = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

const isRate = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

const sameNullableRate = (
  value: unknown,
  expected: number | null,
): boolean =>
  expected === null ? value === null : Object.is(value, expected);

const rate = (
  numerator: number,
  denominator: number,
): number | null =>
  denominator === 0 ? null : numerator / denominator;

const SUMMARY_KEYS = [
  "participantCount",
  "activatedParticipants",
  "secondTripParticipants",
  "thirdTripParticipants",
  "secondTripWithin7DaysParticipants",
  "secondTripWithin14DaysParticipants",
  "secondTripWithin30DaysParticipants",
  "secondTripWithin7DaysEligibleParticipants",
  "secondTripWithin14DaysEligibleParticipants",
  "secondTripWithin30DaysEligibleParticipants",
  "secondTripRate",
  "thirdTripRate",
  "thirdTripAmongSecondTripRate",
  "secondTripWithin7DaysRate",
  "secondTripWithin14DaysRate",
  "secondTripWithin30DaysRate",
  "totalTripsStarted",
  "totalTripsFinished",
  "tripCompletionRate",
  "firstItemParticipants",
  "fifthItemParticipants",
  "tenthItemParticipants",
  "firstItemReachRate",
  "fifthItemReachRate",
  "tenthItemReachRate",
  "repeatTripStarts",
  "repeatTripParticipants",
  "repeatTripParticipantRate",
  "manualEntriesCompleted",
  "manualEntriesAbandoned",
  "manualEntryAbandonmentRate",
  "medianManualEntryMs",
  "rememberedItemUses",
  "rememberedItemParticipants",
  "rememberedItemParticipantRate",
  "currentPriceOverrides",
] as const;

const COUNT_KEYS = [
  "participantCount",
  "activatedParticipants",
  "secondTripParticipants",
  "thirdTripParticipants",
  "secondTripWithin7DaysParticipants",
  "secondTripWithin14DaysParticipants",
  "secondTripWithin30DaysParticipants",
  "secondTripWithin7DaysEligibleParticipants",
  "secondTripWithin14DaysEligibleParticipants",
  "secondTripWithin30DaysEligibleParticipants",
  "totalTripsStarted",
  "totalTripsFinished",
  "firstItemParticipants",
  "fifthItemParticipants",
  "tenthItemParticipants",
  "repeatTripStarts",
  "repeatTripParticipants",
  "manualEntriesCompleted",
  "manualEntriesAbandoned",
  "rememberedItemUses",
  "rememberedItemParticipants",
  "currentPriceOverrides",
] as const;

const isRetentionCohortSummary = (
  value: unknown,
): value is RetentionBetaCohortSummary => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (
    !hasExactKeys(record, SUMMARY_KEYS) ||
    !COUNT_KEYS.every((key) => isCount(record[key])) ||
    !(
      record.medianManualEntryMs === null ||
      isDuration(record.medianManualEntryMs)
    )
  ) {
    return false;
  }

  const summary = record as unknown as RetentionBetaCohortSummary;

  if (
    summary.activatedParticipants > summary.participantCount ||
    summary.secondTripParticipants > summary.activatedParticipants ||
    summary.thirdTripParticipants > summary.secondTripParticipants ||
    summary.secondTripWithin7DaysParticipants >
      summary.secondTripParticipants ||
    summary.secondTripWithin14DaysParticipants >
      summary.secondTripParticipants ||
    summary.secondTripWithin30DaysParticipants >
      summary.secondTripParticipants ||
    summary.secondTripWithin7DaysEligibleParticipants >
      summary.activatedParticipants ||
    summary.secondTripWithin14DaysEligibleParticipants >
      summary.activatedParticipants ||
    summary.secondTripWithin30DaysEligibleParticipants >
      summary.activatedParticipants ||
    summary.secondTripWithin7DaysParticipants >
      summary.secondTripWithin7DaysEligibleParticipants ||
    summary.secondTripWithin14DaysParticipants >
      summary.secondTripWithin14DaysEligibleParticipants ||
    summary.secondTripWithin30DaysParticipants >
      summary.secondTripWithin30DaysEligibleParticipants ||
    summary.totalTripsFinished > summary.totalTripsStarted ||
    summary.firstItemParticipants > summary.activatedParticipants ||
    summary.fifthItemParticipants > summary.activatedParticipants ||
    summary.tenthItemParticipants > summary.activatedParticipants ||
    summary.repeatTripParticipants > summary.activatedParticipants ||
    summary.rememberedItemParticipants > summary.activatedParticipants
  ) {
    return false;
  }

  const expectedRates = [
    [
      summary.secondTripRate,
      rate(summary.secondTripParticipants, summary.activatedParticipants),
    ],
    [
      summary.thirdTripRate,
      rate(summary.thirdTripParticipants, summary.activatedParticipants),
    ],
    [
      summary.thirdTripAmongSecondTripRate,
      rate(summary.thirdTripParticipants, summary.secondTripParticipants),
    ],
    [
      summary.secondTripWithin7DaysRate,
      rate(
        summary.secondTripWithin7DaysParticipants,
        summary.secondTripWithin7DaysEligibleParticipants,
      ),
    ],
    [
      summary.secondTripWithin14DaysRate,
      rate(
        summary.secondTripWithin14DaysParticipants,
        summary.secondTripWithin14DaysEligibleParticipants,
      ),
    ],
    [
      summary.secondTripWithin30DaysRate,
      rate(
        summary.secondTripWithin30DaysParticipants,
        summary.secondTripWithin30DaysEligibleParticipants,
      ),
    ],
    [
      summary.tripCompletionRate,
      rate(summary.totalTripsFinished, summary.totalTripsStarted),
    ],
    [
      summary.firstItemReachRate,
      rate(summary.firstItemParticipants, summary.activatedParticipants),
    ],
    [
      summary.fifthItemReachRate,
      rate(summary.fifthItemParticipants, summary.activatedParticipants),
    ],
    [
      summary.tenthItemReachRate,
      rate(summary.tenthItemParticipants, summary.activatedParticipants),
    ],
    [
      summary.repeatTripParticipantRate,
      rate(summary.repeatTripParticipants, summary.activatedParticipants),
    ],
    [
      summary.manualEntryAbandonmentRate,
      rate(
        summary.manualEntriesAbandoned,
        summary.manualEntriesCompleted + summary.manualEntriesAbandoned,
      ),
    ],
    [
      summary.rememberedItemParticipantRate,
      rate(
        summary.rememberedItemParticipants,
        summary.activatedParticipants,
      ),
    ],
  ] as const;

  return expectedRates.every(
    ([actual, expected]) =>
      (actual === null || isRate(actual)) &&
      sameNullableRate(actual, expected),
  );
};

const sameWindowReadiness = (
  value: unknown,
  expected: RetentionBetaCohortReadiness["sevenDay"],
): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "eligibleParticipants",
      "minimumRequired",
      "ready",
    ]) &&
    Object.is(
      record.eligibleParticipants,
      expected.eligibleParticipants,
    ) &&
    Object.is(record.minimumRequired, expected.minimumRequired) &&
    Object.is(record.ready, expected.ready)
  );
};

const sameReadiness = (
  value: unknown,
  expected: RetentionBetaCohortReadiness,
): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "participantCount",
      "minimumParticipants",
      "targetMaximumParticipants",
      "participantStatus",
      "sevenDay",
      "fourteenDay",
      "thirtyDay",
    ]) &&
    Object.is(record.participantCount, expected.participantCount) &&
    Object.is(record.minimumParticipants, expected.minimumParticipants) &&
    Object.is(
      record.targetMaximumParticipants,
      expected.targetMaximumParticipants,
    ) &&
    Object.is(record.participantStatus, expected.participantStatus) &&
    sameWindowReadiness(record.sevenDay, expected.sevenDay) &&
    sameWindowReadiness(record.fourteenDay, expected.fourteenDay) &&
    sameWindowReadiness(record.thirtyDay, expected.thirtyDay)
  );
};

const isPrivacy = (
  value: unknown,
): value is RetentionCohortAggregateExport["privacy"] => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "containsRawParticipantEvents",
      "containsParticipantFileNames",
      "containsParticipantIdentifiers",
      "networkTransmission",
    ]) &&
    record.containsRawParticipantEvents === false &&
    record.containsParticipantFileNames === false &&
    record.containsParticipantIdentifiers === false &&
    record.networkTransmission === false
  );
};

export const buildRetentionCohortAggregateExport = (
  summary: RetentionBetaCohortSummary,
  sourceReportCount: number,
  sourceBuildRevision: string,
  analyzerBuildRevision: string,
  generatedAt: string,
): RetentionCohortAggregateExport => {
  if (
    !isRetentionCohortSummary(summary) ||
    !isCount(sourceReportCount) ||
    sourceReportCount === 0 ||
    sourceReportCount !== summary.participantCount ||
    !isImmutableEvidenceBuildRevision(sourceBuildRevision) ||
    !isImmutableEvidenceBuildRevision(analyzerBuildRevision) ||
    !isCanonicalIsoTimestamp(generatedAt)
  ) {
    throw new RangeError(
      "Retention cohort aggregate requires immutable validated field evidence",
    );
  }

  const readiness = summarizeRetentionBetaCohortReadiness(summary);

  return Object.freeze({
    schemaVersion: 3,
    kind: "retention-cohort-summary",
    sourceBuildRevision,
    analyzerBuildRevision,
    generatedAt,
    sourceReportCount,
    privacy: Object.freeze({
      containsRawParticipantEvents: false,
      containsParticipantFileNames: false,
      containsParticipantIdentifiers: false,
      networkTransmission: false,
    }),
    readiness,
    summary,
  });
};

export const parseRetentionCohortAggregateExport = (
  value: unknown,
): RetentionCohortAggregateExport | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !hasExactKeys(record, [
      "schemaVersion",
      "kind",
      "sourceBuildRevision",
      "analyzerBuildRevision",
      "generatedAt",
      "sourceReportCount",
      "privacy",
      "readiness",
      "summary",
    ]) ||
    record.schemaVersion !== 3 ||
    record.kind !== "retention-cohort-summary" ||
    !isImmutableEvidenceBuildRevision(record.sourceBuildRevision) ||
    !isImmutableEvidenceBuildRevision(record.analyzerBuildRevision) ||
    !isCanonicalIsoTimestamp(record.generatedAt) ||
    !isCount(record.sourceReportCount) ||
    record.sourceReportCount === 0 ||
    !isPrivacy(record.privacy) ||
    !isRetentionCohortSummary(record.summary)
  ) {
    return null;
  }

  const summary = record.summary;
  const expectedReadiness =
    summarizeRetentionBetaCohortReadiness(summary);

  if (
    record.sourceReportCount !== summary.participantCount ||
    !sameReadiness(record.readiness, expectedReadiness)
  ) {
    return null;
  }

  return Object.freeze({
    schemaVersion: 3,
    kind: "retention-cohort-summary",
    sourceBuildRevision: record.sourceBuildRevision,
    analyzerBuildRevision: record.analyzerBuildRevision,
    generatedAt: record.generatedAt,
    sourceReportCount: record.sourceReportCount,
    privacy: Object.freeze({
      containsRawParticipantEvents: false,
      containsParticipantFileNames: false,
      containsParticipantIdentifiers: false,
      networkTransmission: false,
    }),
    readiness: expectedReadiness,
    summary,
  });
};
