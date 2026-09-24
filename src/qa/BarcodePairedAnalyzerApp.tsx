import { useEffect, useMemo, useState } from "react";

import {
  analyzeBarcodePairedEvidence,
  buildBarcodePairedAnalysisExport,
  type BarcodePairedAnalysisSummary,
  type PairedTimingComparison,
  type PairedTimingStats,
} from "./barcode-paired-analysis";
import styles from "./RetentionCohortAnalyzerApp.module.css";

const MAX_IMPORT_BYTES = 2_000_000;

const seconds = (value: number | null): string =>
  value === null ? "—" : `${(value / 1_000).toFixed(2)} s`;

const signedSeconds = (value: number | null): string => {
  if (value === null) {
    return "—";
  }

  const secondsValue = value / 1_000;
  const prefix = secondsValue > 0 ? "+" : "";

  return `${prefix}${secondsValue.toFixed(2)} s`;
};

const ratio = (value: number | null): string =>
  value === null ? "—" : `${value.toFixed(2)}×`;

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const summaryFileName = (generatedAt: string): string =>
  `barcode-paired-analysis-${generatedAt.replace(/[-:.]/g, "")}.json`;

const readJsonFile = async (file: File): Promise<unknown> => {
  if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
    throw new RangeError("Evidence file size is invalid.");
  }

  return JSON.parse(await file.text()) as unknown;
};

