import { describe, expect, it } from "vitest";

import {
  buildRetentionCohortAggregateExport,
  parseRetentionCohortAggregateExport,
} from "../src/qa/retention-cohort-export";
import {
  summarizeRetentionBetaCohort,
} from "../src/qa/retention-beta-cohort";
import {
  appendRetentionBetaEvent,
  buildRetentionBetaExport,
  createRetentionBetaSession,
  type RetentionBetaEvent,
  type RetentionBetaExport,
} from "../src/qa/retention-beta";

const SOURCE_SHA =
  "0123456789abcdef0123456789abcdef01234567";
const ANALYZER_SHA =
  "89abcdef0123456789abcdef0123456789abcdef";

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

const participant = (): RetentionBetaExport => {
  let session = createRetentionBetaSession(
    "2026-09-01T08:00:00.000Z",
  );

  session = appendRetentionBetaEvent(
    session,
    at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
      source: "new",
    }),
  );
  session = appendRetentionBetaEvent(
    session,
    at("trip_finished", 1, "2026-09-01T09:00:00.000Z"),
  );
  session = appendRetentionBetaEvent(
    session,
    at("trip_started", 2, "2026-09-05T08:00:00.000Z", {
      source: "repeat",
    }),
  );

  return {
    ...buildRetentionBetaExport(
      session,
      "2026-09-10T08:00:00.000Z",
    ),
    buildRevision: SOURCE_SHA,
  };
};

describe("retention cohort aggregate evidence", () => {
  it("builds a privacy-safe immutable aggregate with explicit readiness", () => {
    const summary = summarizeRetentionBetaCohort([participant()]);
    const aggregate = buildRetentionCohortAggregateExport(
      summary,
      1,
      SOURCE_SHA,
      ANALYZER_SHA,
      "2026-09-10T09:00:00.000Z",
    );

    expect(aggregate).toMatchObject({
      schemaVersion: 3,
      kind: "retention-cohort-summary",
      sourceBuildRevision: SOURCE_SHA,
      analyzerBuildRevision: ANALYZER_SHA,
      sourceReportCount: 1,
      privacy: {
        containsRawParticipantEvents: false,
        containsParticipantFileNames: false,
        containsParticipantIdentifiers: false,
        networkTransmission: false,
      },
      readiness: {
        participantCount: 1,
        minimumParticipants: 20,
      },
      summary: {
        participantCount: 1,
        activatedParticipants: 1,
        secondTripParticipants: 1,
      },
    });

    const serialized = JSON.stringify(aggregate);
    expect(serialized).not.toContain('"events"');
    expect(serialized).not.toContain("P001");
  });

  it("round-trips a valid aggregate through the runtime parser", () => {
    const summary = summarizeRetentionBetaCohort([participant()]);
    const aggregate = buildRetentionCohortAggregateExport(
      summary,
      1,
      SOURCE_SHA,
      ANALYZER_SHA,
      "2026-09-10T09:00:00.000Z",
    );

    expect(parseRetentionCohortAggregateExport(aggregate)).toEqual(
      aggregate,
    );
  });

  it("rejects local-dev revisions for field aggregate evidence", () => {
    const summary = summarizeRetentionBetaCohort([participant()]);

    expect(() =>
      buildRetentionCohortAggregateExport(
        summary,
        1,
        "local-dev",
        ANALYZER_SHA,
        "2026-09-10T09:00:00.000Z",
      ),
    ).toThrow(/immutable validated field evidence/i);
  });

  it("rejects an empty field aggregate", () => {
    const summary = summarizeRetentionBetaCohort([]);

    expect(() =>
      buildRetentionCohortAggregateExport(
        summary,
        0,
        SOURCE_SHA,
        ANALYZER_SHA,
        "2026-09-10T09:00:00.000Z",
      ),
    ).toThrow(/immutable validated field evidence/i);
  });

  it("rejects tampered derived rates", () => {
    const summary = summarizeRetentionBetaCohort([participant()]);
    const aggregate = buildRetentionCohortAggregateExport(
      summary,
      1,
      SOURCE_SHA,
      ANALYZER_SHA,
      "2026-09-10T09:00:00.000Z",
    );
    const tampered = {
      ...aggregate,
      summary: {
        ...aggregate.summary,
        secondTripRate: 0.25,
      },
    };

    expect(parseRetentionCohortAggregateExport(tampered)).toBeNull();
  });

  it("rejects tampered readiness", () => {
    const summary = summarizeRetentionBetaCohort([participant()]);
    const aggregate = buildRetentionCohortAggregateExport(
      summary,
      1,
      SOURCE_SHA,
      ANALYZER_SHA,
      "2026-09-10T09:00:00.000Z",
    );
    const tampered = {
      ...aggregate,
      readiness: {
        ...aggregate.readiness,
        sevenDay: {
          ...aggregate.readiness.sevenDay,
          ready: true,
        },
      },
    };

    expect(parseRetentionCohortAggregateExport(tampered)).toBeNull();
  });

  it("rejects source-report count mismatch", () => {
    const summary = summarizeRetentionBetaCohort([participant()]);
    const aggregate = buildRetentionCohortAggregateExport(
      summary,
      1,
      SOURCE_SHA,
      ANALYZER_SHA,
      "2026-09-10T09:00:00.000Z",
    );

    expect(
      parseRetentionCohortAggregateExport({
        ...aggregate,
        sourceReportCount: 2,
      }),
    ).toBeNull();
  });
});
