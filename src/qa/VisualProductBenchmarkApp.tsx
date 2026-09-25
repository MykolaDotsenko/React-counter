import { useEffect, useMemo, useState } from "react";

import { VisualClipRecognizerSetup } from "./VisualClipRecognizerSetup";
import { VisualProductBenchmarkCapture } from "./VisualProductBenchmarkCapture";
import {
  VISUAL_PRODUCT_BENCHMARK_SAMPLE_LIMIT,
  appendVisualProductBenchmarkFailure,
  appendVisualProductBenchmarkSample,
  buildVisualProductBenchmarkExport,
  clearVisualProductBenchmarkSession,
  createVisualProductBenchmarkSession,
  loadVisualProductBenchmarkSession,
  persistVisualProductBenchmarkSession,
  sameVisualProductBenchmarkEnvironment,
  summarizeVisualProductBenchmark,
  updateVisualProductBenchmarkDeviceLabel,
  updateVisualProductBenchmarkSubjective,
  type VisualProductBenchmarkEffort,
  type VisualProductBenchmarkEnvironment,
  type VisualProductBenchmarkFailureType,
  type VisualProductBenchmarkPreference,
  type VisualProductBenchmarkSample,
  type VisualProductBenchmarkSession,
} from "./visual-product-benchmark";
import { captureVisualProductBenchmarkEnvironment } from "./visual-product-benchmark-adapter";
import styles from "./BarcodeBenchmarkApp.module.css";

const percent = (value: number | null): string =>
  value === null ? "—" : (value * 100).toFixed(1) + "%";

const seconds = (value: number | null): string =>
  value === null ? "—" : (value / 1_000).toFixed(2) + " s";

const evidenceFileName = (createdAt: string): string =>
  "visual-product-benchmark-" +
  createdAt.replace(/[-:.]/g, "") +
  ".json";

interface VisualProductBenchmarkBootstrap {
  readonly environment: VisualProductBenchmarkEnvironment;
  readonly session: VisualProductBenchmarkSession | null;
  readonly retainedEvidenceCorrupt: boolean;
  readonly status: string;
}

const createBootstrap = (): VisualProductBenchmarkBootstrap => {
  const environment = captureVisualProductBenchmarkEnvironment();
  const loaded = loadVisualProductBenchmarkSession(
    localStorage,
    environment,
    new Date().toISOString(),
  );

  if (loaded.status === "corrupt") {
    return {
      environment,
      session: null,
      retainedEvidenceCorrupt: true,
      status:
        "Retained visual benchmark evidence is malformed and has been left unchanged. Reset explicitly before collecting new evidence.",
    };
  }

  return {
    environment,
    session: loaded.session,
    retainedEvidenceCorrupt: false,
    status: environment.recognizerAvailable
      ? "Visual product benchmark harness is ready."
      : "Benchmark harness is ready, but no visual recognizer adapter is configured.",
  };
};

