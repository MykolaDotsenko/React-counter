import { useEffect, useMemo, useState } from "react";

import {
  analyzeOcrPairedEvidence,
  buildOcrPairedAnalysisExport,
  type OcrPairedAnalysisSummary,
  type OcrPairedTimingComparison,
  type OcrPairedTimingStats,
} from "./ocr-paired-analysis";
import {
  EVIDENCE_BUILD_REVISION,
  isImmutableEvidenceBuildRevision,
} from "./evidence-build";
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
  `ocr-paired-analysis-${generatedAt.replace(/[-:.]/g, "")}.json`;

const readJsonFile = async (file: File): Promise<unknown> => {
  if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
    throw new RangeError("Evidence file size is invalid.");
  }

  return JSON.parse(await file.text()) as unknown;
};

export function App() {
  const [manualValue, setManualValue] = useState<unknown | null>(null);
  const [ocrValue, setOcrValue] = useState<unknown | null>(null);
  const [manualLoaded, setManualLoaded] = useState(false);
  const [ocrLoaded, setOcrLoaded] = useState(false);
  const [status, setStatus] = useState("");

  const summary = useMemo<OcrPairedAnalysisSummary | null>(
    () =>
      manualLoaded && ocrLoaded
        ? analyzeOcrPairedEvidence(manualValue, ocrValue)
        : null,
    [manualLoaded, ocrLoaded, manualValue, ocrValue],
  );

  const fieldExportReady =
    summary?.readiness === "ready" &&
    isImmutableEvidenceBuildRevision(EVIDENCE_BUILD_REVISION);

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — OCR Paired Analyzer";

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

  const loadOcr = async (file: File | undefined): Promise<void> => {
    if (file === undefined) {
      return;
    }

    try {
      setOcrValue(await readJsonFile(file));
      setOcrLoaded(true);
      setStatus("OCR benchmark evidence loaded into page memory.");
    } catch {
      setOcrValue(null);
      setOcrLoaded(true);
      setStatus("OCR benchmark evidence could not be parsed.");
    }
  };

  const buildExportPayload = (): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (summary === null || !fieldExportReady) {
      setStatus(
        "Aggregate export requires ready paired evidence and an immutable stamped analyzer build.",
      );
      return null;
    }

    const generatedAt = new Date().toISOString();

    try {
      const exported = buildOcrPairedAnalysisExport(
        summary,
        generatedAt,
      );

      return {
        json: JSON.stringify(exported, null, 2),
        fileName: summaryFileName(generatedAt),
      };
    } catch {
      setStatus("OCR paired aggregate could not be created.");
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
        "OCR paired aggregate downloaded without raw samples, images, OCR text, prices, device labels or filenames.",
      );
    } catch {
      setStatus("OCR paired aggregate download failed.");
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
        "OCR paired aggregate copied without raw source evidence.",
      );
    } catch {
      setStatus("OCR paired aggregate copy failed.");
    }
  };

  const clear = (): void => {
    setManualValue(null);
    setOcrValue(null);
    setManualLoaded(false);
    setOcrLoaded(false);
    setStatus("OCR paired analysis cleared from page memory.");
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="ocr-paired-title">
        <p className={styles.eyebrow}>Internal facilitator tool</p>
        <h1 id="ocr-paired-title">OCR paired evidence analyzer</h1>
        <p className={styles.lead}>
          Import one structured manual-timing export and one shelf-label OCR
          benchmark export from the same physical phone/build context. The
          files stay in page memory. This tool validates compatibility and
          reports descriptive evidence without choosing the product decision.
        </p>
      </section>

      <section className={styles.importCard} aria-labelledby="ocr-paired-import-title">
        <div>
          <h2 id="ocr-paired-import-title">Import paired evidence</h2>
          <p>
            Use unchanged JSON from the same Git build, phone, browser,
            viewport and documented manual input method.
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
            <span>{ocrLoaded ? "Replace OCR JSON" : "Select OCR JSON"}</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                void loadOcr(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        <div className={styles.importStats} aria-live="polite">
          <span>Manual {manualLoaded ? "loaded" : "missing"}</span>
          <span>OCR {ocrLoaded ? "loaded" : "missing"}</span>
          <span>
            Analysis {summary === null ? "waiting" : summary.readiness}
          </span>
          <span>
            Field export {fieldExportReady ? "ready" : "not ready"}
          </span>
        </div>
      </section>

      {summary === null ? (
        <section className={styles.readiness} aria-labelledby="ocr-waiting-title">
          <p className={styles.eyebrow}>Decision guard</p>
          <h2 id="ocr-waiting-title">Two evidence exports required</h2>
          <p className={styles.readinessLead}>
            Nothing is compared until both authoritative exports are loaded.
          </p>
        </section>
      ) : (
        <>
          <Readiness summary={summary} />

          <section className={styles.summary} aria-labelledby="ocr-summary-title">
            <div className={styles.summaryHeader}>
              <div>
                <p className={styles.eyebrow}>Descriptive comparison</p>
                <h2 id="ocr-summary-title">OCR interaction evidence</h2>
              </div>
              <span className={styles.target}>
                {summary.sourceBuildRevision === null
                  ? "Build mismatch"
                  : `Build ${summary.sourceBuildRevision.slice(0, 12)}…`}
              </span>
            </div>

            <div className={styles.metricGrid}>
              <Metric
                label="Manual low fixture median"
                value={seconds(summary.manualLowFixture.medianMs)}
                detail={`${summary.manualLowFixture.count} valid samples`}
              />
              <Metric
                label="Manual high fixture median"
                value={seconds(summary.manualHighFixture.medianMs)}
                detail={`${summary.manualHighFixture.count} valid samples`}
              />
              <Metric
                label="OCR decision median"
                value={seconds(summary.ocr?.medianDecisionMs ?? null)}
                detail={`${summary.ocr?.attempts ?? 0} timed attempts`}
              />
              <Metric
                label="OCR decision P90"
                value={seconds(summary.ocr?.p90DecisionMs ?? null)}
              />
              <Metric
                label="Top-1 correct"
                value={percent(summary.ocr?.top1CorrectRate ?? null)}
              />
              <Metric
                label="Top-3 correct"
                value={percent(summary.ocr?.top3CorrectRate ?? null)}
              />
              <Metric
                label="OCR/parser failure"
                value={percent(summary.ocr?.failureRate ?? null)}
              />
              <Metric
                label="Correction"
                value={percent(summary.ocr?.correctionRate ?? null)}
              />
              <Metric
                label="Fallback"
                value={percent(summary.ocr?.fallbackRate ?? null)}
              />
              <Metric
                label="Preference"
                value={summary.ocr?.preference ?? "—"}
                detail={
                  summary.ocr?.effort === null ||
                  summary.ocr?.effort === undefined
                    ? "Effort not recorded"
                    : `Effort ${summary.ocr.effort}/5`
                }
              />
            </div>

            <p>
              Engine: <strong>{summary.ocrEngineId ?? "—"}</strong>
              {" · "}
              boundary: <strong>{summary.ocrDataBoundary ?? "—"}</strong>
            </p>
          </section>

          <ComparisonSection
            title="OCR vs manual low-price reference fixture"
            manual={summary.manualLowFixture}
            comparison={summary.versusLowFixture}
          />
          <ComparisonSection
            title="OCR vs manual high-price reference fixture"
            manual={summary.manualHighFixture}
            comparison={summary.versusHighFixture}
          />

          <section className={styles.integrity} aria-labelledby="ocr-boundaries-title">
            <h2 id="ocr-boundaries-title">Interpretation boundaries</h2>
            <ul>
              <li>
                Negative timing delta means OCR confirmation was faster than
                that manual reference fixture; positive means slower.
              </li>
              <li>
                Manual fixtures are interaction-time references, not claims
                that OCR labels contain the same price values.
              </li>
              <li>
                Timing alone cannot authorize production OCR. Accuracy,
                no-candidate/error, correction, fallback, preference and
                cognitive effort remain part of issue #90.
              </li>
              <li>
                Imported files remain page-memory only and are never uploaded
                or persisted by this analyzer.
              </li>
              <li>
                Aggregate output contains no raw samples, images, OCR text,
                shopping prices, device labels or source filenames.
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
          disabled={!fieldExportReady}
        >
          Download OCR paired aggregate
        </button>
        <button
          type="button"
          onClick={() => void copySummary()}
          disabled={!fieldExportReady}
        >
          Copy OCR paired aggregate
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={clear}
          disabled={!manualLoaded && !ocrLoaded}
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
  readonly summary: OcrPairedAnalysisSummary;
}) {
  const ready = summary.readiness === "ready";

  return (
    <section className={styles.readiness} aria-labelledby="ocr-readiness-title">
      <div className={styles.readinessHeader}>
        <div>
          <p className={styles.eyebrow}>Decision guard</p>
          <h2 id="ocr-readiness-title">
            {ready ? "Evidence structurally ready" : "Evidence not ready"}
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
          label="OCR engine"
          ready={summary.compatibility.ocrEnginePresent}
        />
        <ReadinessItem
          label="OCR attempts"
          ready={summary.compatibility.ocrAttemptEvidenceComplete}
        />
        <ReadinessItem
          label="OCR decisions"
          ready={summary.compatibility.ocrDecisionEvidenceComplete}
        />
        <ReadinessItem
          label="Preference"
          ready={summary.compatibility.ocrPreferenceRecorded}
        />
        <ReadinessItem
          label="Effort"
          ready={summary.compatibility.ocrEffortRecorded}
        />
      </div>

      {summary.issues.length === 0 ? (
        <p className={styles.readinessNote}>
          Structural evidence requirements are satisfied. Review source
          context and all measured costs before recording issue #90 decision.
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
  readonly manual: OcrPairedTimingStats;
  readonly comparison: OcrPairedTimingComparison;
}) {
  return (
    <section className={styles.summary} aria-label={title}>
      <div className={styles.summaryHeader}>
        <h2>{title}</h2>
        <span className={styles.target}>Manual n={manual.count}</span>
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
