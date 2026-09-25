import { useEffect, useMemo, useState } from "react";

import { ShelfLabelOcrBenchmarkCapture } from "./ShelfLabelOcrBenchmarkCapture";
import {
  SHELF_LABEL_OCR_SAMPLE_LIMIT,
  appendShelfLabelOcrFailure,
  appendShelfLabelOcrSample,
  buildShelfLabelOcrExport,
  clearShelfLabelOcrSession,
  createShelfLabelOcrSession,
  loadShelfLabelOcrSession,
  persistShelfLabelOcrSession,
  sameShelfLabelOcrEnvironment,
  summarizeShelfLabelOcr,
  updateShelfLabelOcrDeviceLabel,
  updateShelfLabelOcrSubjective,
  type ShelfLabelOcrEffort,
  type ShelfLabelOcrEnvironment,
  type ShelfLabelOcrFailureType,
  type ShelfLabelOcrPreference,
  type ShelfLabelOcrSample,
  type ShelfLabelOcrSession,
} from "./shelf-label-ocr-benchmark";
import { captureShelfLabelOcrEnvironment } from "./shelf-label-ocr-adapter";
import styles from "./BarcodeBenchmarkApp.module.css";
import { evidenceStorage } from "./evidence-storage";

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const seconds = (value: number | null): string =>
  value === null ? "—" : `${(value / 1_000).toFixed(2)} s`;

const evidenceFileName = (createdAt: string): string =>
  `shelf-label-ocr-benchmark-${createdAt.replace(/[-:.]/g, "")}.json`;

interface ShelfLabelOcrBootstrap {
  readonly environment: ShelfLabelOcrEnvironment;
  readonly session: ShelfLabelOcrSession | null;
  readonly retainedEvidenceCorrupt: boolean;
  readonly status: string;
}

const createBootstrap = (): ShelfLabelOcrBootstrap => {
  const environment = captureShelfLabelOcrEnvironment();
  const loaded = loadShelfLabelOcrSession(
    evidenceStorage(),
    environment,
    new Date().toISOString(),
  );

  if (loaded.status === "corrupt") {
    return {
      environment,
      session: null,
      retainedEvidenceCorrupt: true,
      status:
        "Retained OCR benchmark evidence is malformed and has been left unchanged. Reset explicitly before collecting new evidence.",
    };
  }

  return {
    environment,
    session: loaded.session,
    retainedEvidenceCorrupt: false,
    status: environment.ocrAvailable
      ? "Shelf-label OCR benchmark harness is ready."
      : "Benchmark harness is ready, but no OCR engine adapter is configured.",
  };
};

