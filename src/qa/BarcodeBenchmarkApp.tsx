import { useEffect, useMemo, useState } from "react";

import { BarcodeBenchmarkCamera } from "./BarcodeBenchmarkCamera";
import {
  appendBarcodeBenchmarkFailure,
  appendBarcodeBenchmarkSample,
  buildBarcodeBenchmarkExport,
  createBarcodeBenchmarkSession,
  loadBarcodeBenchmarkSession,
  persistBarcodeBenchmarkSession,
  summarizeBarcodeBenchmark,
  updateBarcodeBenchmarkDeviceLabel,
  updateBarcodeBenchmarkSubjective,
  type BarcodeBenchmarkEffort,
  type BarcodeBenchmarkEnvironment,
  type BarcodeBenchmarkFailureType,
  type BarcodeBenchmarkPreference,
  type BarcodeBenchmarkSample,
  type BarcodeBenchmarkSession,
} from "./barcode-benchmark";
import { captureBarcodeBenchmarkEnvironment } from "./barcode-benchmark-native";
import styles from "./BarcodeBenchmarkApp.module.css";

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const seconds = (value: number | null): string =>
  value === null ? "—" : `${(value / 1_000).toFixed(2)} s`;

export function App() {
  const [environment, setEnvironment] =
    useState<BarcodeBenchmarkEnvironment | null>(null);
  const [session, setSession] =
    useState<BarcodeBenchmarkSession | null>(null);
  const [status, setStatus] = useState(
    "Preparing benchmark environment…",
  );

  const summary = useMemo(
    () =>
      session === null
        ? null
        : summarizeBarcodeBenchmark(session),
    [session],
  );

  const updateSession = (
    updater: (
      current: BarcodeBenchmarkSession,
    ) => BarcodeBenchmarkSession,
  ): void => {
    setSession((current) => {
      if (current === null) {
        return null;
      }

      const next = updater(current);

      try {
        persistBarcodeBenchmarkSession(localStorage, next);
      } catch {
        // Benchmark evidence failure must never affect the product.
      }

      return next;
    });
  };

  useEffect(() => {
    document.title =
      "Shopping Budget Companion — Barcode Benchmark";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }

    let cancelled = false;

    void captureBarcodeBenchmarkEnvironment().then((captured) => {
      if (cancelled) {
        return;
      }

      setEnvironment(captured);

      const restored = loadBarcodeBenchmarkSession(
        localStorage,
        captured,
        new Date().toISOString(),
      );
      setSession(restored);
      setStatus(
        captured.detectorSupported && captured.cameraSupported
          ? "Native barcode benchmark is ready."
          : "Native barcode scanning is unavailable on this browser/device.",
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const recordFailure = (
    type: BarcodeBenchmarkFailureType,
  ): void => {
    updateSession((current) =>
      appendBarcodeBenchmarkFailure(current, {
        type,
        at: new Date().toISOString(),
      }),
    );
  };

  const recordSample = (
    sample: BarcodeBenchmarkSample,
  ): void => {
    updateSession((current) =>
      appendBarcodeBenchmarkSample(current, sample),
    );
  };

  const resetSession = async (): Promise<void> => {
    const captured = await captureBarcodeBenchmarkEnvironment();
    const fresh = createBarcodeBenchmarkSession(
      captured,
      new Date().toISOString(),
    );

    setEnvironment(captured);
    setSession(fresh);

    try {
      persistBarcodeBenchmarkSession(localStorage, fresh);
    } catch {
      // The benchmark remains usable in memory.
    }

    setStatus("Fresh barcode benchmark session started.");
  };

  const copyEvidence = async (): Promise<void> => {
    if (session === null) {
      return;
    }

    const evidence = buildBarcodeBenchmarkExport(
      session,
      new Date().toISOString(),
    );

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(evidence, null, 2),
      );
      setStatus(
        "Benchmark evidence copied. Raw barcode values are not included.",
      );
    } catch {
      setStatus(
        "Copy failed. Evidence remains stored only on this device.",
      );
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
        <h1>Barcode interaction benchmark</h1>
        <p className={styles.lead}>
          Measure whether native camera barcode capture actually beats manual
          price entry. This route is not a production scanner and never
          changes shopping state.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="device-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Device capability</p>
            <h2 id="device-title">Benchmark setup</h2>
          </div>
          <span className={styles.badge}>
            {environment.detectorSupported
              ? "Detector available"
              : "Detector unavailable"}
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
            <dt>Viewport</dt>
            <dd>
              {environment.viewportWidth} × {environment.viewportHeight}
            </dd>
          </div>
          <div>
            <dt>Formats</dt>
            <dd>
              {environment.supportedFormats.length > 0
                ? environment.supportedFormats.join(", ")
                : "Not reported"}
            </dd>
          </div>
        </dl>

        <label className={styles.field}>
          <span>Device / browser label</span>
          <input
            value={session.deviceLabel}
            maxLength={160}
            placeholder="e.g. Pixel 8 · Chrome"
            onChange={(event) => {
              updateSession((current) =>
                updateBarcodeBenchmarkDeviceLabel(
                  current,
                  event.currentTarget.value,
                ),
              );
            }}
          />
        </label>
      </section>

      <BarcodeBenchmarkCamera
        key={session.createdAt}
        environment={environment}
        onFailure={recordFailure}
        onSample={recordSample}
        onStatus={setStatus}
      />

      <section className={styles.card} aria-labelledby="results-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Local evidence</p>
            <h2 id="results-title">Benchmark results</h2>
          </div>
          <span className={styles.badge}>
            {summary.attempts} attempts
          </span>
        </div>

        <div className={styles.metricGrid}>
          <Metric label="Confirmed" value={String(summary.confirmed)} />
          <Metric
            label="Median confirmed"
            value={seconds(summary.medianConfirmedMs)}
          />
          <Metric
            label="P75 confirmed"
            value={seconds(summary.p75ConfirmedMs)}
          />
          <Metric
            label="P90 confirmed"
            value={seconds(summary.p90ConfirmedMs)}
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
              onChange={(event) => {
                const value = event.currentTarget.value;
                const preference: BarcodeBenchmarkPreference | null =
                  value === "scanner" ||
                  value === "manual" ||
                  value === "same"
                    ? value
                    : null;

                updateSession((current) =>
                  updateBarcodeBenchmarkSubjective(
                    current,
                    preference,
                    current.effort,
                  ),
                );
              }}
            >
              <option value="">Not recorded</option>
              <option value="scanner">Scanner</option>
              <option value="manual">Manual entry</option>
              <option value="same">No preference</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Cognitive effort after repeated use</span>
            <select
              value={session.effort ?? ""}
              onChange={(event) => {
                const parsed = Number(event.currentTarget.value);
                const effort: BarcodeBenchmarkEffort | null =
                  parsed >= 1 && parsed <= 5
                    ? (parsed as BarcodeBenchmarkEffort)
                    : null;

                updateSession((current) =>
                  updateBarcodeBenchmarkSubjective(
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
          <button type="button" onClick={() => void copyEvidence()}>
            Copy privacy-safe benchmark JSON
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void resetSession()}
          >
            Start fresh benchmark session
          </button>
        </div>

        <p className={styles.privacy}>
          Export contains device/browser metadata, outcome timings and
          aggregate rates. It contains no raw barcode value, item name, price,
          store identity, location, image or network telemetry.
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
