import { useEffect, useMemo, useRef, useState } from "react";

import {
  parseRetentionBetaExport,
  type RetentionBetaExport,
} from "./retention-beta";
import { summarizeRetentionBetaCohort } from "./retention-beta-cohort";
import styles from "./RetentionCohortAnalyzerApp.module.css";

interface ImportedReport {
  readonly fileName: string;
  readonly report: RetentionBetaExport;
}

interface ImportResult {
  readonly accepted: number;
  readonly replaced: number;
  readonly duplicateOrStale: number;
  readonly invalid: number;
}

const emptyImportResult = (): ImportResult => ({
  accepted: 0,
  replaced: 0,
  duplicateOrStale: 0,
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

    const bySession = new Map(
      reportsRef.current.map((entry) => [
        sessionKey(entry.report),
        entry,
      ]),
    );
    let accepted = 0;
    let replaced = 0;
    let duplicateOrStale = 0;

    for (const entry of parsed) {
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
      invalid,
    });
    setStatus(
      `Imported ${accepted}; replaced ${replaced}; ignored duplicate/stale ${duplicateOrStale}; invalid ${invalid}.`,
    );
  };

  const copySummary = async (): Promise<void> => {
    const payload = {
      schemaVersion: 1,
      kind: "retention-cohort-summary",
      generatedAt: new Date().toISOString(),
      sourceReportCount: reports.length,
      privacy: {
        containsRawParticipantEvents: false,
        containsParticipantFileNames: false,
        networkTransmission: false,
      },
      summary,
    };

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(payload, null, 2),
      );
      setStatus("Cohort summary copied without raw participant events.");
    } catch {
      setStatus("Copy failed. Imported reports remain only in this page memory.");
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
          <span>Invalid {lastImport.invalid}</span>
        </div>
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
            label="Second-trip rate"
            value={percent(summary.secondTripRate)}
          />
          <Metric
            label="Third-trip rate"
            value={percent(summary.thirdTripRate)}
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
          onClick={() => void copySummary()}
          disabled={reports.length === 0}
        >
          Copy aggregate summary
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={reset}
          disabled={reports.length === 0}
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