export function App() {
  const [bootstrap] = useState(createBootstrap);
  const [environment, setEnvironment] = useState(
    bootstrap.environment,
  );
  const [session, setSession] =
    useState<ShelfLabelOcrSession | null>(bootstrap.session);
  const [retainedEvidenceCorrupt, setRetainedEvidenceCorrupt] =
    useState(bootstrap.retainedEvidenceCorrupt);
  const [status, setStatus] = useState(bootstrap.status);
  const [attemptActive, setAttemptActive] = useState(false);

  const summary = useMemo(
    () =>
      session === null
        ? null
        : summarizeShelfLabelOcr(session),
    [session],
  );

  const environmentChanged =
    session !== null &&
    !sameShelfLabelOcrEnvironment(
      session.environment,
      environment,
    );

  const sampleLimitReached =
    session !== null &&
    session.samples.length >= SHELF_LABEL_OCR_SAMPLE_LIMIT;

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — Shelf-label OCR Benchmark";

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
        persistShelfLabelOcrSession(
          evidenceStorage(),
          bootstrap.session,
        );
      } catch {
        // Evidence persistence is best-effort and must not break the harness.
      }
    }
  }, [bootstrap]);

  const updateSession = (
    updater: (
      current: ShelfLabelOcrSession,
    ) => ShelfLabelOcrSession,
  ): void => {
    setSession((current) => {
      if (current === null) {
        return null;
      }

      const next = updater(current);

      try {
        persistShelfLabelOcrSession(evidenceStorage(), next);
      } catch {
        setStatus(
          "OCR benchmark evidence could not be persisted. The current page still holds it in memory.",
        );
      }

      return next;
    });
  };

  const recordFailure = (type: ShelfLabelOcrFailureType): void => {
    updateSession((current) =>
      current.failures.some((failure) => failure.type === type)
        ? current
        : appendShelfLabelOcrFailure(current, {
            type,
            at: new Date().toISOString(),
          }),
    );
  };

  const recordSample = (sample: ShelfLabelOcrSample): void => {
    updateSession((current) =>
      appendShelfLabelOcrSample(current, sample),
    );
  };

  const resetSession = (): void => {
    const captured = captureShelfLabelOcrEnvironment();
    const fresh = createShelfLabelOcrSession(
      captured,
      new Date().toISOString(),
    );

    try {
      clearShelfLabelOcrSession(evidenceStorage());
      persistShelfLabelOcrSession(evidenceStorage(), fresh);
    } catch {
      // The benchmark remains usable in memory.
    }

    setEnvironment(captured);
    setSession(fresh);
    setRetainedEvidenceCorrupt(false);
    setAttemptActive(false);
    setStatus("Fresh shelf-label OCR benchmark session started.");
  };

  const buildEvidencePayload = (): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (session === null) {
      return null;
    }

    try {
      const evidence = buildShelfLabelOcrExport(
        session,
        new Date().toISOString(),
      );

      return {
        json: JSON.stringify(evidence, null, 2),
        fileName: evidenceFileName(session.createdAt),
      };
    } catch {
      setStatus(
        "OCR benchmark export unavailable — check this device date and time, then try again.",
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
        "OCR benchmark evidence copied. Raw text, images and prices are not included.",
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
        `OCR benchmark evidence downloaded as ${payload.fileName}`,
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
          <h1>Shelf-label OCR benchmark</h1>
          <p className={styles.lead}>
            Retained evidence is malformed. It has not been overwritten.
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={resetSession}>
              Reset malformed OCR benchmark evidence
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
        <h1>Shelf-label OCR benchmark</h1>
        <p className={styles.lead}>
          Measure camera capture → OCR → deterministic exact-money price
          candidates → human decision. This route never changes shopping
          state and never treats OCR output as authoritative money.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="ocr-setup-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Benchmark setup</p>
            <h2 id="ocr-setup-title">OCR environment</h2>
          </div>
          <span className={styles.badge}>
            {environment.ocrAvailable
              ? "OCR configured"
              : "OCR not configured"}
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
            <dt>OCR engine</dt>
            <dd>{environment.engineId ?? "None"}</dd>
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
                updateShelfLabelOcrDeviceLabel(
                  current,
                  event.currentTarget.value,
                ),
              );
            }}
          />
        </label>

        {!environment.ocrAvailable ? (
          <p className={styles.note}>
            No OCR engine is bundled deliberately. A benchmark adapter must
            declare its engine identity and whether image bytes remain local
            or cross a network boundary before timed evidence can be collected.
          </p>
        ) : null}
      </section>

      {environmentChanged ? (
        <section className={styles.card} aria-labelledby="ocr-environment-change">
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h2 id="ocr-environment-change">
            Benchmark environment changed
          </h2>
          <p className={styles.note}>
            Device, viewport, camera capability or OCR engine contract no
            longer matches the retained session. Export it if needed, then
            start a fresh session.
          </p>
        </section>
      ) : sampleLimitReached ? (
        <section className={styles.card} aria-labelledby="ocr-limit-title">
          <p className={styles.eyebrow}>Evidence integrity</p>
          <h2 id="ocr-limit-title">Benchmark sample limit reached</h2>
          <p className={styles.note}>
            Export this session unchanged, then start a fresh one instead of
            silently dropping earlier evidence.
          </p>
        </section>
      ) : (
        <ShelfLabelOcrBenchmarkCapture
          key={session.createdAt}
          environment={environment}
          onFailure={recordFailure}
          onSample={recordSample}
          onStatus={setStatus}
          onAttemptActiveChange={setAttemptActive}
        />
      )}

      <section className={styles.card} aria-labelledby="ocr-results-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Privacy-safe evidence</p>
            <h2 id="ocr-results-title">Benchmark results</h2>
          </div>
          <span className={styles.badge}>
            {summary.attempts} attempts
          </span>
        </div>

        <div className={styles.metricGrid}>
          <Metric
            label="Top-1 correct"
            value={percent(summary.top1CorrectRate)}
          />
          <Metric
            label="Top-3 correct"
            value={percent(summary.top3CorrectRate)}
          />
          <Metric
            label="Median confirmed"
            value={seconds(summary.medianConfirmedMs)}
          />
          <Metric
            label="P90 confirmed"
            value={seconds(summary.p90ConfirmedMs)}
          />
          <Metric
            label="OCR/parser failure"
            value={percent(summary.failureRate)}
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
                const preference: ShelfLabelOcrPreference | null =
                  value === "ocr" ||
                  value === "manual" ||
                  value === "same"
                    ? value
                    : null;

                updateSession((current) =>
                  updateShelfLabelOcrSubjective(
                    current,
                    preference,
                    current.effort,
                  ),
                );
              }}
            >
              <option value="">Not recorded</option>
              <option value="ocr">OCR</option>
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
                const effort: ShelfLabelOcrEffort | null =
                  parsed >= 1 && parsed <= 5
                    ? (parsed as ShelfLabelOcrEffort)
                    : null;

                updateSession((current) =>
                  updateShelfLabelOcrSubjective(
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
            Download OCR benchmark JSON
          </button>
          <button
            type="button"
            onClick={() => void copyEvidence()}
            disabled={attemptActive}
          >
            Copy privacy-safe OCR benchmark JSON
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={resetSession}
            disabled={attemptActive}
          >
            Start fresh OCR benchmark session
          </button>
        </div>

        <p className={styles.privacy}>
          Export contains timing/rank outcomes and technical environment
          metadata. It contains no camera image, raw OCR text, price, item
          name, budget, store identity or location.
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