export function App() {
  const [manualValue, setManualValue] = useState<unknown | null>(null);
  const [barcodeValue, setBarcodeValue] = useState<unknown | null>(null);
  const [manualLoaded, setManualLoaded] = useState(false);
  const [barcodeLoaded, setBarcodeLoaded] = useState(false);
  const [status, setStatus] = useState("");

  const summary = useMemo<BarcodePairedAnalysisSummary | null>(
    () =>
      manualLoaded && barcodeLoaded
        ? analyzeBarcodePairedEvidence(manualValue, barcodeValue)
        : null,
    [manualLoaded, barcodeLoaded, manualValue, barcodeValue],
  );

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — Barcode Paired Analyzer";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }
  }, []);

  const loadManual = async (file: File | undefined): Promise<void> => {
    if (file === undefined) {
      return;
    }

    try {
      setManualValue(await readJsonFile(file));
      setManualLoaded(true);
      setStatus("Manual timing evidence loaded into page memory.");
    } catch {
      setManualValue(null);
      setManualLoaded(true);
      setStatus("Manual timing evidence could not be parsed.");
    }
  };

  const loadBarcode = async (file: File | undefined): Promise<void> => {
    if (file === undefined) {
      return;
    }

    try {
      setBarcodeValue(await readJsonFile(file));
      setBarcodeLoaded(true);
      setStatus("Barcode benchmark evidence loaded into page memory.");
    } catch {
      setBarcodeValue(null);
      setBarcodeLoaded(true);
      setStatus("Barcode benchmark evidence could not be parsed.");
    }
  };

  const buildExportPayload = (): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (summary === null || summary.readiness !== "ready") {
      setStatus(
        "Aggregate export is available only when paired evidence is ready and compatible.",
      );
      return null;
    }

    const generatedAt = new Date().toISOString();

    try {
      const exported = buildBarcodePairedAnalysisExport(
        summary,
        generatedAt,
      );

      return {
        json: JSON.stringify(exported, null, 2),
        fileName: summaryFileName(generatedAt),
      };
    } catch {
      setStatus("Aggregate export could not be created.");
      return null;
    }
  };

  const downloadSummary = (): void => {
    const payload = buildExportPayload();

    if (payload === null) {
      return;
    }

    let objectUrl: string | null = null;

    try {
      objectUrl = URL.createObjectURL(
        new Blob([payload.json], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = payload.fileName;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setStatus(
        "Paired aggregate downloaded without raw samples, barcodes, prices or filenames.",
      );
    } catch {
      setStatus("Aggregate download failed.");
    } finally {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  };

  const copySummary = async (): Promise<void> => {
    const payload = buildExportPayload();

    if (payload === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload.json);
      setStatus(
        "Paired aggregate copied without raw samples, barcodes, prices or filenames.",
      );
    } catch {
      setStatus("Aggregate copy failed.");
    }
  };

  const clear = (): void => {
    setManualValue(null);
    setBarcodeValue(null);
    setManualLoaded(false);
    setBarcodeLoaded(false);
    setStatus("Paired analysis cleared from page memory.");
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="paired-title">
        <p className={styles.eyebrow}>Internal facilitator tool</p>
        <h1 id="paired-title">Barcode paired evidence analyzer</h1>
        <p className={styles.lead}>
          Import one structured manual-timing export and one barcode benchmark
          export. The files stay in this browser page memory. The analyzer
          validates both sources, checks same-build/device context and reports
          descriptive timing differences without choosing a product decision.
        </p>
      </section>

      <section className={styles.importCard} aria-labelledby="paired-import-title">
        <div>
          <h2 id="paired-import-title">Import paired evidence</h2>
          <p>
            Use the same physical phone, browser, viewport, build revision and
            documented manual input method. Do not edit either JSON export.
          </p>
        </div>

        <div className={styles.actions}>
          <label className={styles.filePicker}>
            <span>
              {manualLoaded ? "Replace manual JSON" : "Select manual JSON"}
            </span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                void loadManual(file);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <label className={styles.filePicker}>
            <span>
              {barcodeLoaded ? "Replace barcode JSON" : "Select barcode JSON"}
            </span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                void loadBarcode(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        <div className={styles.importStats} aria-live="polite">
          <span>Manual {manualLoaded ? "loaded" : "missing"}</span>
          <span>Barcode {barcodeLoaded ? "loaded" : "missing"}</span>
          <span>
            Analysis {summary === null ? "waiting" : summary.readiness}
          </span>
        </div>
      </section>

      {summary === null ? (
        <section className={styles.readiness} aria-labelledby="waiting-title">
          <p className={styles.eyebrow}>Decision guard</p>
          <h2 id="waiting-title">Two evidence exports required</h2>
          <p className={styles.readinessLead}>
            Nothing is compared until both exports are loaded.
          </p>
        </section>
      ) : (
        <>
          <Readiness summary={summary} />

          <section className={styles.summary} aria-labelledby="paired-summary-title">
            <div className={styles.summaryHeader}>
              <div>
                <p className={styles.eyebrow}>Descriptive comparison</p>
                <h2 id="paired-summary-title">End-to-end timing</h2>
              </div>
              <span className={styles.target}>
                {summary.sourceBuildRevision === null
                  ? "Build mismatch"
                  : `Build ${summary.sourceBuildRevision.slice(0, 12)}…`}
              </span>
            </div>

            <div className={styles.metricGrid}>
              <Metric
                label="Manual €4.79 median"
                value={seconds(summary.manual479.medianMs)}
                detail={`${summary.manual479.count} valid samples`}
              />
              <Metric
                label="Manual €12.50 median"
                value={seconds(summary.manual1250.medianMs)}
                detail={`${summary.manual1250.count} valid samples`}
              />
              <Metric
                label="Barcode median"
                value={seconds(summary.barcode?.medianConfirmedMs ?? null)}
                detail={`${summary.barcode?.confirmed ?? 0} confirmed`}
              />
              <Metric
                label="Barcode P90"
                value={seconds(summary.barcode?.p90ConfirmedMs ?? null)}
              />
              <Metric
                label="Recognition failure"
                value={percent(summary.barcode?.recognitionFailureRate ?? null)}
              />
              <Metric
                label="Correction"
                value={percent(summary.barcode?.correctionRate ?? null)}
              />
              <Metric
                label="Fallback"
                value={percent(summary.barcode?.fallbackRate ?? null)}
              />
              <Metric
                label="Preference"
                value={summary.barcode?.preference ?? "—"}
                detail={
                  summary.barcode?.effort === null ||
                  summary.barcode?.effort === undefined
                    ? "Effort not recorded"
                    : `Effort ${summary.barcode.effort}/5`
                }
              />
            </div>
          </section>

          <ComparisonSection
            title="Barcode vs manual €4.79 fixture"
            manual={summary.manual479}
            comparison={summary.versus479}
          />
          <ComparisonSection
            title="Barcode vs manual €12.50 fixture"
            manual={summary.manual1250}
            comparison={summary.versus1250}
          />

          <section className={styles.integrity} aria-labelledby="paired-boundaries-title">
            <h2 id="paired-boundaries-title">Interpretation boundaries</h2>
            <ul>
              <li>
                Negative timing delta means the confirmed barcode interaction
                was faster than that manual fixture; positive means slower.
              </li>
              <li>
                Timing alone does not authorize production barcode. Failure,
                correction, fallback, permission friction, preference and
                cognitive effort remain part of issue #73.
              </li>
              <li>
                The analyzer never compares detector-only latency with manual
                entry; barcode evidence is scan → human decision.
              </li>
              <li>
                Imported files stay in page memory and are never uploaded or
                written to localStorage.
              </li>
              <li>
                The aggregate export contains no raw samples, barcode values,
                prices, device labels or source filenames.
              </li>
              <li>
                PROMOTE / REMEDIATE / DEFER remains an explicit human decision
                recorded against the preserved source evidence.
              </li>
            </ul>
          </section>
        </>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={downloadSummary}
          disabled={summary?.readiness !== "ready"}
        >
          Download paired aggregate
        </button>
        <button
          type="button"
          onClick={() => void copySummary()}
          disabled={summary?.readiness !== "ready"}
        >
          Copy paired aggregate
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={clear}
          disabled={!manualLoaded && !barcodeLoaded}
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

function Readiness({
  summary,
}: {
  readonly summary: BarcodePairedAnalysisSummary;
}) {
  const ready = summary.readiness === "ready";

  return (
    <section className={styles.readiness} aria-labelledby="paired-readiness-title">
      <div className={styles.readinessHeader}>
        <div>
          <p className={styles.eyebrow}>Decision guard</p>
          <h2 id="paired-readiness-title">
            {ready ? "Evidence ready for human decision" : "Evidence not ready"}
          </h2>
        </div>
        <span className={styles.target}>{summary.readiness}</span>
      </div>

      <div className={styles.readinessGrid}>
        <ReadinessItem
          label="Full Git SHA"
          ready={summary.compatibility.fullGitBuildRevision}
        />
        <ReadinessItem
          label="Same build"
          ready={summary.compatibility.sameBuildRevision}
        />
        <ReadinessItem
          label="Same browser"
          ready={summary.compatibility.sameUserAgent}
        />
        <ReadinessItem
          label="Same viewport"
          ready={summary.compatibility.sameViewport}
        />
        <ReadinessItem
          label="Same device label"
          ready={summary.compatibility.sameDeviceLabel}
        />
        <ReadinessItem
          label="Manual fixtures"
          ready={summary.compatibility.manualFixtureEvidenceComplete}
        />
        <ReadinessItem
          label="Barcode confirmed"
          ready={summary.compatibility.barcodeConfirmedEvidenceComplete}
        />
        <ReadinessItem
          label="Preference"
          ready={summary.compatibility.barcodePreferenceRecorded}
        />
        <ReadinessItem
          label="Effort"
          ready={summary.compatibility.barcodeEffortRecorded}
        />
      </div>

      {summary.issues.length === 0 ? (
        <p className={styles.readinessNote}>
          Structural evidence requirements are satisfied. Review the measured
          differences and source context before recording the issue #73
          product decision.
        </p>
      ) : (
        <ul>
          {summary.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReadinessItem({
  label,
  ready,
}: {
  readonly label: string;
  readonly ready: boolean;
}) {
  return (
    <article className={styles.readinessItem}>
      <span>{label}</span>
      <strong>{ready ? "Pass" : "Check"}</strong>
      <small data-ready={ready ? "true" : "false"}>
        {ready ? "Compatible" : "Needs attention"}
      </small>
    </article>
  );
}

function ComparisonSection({
  title,
  manual,
  comparison,
}: {
  readonly title: string;
  readonly manual: PairedTimingStats;
  readonly comparison: PairedTimingComparison;
}) {
  return (
    <section className={styles.summary} aria-label={title}>
      <div className={styles.summaryHeader}>
        <h2>{title}</h2>
        <span className={styles.target}>
          Manual n={manual.count}
        </span>
      </div>

      <div className={styles.metricGrid}>
        <Metric
          label="Median delta"
          value={signedSeconds(comparison.medianDeltaMs)}
          detail={ratio(comparison.medianRatio)}
        />
        <Metric
          label="P75 delta"
          value={signedSeconds(comparison.p75DeltaMs)}
          detail={ratio(comparison.p75Ratio)}
        />
        <Metric
          label="P90 delta"
          value={signedSeconds(comparison.p90DeltaMs)}
          detail={ratio(comparison.p90Ratio)}
        />
        <Metric
          label="Manual P90"
          value={seconds(manual.p90Ms)}
          detail={`Max ${seconds(manual.maxMs)}`}
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail === undefined ? null : <small>{detail}</small>}
    </article>
  );
}
