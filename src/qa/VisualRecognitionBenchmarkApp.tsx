import { useEffect, useMemo, useState } from "react";

import { VisualRecognitionBenchmarkCamera } from "./VisualRecognitionBenchmarkCamera";
import {
  VISUAL_RECOGNITION_SAMPLE_LIMIT,
  appendVisualRecognitionFailure,
  appendVisualRecognitionSample,
  buildVisualRecognitionExport,
  captureVisualRecognitionEnvironment,
  createVisualRecognitionSession,
  loadVisualRecognitionSession,
  persistVisualRecognitionSession,
  sameVisualRecognitionEnvironment,
  summarizeVisualRecognition,
  updateVisualRecognitionDeviceLabel,
  updateVisualRecognitionModelLoad,
  updateVisualRecognitionSubjective,
  type VisualRecognitionEffort,
  type VisualRecognitionEnvironment,
  type VisualRecognitionFailureType,
  type VisualRecognitionPreference,
  type VisualRecognitionSample,
  type VisualRecognitionSession,
} from "./visual-recognition-benchmark";
import { validateVisualCandidateLabels } from "./visual-recognition-local";
import styles from "./BarcodeBenchmarkApp.module.css";
import visualStyles from "./VisualRecognitionBenchmarkApp.module.css";

const percent = (value: number | null): string =>
  value === null ? "—" : (value * 100).toFixed(1) + "%";

const seconds = (value: number | null): string =>
  value === null ? "—" : (value / 1_000).toFixed(2) + " s";

const evidenceFileName = (createdAt: string): string =>
  "visual-recognition-benchmark-" +
  createdAt.replace(/[-:.]/g, "") +
  ".json";

const parseCandidateText = (
  value: string,
): readonly string[] | null => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  try {
    return validateVisualCandidateLabels(lines);
  } catch {
    return null;
  }
};