export function App() {
  const [bootstrap] = useState(createBootstrap);
  const [environment, setEnvironment] = useState(
    bootstrap.environment,
  );
  const [session, setSession] =
    useState<VisualProductBenchmarkSession | null>(
      bootstrap.session,
    );
  const [retainedEvidenceCorrupt, setRetainedEvidenceCorrupt] =
    useState(bootstrap.retainedEvidenceCorrupt);
  const [status, setStatus] = useState(bootstrap.status);
  const [attemptActive, setAttemptActive] = useState(false);

  const summary = useMemo(
    () =>
      session === null
        ? null
        : summarizeVisualProductBenchmark(session),
    [session],
  );

  const environmentChanged =
    session !== null &&
    !sameVisualProductBenchmarkEnvironment(
      session.environment,
      environment,
    );

  const sampleLimitReached =
    session !== null &&
    session.samples.length >=
      VISUAL_PRODUCT_BENCHMARK_SAMPLE_LIMIT;

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — Visual Product Benchmark";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }

    if (bootstrap.session !== null && !bootstrap.retainedEvidenceCorrupt) {
      try {
        persistVisualProductBenchmarkSession(
          localStorage,
          bootstrap.session,
        );
      } catch {
        // Evidence persistence is best-effort and must not break the harness.
      }
    }
  }, [bootstrap]);

  const updateSession = (
    updater: (
      current: VisualProductBenchmarkSession,
    ) => VisualProductBenchmarkSession,
  ): void => {
    setSession((current) => {
      if (current === null) {
        return null;
      }

      const next = updater(current);

      try {
        persistVisualProductBenchmarkSession(localStorage, next);
      } catch {
        setStatus(
          "Benchmark evidence could not be persisted. The current page still holds it in memory.",
        );
      }

      return next;
    });
  };

  const recordFailure = (
    type: VisualProductBenchmarkFailureType,
  ): void => {
    updateSession((current) =>
      current.failures.some((failure) => failure.type === type)
        ? current
        : appendVisualProductBenchmarkFailure(current, {
            type,
            at: new Date().toISOString(),
          }),
    );
  };

  const recordSample = (
    sample: VisualProductBenchmarkSample,
  ): void => {
    updateSession((current) =>
      appendVisualProductBenchmarkSample(current, sample),
    );
  };

  const resetSession = (): void => {
    const captured = captureVisualProductBenchmarkEnvironment();
    const fresh = createVisualProductBenchmarkSession(
      captured,
      new Date().toISOString(),
    );

    try {
      clearVisualProductBenchmarkSession(localStorage);
      persistVisualProductBenchmarkSession(localStorage, fresh);
    } catch {
      // The evidence harness remains usable in memory.
    }

    setEnvironment(captured);
    setSession(fresh);
    setRetainedEvidenceCorrupt(false);
    setAttemptActive(false);
    setStatus("Fresh visual product benchmark session started.");
  };

  const buildEvidencePayload = (): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (session === null) {
      return null;
    }

    try {
      const evidence = buildVisualProductBenchmarkExport(
        session,
        new Date().toISOString(),
      );

      return {
        json: JSON.stringify(evidence, null, 2),
        fileName: evidenceFileName(session.createdAt),
      };
    } catch {
      setStatus(
        "Benchmark export unavailable — check this device date and time, then try again.",
      );
      return null;
    }
  };

  const copyEvidence = async (): Promise<void> => {
    const payload = buildEvidencePayload();

    if (payload === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload.json);
      setStatus(
        "Visual benchmark evidence copied. Images and candidate labels are not included.",
      );
    } catch {
      setStatus(
        "Copy failed. Evidence remains stored only on this device.",
      );
    }
  };

  const downloadEvidence = (): void => {
    const payload = buildEvidencePayload();

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
        "Visual benchmark evidence downloaded as " + payload.fileName,
      );
    } catch {
      setStatus(
        "Download failed. Evidence remains stored only on this device; copy it instead.",
      );
    } finally {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  };

  if (retainedEvidenceCorrupt) {
    return (
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h1>Visual product recognition benchmark</h1>
          <p className={styles.lead}>
            Retained evidence is malformed. It has not been overwritten.
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={resetSession}>
              Reset malformed benchmark evidence
            </button>
          </div>
        </section>
        <p className={styles.status} role="status">
          {status}
        </p>
      </main>
    );
  }

  if (session === null || summary === null) {
    return (
      <main className={styles.page}>
        <p role="status">{status}</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Experimental evidence tool</p>
        <h1>Visual product recognition benchmark</h1>
        <p className={styles.lead}>
          Measure camera capture → ranked product candidates → human decision.
          This guarded route is not production recognition and never changes
          shopping state.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="visual-setup-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Benchmark setup</p>
            <h2 id="visual-setup-title">Recognition environment</h2>
          </div>
          <span className={styles.badge}>
            {environment.recognizerAvailable
              ? "Recognizer configured"
              : "Recognizer not configured"}
          </span>
        </div>

        <dl className={styles.capabilities}>
          <div>
            <dt>Camera API</dt>
            <dd>
              {environment.cameraSupported
                ? "Available"
                : "Unavailable"}
            </dd>
          </div>
          <div>
            <dt>Recognizer</dt>
            <dd>{environment.recognizerId ?? "None"}</dd>
          </div>
          <div>
            <dt>Image boundary</dt>
            <dd>{environment.dataBoundary ?? "Not applicable"}</dd>
          </div>
          <div>
            <dt>Viewport</dt>
            <dd>
              {environment.viewportWidth} × {environment.viewportHeight}
            </dd>
          </div>
        </dl>

        <label className={styles.field}>
          <span>Device / browser label</span>
          <input
            value={session.deviceLabel}
            maxLength={160}
            disabled={environmentChanged}
            placeholder="e.g. Pixel 8 · Chrome"
            onChange={(event) => {
              updateSession((current) =>
                updateVisualProductBenchmarkDeviceLabel(
                  current,
                  event.currentTarget.value,
                ),
              );
            }}
          />
        </label>

        <VisualClipRecognizerSetup
          disabled={attemptActive}
          onConfigured={() => {
            setEnvironment(
              captureVisualProductBenchmarkEnvironment(),
            );
          }}
          onStatus={setStatus}
        />

        {!environment.recognizerAvailable ? (
          <p className={styles.note}>
            Timed recognition remains disabled until a concrete recognizer is
            configured. Loading the experimental CLIP adapter changes the
            benchmark environment; start a fresh session before collecting
            evidence unless the retained session already has the exact same
            recognizer ID.
          </p>
        ) : null}
      </section>

      {environmentChanged ? (
        <section className={styles.card} aria-labelledby="visual-environment-change">
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h2 id="visual-environment-change">
            Benchmark environment changed
          </h2>
          <p className={styles.note}>
            Device, viewport, camera capability or recognizer contract no
            longer matches the retained session. Export it if needed, then
            start a fresh session.
          </p>
        </section>
      ) : sampleLimitReached ? (
        <section className={styles.card} aria-labelledby="visual-limit-title">
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h2 id="visual-limit-title">Benchmark sample limit reached</h2>
          <p className={styles.note}>
            Export this session unchanged, then start a fresh one instead of
            silently dropping earlier evidence.
          </p>
        </section>
      ) : (
        <VisualProductBenchmarkCapture
          key={session.createdAt}
          environment={environment}
          onFailure={recordFailure}
          onSample={recordSample}
          onStatus={setStatus}
          onAttemptActiveChange={setAttemptActive}
        />
      )}

      <section className={styles.card} aria-labelledby="visual-results-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Privacy-safe evidence</p>
            <h2 id="visual-results-title">Benchmark results</h2>
          </div>
          <span className={styles.badge}>
            {summary.attempts} attempts
          </span>
        </div>

        <div className={styles.metricGrid}>
          <Metric label="Top-1 accuracy" value={percent(summary.top1Accuracy)} />
          <Metric label="Top-3 accuracy" value={percent(summary.top3Accuracy)} />
          <Metric
            label="Decision median"
            value={seconds(summary.medianDecisionMs)}
          />
          <Metric
            label="Decision P90"
            value={seconds(summary.p90DecisionMs)}
          />
          <Metric
            label="Recognition failure"
            value={percent(summary.recognitionFailureRate)}
          />
          <Metric
            label="Correction rate"
            value={percent(summary.correctionRate)}
          />
          <Metric
            label="Manual fallback"
            value={percent(summary.fallbackRate)}
          />
          <Metric
            label="Permission denied"
            value={String(summary.permissionDenied)}
          />
        </div>

        <div className={styles.subjective}>
          <label className={styles.field}>
            <span>Preference after repeated use</span>
            <select
              value={session.preference ?? ""}
              disabled={environmentChanged}
              onChange={(event) => {
                const value = event.currentTarget.value;
                const preference: VisualProductBenchmarkPreference | null =
                  value === "visual" ||
                  value === "manual" ||
                  value === "same"
                    ? value
                    : null;

                updateSession((current) =>
                  updateVisualProductBenchmarkSubjective(
                    current,
                    preference,
                    current.effort,
                  ),
                );
              }}
            >
              <option value="">Not recorded</option>
              <option value="visual">Visual recognition</option>
              <option value="manual">Manual entry</option>
              <option value="same">No preference</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Cognitive effort after repeated use</span>
            <select
              value={session.effort ?? ""}
              disabled={environmentChanged}
              onChange={(event) => {
                const parsed = Number(event.currentTarget.value);
                const effort: VisualProductBenchmarkEffort | null =
                  parsed >= 1 && parsed <= 5
                    ? (parsed as VisualProductBenchmarkEffort)
                    : null;

                updateSession((current) =>
                  updateVisualProductBenchmarkSubjective(
                    current,
                    current.preference,
                    effort,
                  ),
                );
              }}
            >
              <option value="">Not recorded</option>
              <option value="1">1 · very low</option>
              <option value="2">2 · low</option>
              <option value="3">3 · moderate</option>
              <option value="4">4 · high</option>
              <option value="5">5 · very high</option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={downloadEvidence}
            disabled={attemptActive}
          >
            Download visual benchmark JSON
          </button>
          <button
            type="button"
            onClick={() => void copyEvidence()}
            disabled={attemptActive}
          >
            Copy privacy-safe visual benchmark JSON
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={resetSession}
            disabled={attemptActive}
          >
            Start fresh benchmark session
          </button>
        </div>

        <p className={styles.privacy}>
          Export contains timings, ranked-candidate outcomes and technical
          environment metadata. It contains no image bytes, candidate labels,
          item names, prices, budgets, store identity or location.
        </p>
      </section>

      <p className={styles.status} role="status">
        {status}
      </p>
    </main>
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
