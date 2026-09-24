import { useEffect, useMemo, useRef, useState } from "react";

import {
  EVIDENCE_BUILD_REVISION,
  isImmutableEvidenceBuildRevision,
} from "./evidence-build";
import {
  buildRetentionCohortAggregateExport,
} from "./retention-cohort-export";
import {
  parseRetentionBetaExport,
  type RetentionBetaExport,
} from "./retention-beta";
import {
  summarizeRetentionBetaCohort,
  summarizeRetentionBetaCohortReadiness,
  type RetentionBetaCohortSummary,
  type RetentionWindowReadiness,
} from "./retention-beta-cohort";
import styles from "./RetentionCohortAnalyzerApp.module.css";

interface ImportedReport {
  readonly fileName: string;
  readonly report: RetentionBetaExport;
}

interface ImportResult {
  readonly accepted: number;
  readonly replaced: number;
  readonly duplicateOrStale: number;
  readonly revisionMismatch: number;
  readonly invalid: number;
}

const emptyImportResult = (): ImportResult => ({
  accepted: 0,
  replaced: 0,
  duplicateOrStale: 0,
  revisionMismatch: 0,
  invalid: 0,
});

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const seconds = (value: number | null): string =>
  value === null ? "—" : `${(value / 1_000).toFixed(2)} s`;

const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000;

const sessionKey = (report: RetentionBetaExport): string =>
  `${report.session.variant}:${report.session.createdAt}`;

const observationEndIsPlausible = (
  report: RetentionBetaExport,
  nowMs: number,
): boolean =>
  Date.parse(report.generatedAt) <=
  nowMs + MAX_FUTURE_CLOCK_SKEW_MS;

const aggregateFileName = (generatedAt: string): string =>
  `retention-cohort-summary-${generatedAt.replace(/[-:.]/g, "")}.json`;