export function App() {
  const [environment, setEnvironment] =
    useState<VisualRecognitionEnvironment | null>(null);
  const [session, setSession] =
    useState<VisualRecognitionSession | null>(null);
  const [status, setStatus] = useState(
    "Preparing visual benchmark environment…",
  );
  const [attemptActive, setAttemptActive] = useState(false);
  const [candidateText, setCandidateText] = useState("");
  const [expectedLabel, setExpectedLabel] = useState("");

  const candidateLabels = useMemo(
    () => parseCandidateText(candidateText),
    [candidateText],
  );
  const summary = useMemo(
    () =>
      session === null
        ? null
        : summarizeVisualRecognition(session),
    [session],
  );
  const environmentChanged =
    session !== null &&
    environment !== null &&
    !sameVisualRecognitionEnvironment(
      session.environment,
      environment,
    );
  const sampleLimitReached =
    session !== null &&
    session.samples.length >= VISUAL_RECOGNITION_SAMPLE_LIMIT;

  const updateSession = (
    updater: (
      current: VisualRecognitionSession,
    ) => VisualRecognitionSession,
  ): void => {
    setSession((current) => {
      if (current === null) {
        return null;
      }

      const next = updater(current);

      try {
        persistVisualRecognitionSession(localStorage, next);
      } catch {
        // Evidence durability failure must never affect product state.
      }

      return next;
    });
  };

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — Visual Recognition Benchmark";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }

    const captured = captureVisualRecognitionEnvironment();
    const restored = loadVisualRecognitionSession(
      localStorage,
      captured,
      new Date().toISOString(),
    );

    setEnvironment(captured);
    setSession(restored);
    setStatus(
      captured.cameraSupported
        ? "Visual recognition benchmark is ready to configure."
        : "Camera API is unavailable on this browser/device.",
    );
  }, []);

  useEffect(() => {
    if (
      candidateLabels !== null &&
      !candidateLabels.includes(expectedLabel)
    ) {
      setExpectedLabel(candidateLabels[0] ?? "");
    }

    if (candidateLabels === null && expectedLabel !== "") {
      setExpectedLabel("");
    }
  }, [candidateLabels, expectedLabel]);

  const recordFailure = (
    type: VisualRecognitionFailureType,
  ): void => {
    updateSession((current) =>
      current.failures.some((failure) => failure.type === type)
        ? current
        : appendVisualRecognitionFailure(current, {
            type,
            at: new Date().toISOString(),
          }),
    );
  };

  const recordSample = (
    sample: VisualRecognitionSample,
  ): void => {
    updateSession((current) =>
      appendVisualRecognitionSample(current, sample),
    );
  };

  const recordModelLoad = (durationMs: number): void => {
    updateSession((current) =>
      current.modelLoadDurationMs === null
        ? updateVisualRecognitionModelLoad(current, durationMs)
        : current,
    );
  };

  const resetSession = (): void => {
    const captured = captureVisualRecognitionEnvironment();
    const fresh = createVisualRecognitionSession(
      captured,
      new Date().toISOString(),
    );

    setEnvironment(captured);
    setSession(fresh);
    setAttemptActive(false);
    setCandidateText("");
    setExpectedLabel("");

    try {
      persistVisualRecognitionSession(localStorage, fresh);
    } catch {
      // Benchmark remains usable in memory.
    }

    setStatus("Fresh visual recognition benchmark session started.");
  };

  const buildEvidencePayload = (): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (session === null) {
      return null;
    }

    try {
      const evidence = buildVisualRecognitionExport(
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
        "Privacy-safe visual benchmark evidence copied. Product labels and images are not included.",
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

  if (session === null || environment === null || summary === null) {
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
          Test whether a local zero-shot vision model can distinguish a
          controlled set of retail product packages quickly enough to justify
          future production work. This route never changes shopping state.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="visual-setup-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Controlled candidate set</p>
            <h2 id="visual-setup-title">Benchmark setup</h2>
          </div>
          <span className={styles.badge}>
            {environment.cameraSupported
              ? "Camera available"
              : "Camera unavailable"}
          </span>
        </div>

        <dl className={styles.capabilities}>
          <div>
            <dt>Inference baseline</dt>
            <dd>Local WASM · q8</dd>
          </div>
          <div>
            <dt>WebGPU capability</dt>
            <dd>{environment.webGpuSupported ? "Detected" : "Not detected"}</dd>
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
                updateVisualRecognitionDeviceLabel(
                  current,
                  event.currentTarget.value,
                ),
              );
            }}
          />
        </label>

        <label className={styles.field + " " + visualStyles.candidateField}>
          <span>Candidate product labels · one per line · 2–20</span>
          <textarea
            value={candidateText}
            maxLength={2_400}
            disabled={environmentChanged || attemptActive}
            placeholder={"Fazer Sininen 200 g\nFazer Tumma 200 g\nFazer Geisha 121 g"}
            onChange={(event) => setCandidateText(event.currentTarget.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Expected product for the next attempt</span>
          <select
            value={expectedLabel}
            disabled={
              environmentChanged ||
              attemptActive ||
              candidateLabels === null
            }
            onChange={(event) => setExpectedLabel(event.currentTarget.value)}
          >
            {candidateLabels === null ? (
              <option value="">Enter a valid candidate set first</option>
            ) : (
              candidateLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))
            )}
          </select>
        </label>

        <p className={styles.note}>
          Candidate labels exist only in page memory. They are intentionally
          not restored after reload and never enter local evidence or exports.
        </p>
      </section>

      {environmentChanged ? (
        <section className={styles.card} aria-labelledby="visual-environment-change-title">
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h2 id="visual-environment-change-title">
            Benchmark environment changed
          </h2>
          <p className={styles.note}>
            Export the retained evidence if needed, then start a fresh session
            before adding samples from this changed browser, viewport or
            capability environment.
          </p>
        </section>
      ) : sampleLimitReached ? (
        <section className={styles.card} aria-labelledby="visual-sample-limit-title">
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h2 id="visual-sample-limit-title">
            Benchmark sample limit reached
          </h2>
          <p className={styles.note}>
            Export this session unchanged, then start a fresh session instead
            of silently dropping earlier samples.
          </p>
        </section>
      ) : (
        <VisualRecognitionBenchmarkCamera
          key={session.createdAt}
          environment={environment}
          candidateLabels={candidateLabels ?? []}
          expectedLabel={expectedLabel}
          onFailure={recordFailure}
          onModelLoad={recordModelLoad}
          onSample={recordSample}
          onStatus={setStatus}
          onAttemptActiveChange={setAttemptActive}
        />
      )}

      <section className={styles.card} aria-labelledby="visual-results-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Privacy-safe local evidence</p>
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
            label="Correction rate"
            value={percent(summary.correctionRate)}
          />
          <Metric
            label="Recognition failure"
            value={percent(summary.recognitionFailureRate)}
          />
          <Metric
            label="Manual fallback"
            value={percent(summary.fallbackRate)}
          />
          <Metric
            label="Median decision"
            value={seconds(summary.medianDecisionMs)}
          />
          <Metric
            label="P75 decision"
            value={seconds(summary.p75DecisionMs)}
          />
          <Metric
            label="P90 decision"
            value={seconds(summary.p90DecisionMs)}
          />
          <Metric
            label="Model load"
            value={seconds(summary.modelLoadDurationMs)}
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
                const preference: VisualRecognitionPreference | null =
                  value === "visual" ||
                  value === "manual" ||
                  value === "same"
                    ? value
                    : null;

                updateSession((current) =>
                  updateVisualRecognitionSubjective(
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
                const effort: VisualRecognitionEffort | null =
                  parsed >= 1 && parsed <= 5
                    ? (parsed as VisualRecognitionEffort)
                    : null;

                updateSession((current) =>
                  updateVisualRecognitionSubjective(
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
          Export contains device metadata, model identity, ranks, scores,
          timings and aggregate rates. It contains no image, product label,
          product name, price, store identity or location. Network access is
          used only to download/cache model assets when needed.
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