export function App() {
  const [reports, setReports] = useState<readonly ImportedReport[]>([]);
  const reportsRef = useRef<readonly ImportedReport[]>([]);
  const [lastImport, setLastImport] = useState<ImportResult>(
    emptyImportResult,
  );
  const [status, setStatus] = useState("");

  const summary = useMemo(
    () =>
      summarizeRetentionBetaCohort(
        reports.map(({ report }) => report),
      ),
    [reports],
  );
  const readiness = useMemo(
    () => summarizeRetentionBetaCohortReadiness(summary),
    [summary],
  );
  const sourceBuildRevision =
    reports[0]?.report.buildRevision ?? null;
  const fieldAggregateReady =
    sourceBuildRevision !== null &&
    isImmutableEvidenceBuildRevision(sourceBuildRevision) &&
    isImmutableEvidenceBuildRevision(EVIDENCE_BUILD_REVISION);

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — Retention Cohort Analyzer";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }
  }, []);

  const importFiles = async (files: FileList | null): Promise<void> => {
    if (files === null || files.length === 0) {
      return;
    }

    const parsed: ImportedReport[] = [];
    let invalid = 0;

    for (const file of Array.from(files)) {
      try {
        const raw: unknown = JSON.parse(await file.text());
        const report = parseRetentionBetaExport(raw);

        if (
          report === null ||
          !observationEndIsPlausible(report, Date.now())
        ) {
          invalid += 1;
          continue;
        }

        parsed.push({
          fileName: file.name,
          report,
        });
      } catch {
        invalid += 1;
      }
    }

    const existingBuildRevision =
      reportsRef.current[0]?.report.buildRevision ?? null;
    let revisionMismatch = 0;
    let compatible = parsed;

    if (existingBuildRevision !== null) {
      compatible = parsed.filter((entry) => {
        if (entry.report.buildRevision === existingBuildRevision) {
          return true;
        }

        revisionMismatch += 1;
        return false;
      });
    } else {
      const revisions = new Set(
        parsed.map((entry) => entry.report.buildRevision),
      );

      if (revisions.size > 1) {
        revisionMismatch = parsed.length;
        compatible = [];
      }
    }

    const bySession = new Map(
      reportsRef.current.map((entry) => [
        sessionKey(entry.report),
        entry,
      ]),
    );
    let accepted = 0;
    let replaced = 0;
    let duplicateOrStale = 0;

    for (const entry of compatible) {
      const key = sessionKey(entry.report);
      const existing = bySession.get(key);

      if (existing === undefined) {
        bySession.set(key, entry);
        accepted += 1;
        continue;
      }

      if (
        Date.parse(entry.report.generatedAt) >
        Date.parse(existing.report.generatedAt)
      ) {
        bySession.set(key, entry);
        replaced += 1;
      } else {
        duplicateOrStale += 1;
      }
    }

    const nextReports = [...bySession.values()].sort(
      (left, right) =>
        Date.parse(left.report.session.createdAt) -
        Date.parse(right.report.session.createdAt),
    );

    reportsRef.current = nextReports;
    setReports(nextReports);
    setLastImport({
      accepted,
      replaced,
      duplicateOrStale,
      revisionMismatch,
      invalid,
    });
    setStatus(
      `Imported ${accepted}; replaced ${replaced}; ignored duplicate/stale ${duplicateOrStale}; revision mismatch ${revisionMismatch}; invalid ${invalid}.`,
    );
  };

  const aggregateJson = (
    generatedAt: string,
  ): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (
      sourceBuildRevision === null ||
      !fieldAggregateReady
    ) {
      setStatus(
        "Field aggregate export requires full immutable Git SHA revisions for both source evidence and this analyzer build.",
      );
      return null;
    }

    try {
      return {
        json: JSON.stringify(
          buildRetentionCohortAggregateExport(
            summary,
            reports.length,
            sourceBuildRevision,
            EVIDENCE_BUILD_REVISION,
            generatedAt,
          ),
          null,
          2,
        ),
        fileName: aggregateFileName(generatedAt),
      };
    } catch {
      setStatus(
        "Field aggregate export failed validation. Preserve the source reports and review the cohort evidence.",
      );
      return null;
    }
  };

  const copySummary = async (): Promise<void> => {
    const payload = aggregateJson(new Date().toISOString());

    if (payload === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload.json);
      setStatus("Cohort summary copied without raw participant events.");
    } catch {
      setStatus("Copy failed. Imported reports remain only in this page memory.");
    }
  };

  const downloadSummary = (): void => {
    const payload = aggregateJson(new Date().toISOString());

    if (payload === null) {
      return;
    }

    let objectUrl: string | null = null;

    try {
      const blob = new Blob([payload.json], {
        type: "application/json",
      });
      objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = payload.fileName;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();

      setStatus(
        `Aggregate summary downloaded as ${payload.fileName}`,
      );
    } catch {
      setStatus(
        "Download failed. Imported reports remain only in this page memory; copy the aggregate instead.",
      );
    } finally {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  };

  const reset = (): void => {
    reportsRef.current = [];
    setReports([]);
    setLastImport(emptyImportResult());
    setStatus("Cohort analysis cleared from page memory.");
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="cohort-title">
        <p className={styles.eyebrow}>Internal facilitator tool</p>
        <h1 id="cohort-title">Retention cohort analyzer</h1>
        <p className={styles.lead}>
          Import privacy-safe beta JSON exports locally. Files are validated
          and summarized in this browser only; nothing is uploaded.
        </p>
      </section>

      <section className={styles.importCard} aria-labelledby="import-title">
        <div>
          <h2 id="import-title">Import participant exports</h2>
          <p>
            Use one retained beta session per participant. A newer export from
            the same session replaces an older one. External study IDs belong
            in filenames, not inside evidence JSON.
          </p>
        </div>
        <label className={styles.filePicker}>
          <span>Select JSON exports</span>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            onChange={(event) => {
              const files = event.currentTarget.files;
              void importFiles(files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className={styles.importStats} aria-live="polite">
          <span>Accepted {lastImport.accepted}</span>
          <span>Replaced {lastImport.replaced}</span>
          <span>Duplicate/stale {lastImport.duplicateOrStale}</span>
          <span>Revision mismatch {lastImport.revisionMismatch}</span>
          <span>Invalid {lastImport.invalid}</span>
          <span>
            Field export {fieldAggregateReady ? "ready" : "not immutable"}
          </span>
        </div>
      </section>

      <section
        className={styles.readiness}
        aria-labelledby="readiness-title"
      >
        <div className={styles.readinessHeader}>
          <div>
            <p className={styles.eyebrow}>Decision guard</p>
            <h2 id="readiness-title">Cohort interpretation readiness</h2>
          </div>
          <span className={styles.target}>
            Minimum 20 real shoppers
          </span>
        </div>

        <p className={styles.readinessLead}>
          Do not interpret a time-window retention rate until that window
          has at least 20 eligible real participants. Participants still
          inside an observation window are right-censored, not failures.
        </p>

        <div className={styles.readinessGrid}>
          <ReadinessItem
            label="Cohort size"
            current={readiness.participantCount}
            minimum={readiness.minimumParticipants}
            state={
              readiness.participantStatus === "collecting"
                ? "Collect more"
                : readiness.participantStatus === "target-range"
                  ? "Target range reached"
                  : "Above target range"
            }
            ready={readiness.participantStatus !== "collecting"}
          />
          <WindowReadiness
            label="7-day evidence"
            readiness={readiness.sevenDay}
          />
          <WindowReadiness
            label="14-day evidence"
            readiness={readiness.fourteenDay}
          />
          <WindowReadiness
            label="30-day evidence"
            readiness={readiness.thirtyDay}
          />
        </div>

        <p className={styles.readinessNote}>
          Observed second- and third-trip shares describe behaviour seen so
          far across activated participants. Use maturity-aware 7/14/30-day
          rates for time-bounded retention decisions.
        </p>
      </section>

      <section className={styles.summary} aria-labelledby="summary-title">
        <div className={styles.summaryHeader}>
          <div>
            <p className={styles.eyebrow}>Validated cohort</p>
            <h2 id="summary-title">
              {summary.participantCount} participant
              {summary.participantCount === 1 ? "" : "s"}
            </h2>
          </div>
          <span className={styles.target}>
            Target cohort 20–50 real shoppers
          </span>
        </div>

        <div className={styles.metricGrid}>
          <Metric
            label="Activated"
            value={String(summary.activatedParticipants)}
          />
          <Metric
            label="Observed second-trip share"
            value={percent(summary.secondTripRate)}
            detail="All activated · not time-normalized"
          />
          <Metric
            label="Observed third-trip share"
            value={percent(summary.thirdTripRate)}
            detail="All activated · not time-normalized"
          />
          <Metric
            label="Trip completion"
            value={percent(summary.tripCompletionRate)}
          />
          <Metric
            label="7-day retention"
            value={percent(summary.secondTripWithin7DaysRate)}
            detail={`${summary.secondTripWithin7DaysEligibleParticipants} eligible`}
          />
          <Metric
            label="14-day retention"
            value={percent(summary.secondTripWithin14DaysRate)}
            detail={`${summary.secondTripWithin14DaysEligibleParticipants} eligible`}
          />
          <Metric
            label="30-day retention"
            value={percent(summary.secondTripWithin30DaysRate)}
            detail={`${summary.secondTripWithin30DaysEligibleParticipants} eligible`}
          />
          <Metric
            label="Manual abandonment"
            value={percent(summary.manualEntryAbandonmentRate)}
          />
          <Metric
            label="Median manual entry"
            value={seconds(summary.medianManualEntryMs)}
          />
          <Metric
            label="Remembered-item reach"
            value={percent(summary.rememberedItemParticipantRate)}
          />
          <Metric
            label="Repeat-trip users"
            value={percent(summary.repeatTripParticipantRate)}
          />
          <Metric
            label="Current-price overrides"
            value={String(summary.currentPriceOverrides)}
          />
        </div>
      </section>

      <section className={styles.integrity} aria-labelledby="integrity-title">
        <h2 id="integrity-title">Evidence boundaries</h2>
        <ul>
          <li>
            Invalid, tampered, or implausibly future-dated exports never enter
            the cohort.
          </li>
          <li>
            One in-memory cohort accepts exactly one source build revision;
            mixed deploy versions are rejected instead of silently combined.
          </li>
          <li>
            Field aggregate export requires immutable 40-character Git SHA
            revisions for both the source cohort and analyzer build. Local
            development revisions remain inspectable but cannot produce field
            aggregate evidence.
          </li>
          <li>
            7/14/30-day denominators exclude right-censored participants.
          </li>
          <li>
            Second/third-trip retention requires contiguous chronological
            trip starts.
          </li>
          <li>
            Same-session re-exports are replaced by the newest observation;
            participant identity deduplication still belongs to the external
            study log.
          </li>
          <li>Imported JSON is held only in page memory.</li>
        </ul>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={downloadSummary}
          disabled={reports.length === 0 || !fieldAggregateReady}
        >
          Download aggregate summary
        </button>
        <button
          type="button"
          onClick={() => void copySummary()}
          disabled={reports.length === 0 || !fieldAggregateReady}
        >
          Copy aggregate summary
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={reset}
          disabled={reports.length === 0 || !fieldAggregateReady}
        >
          Clear analysis
        </button>
      </div>

      {status ? (
        <p className={styles.status} role="status">
          {status}
        </p>
      ) : null}
    </main>
  );
}


interface ReadinessItemProps {
  readonly label: string;
  readonly current: number;
  readonly minimum: number;
  readonly state: string;
  readonly ready: boolean;
}

function ReadinessItem({
  label,
  current,
  minimum,
  state,
  ready,
}: ReadinessItemProps) {
  return (
    <article className={styles.readinessItem}>
      <span>{label}</span>
      <strong>
        {current} / {minimum}
      </strong>
      <small data-ready={ready ? "true" : "false"}>{state}</small>
    </article>
  );
}

interface WindowReadinessProps {
  readonly label: string;
  readonly readiness: RetentionWindowReadiness;
}

function WindowReadiness({
  label,
  readiness,
}: WindowReadinessProps) {
  return (
    <ReadinessItem
      label={label}
      current={readiness.eligibleParticipants}
      minimum={readiness.minimumRequired}
      state={readiness.ready ? "Ready to interpret" : "Wait / collect"}
      ready={readiness.ready}
    />
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

function Metric({ label, value, detail }: MetricProps) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail === undefined ? null : <small>{detail}</small>}
    </article>
  );
}
