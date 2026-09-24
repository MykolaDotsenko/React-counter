import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  type BarcodeBenchmarkOutcome,
  type BarcodeBenchmarkPreference,
  type BarcodeBenchmarkSession,
} from "./barcode-benchmark";
import styles from "./BarcodeBenchmarkApp.module.css";

const SCAN_TIMEOUT_MS = 8_000;
const DETECTION_INTERVAL_MS = 120;
const PREFERRED_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
] as const;

interface DetectedBarcode {
  readonly rawValue: string;
  readonly format?: string;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { readonly formats?: readonly string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<readonly string[]>;
}

interface ActiveAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly startedPerf: number;
}

interface PendingCandidate {
  readonly rawValue: string;
  readonly format: string;
}

const barcodeDetectorConstructor = (): NativeBarcodeDetectorConstructor | null =>
  (
    globalThis as typeof globalThis & {
      BarcodeDetector?: NativeBarcodeDetectorConstructor;
    }
  ).BarcodeDetector ?? null;

const captureEnvironment =
  async (): Promise<BarcodeBenchmarkEnvironment> => {
    const detector = barcodeDetectorConstructor();
    let supportedFormats: readonly string[] = [];

    if (detector?.getSupportedFormats !== undefined) {
      try {
        supportedFormats = await detector.getSupportedFormats();
      } catch {
        supportedFormats = [];
      }
    }

    return {
      userAgent: navigator.userAgent.slice(0, 512),
      viewportWidth: Math.max(1, Math.round(window.innerWidth)),
      viewportHeight: Math.max(1, Math.round(window.innerHeight)),
      detectorSupported: detector !== null,
      cameraSupported:
        navigator.mediaDevices?.getUserMedia !== undefined,
      supportedFormats: [
        ...new Set(
          supportedFormats
            .filter((format) => format.trim().length > 0)
            .slice(0, 32),
        ),
      ],
    };
  };

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const seconds = (value: number | null): string =>
  value === null ? "—" : `${(value / 1_000).toFixed(2)} s`;

const failureMessage = (error: unknown): "permission-denied" | "camera-error" =>
  error instanceof DOMException &&
  (error.name === "NotAllowedError" ||
    error.name === "SecurityError")
    ? "permission-denied"
    : "camera-error";

export function App() {
  const [environment, setEnvironment] =
    useState<BarcodeBenchmarkEnvironment | null>(null);
  const [session, setSession] =
    useState<BarcodeBenchmarkSession | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingCandidate, setPendingCandidate] =
    useState<PendingCandidate | null>(null);
  const [status, setStatus] = useState("Preparing benchmark environment…");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<NativeBarcodeDetector | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const loopGenerationRef = useRef(0);

  const summary = useMemo(
    () =>
      session === null
        ? null
        : summarizeBarcodeBenchmark(session),
    [session],
  );

  const updateSession = (
    updater: (current: BarcodeBenchmarkSession) => BarcodeBenchmarkSession,
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

  const stopDetectionLoop = (): void => {
    loopGenerationRef.current += 1;
    setScanning(false);
  };

  const stopCamera = (): void => {
    stopDetectionLoop();
    activeAttemptRef.current = null;
    setPendingCandidate(null);

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }

    streamRef.current = null;
    detectorRef.current = null;
    setCameraReady(false);

    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }
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

    void captureEnvironment().then((captured) => {
      if (cancelled) {
        return;
      }

      setEnvironment(captured);

      const now = new Date().toISOString();
      const restored = loadBarcodeBenchmarkSession(
        localStorage,
        captured,
        now,
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
      loopGenerationRef.current += 1;

      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  const recordFailure = (
    type:
      | "detector-unsupported"
      | "camera-unsupported"
      | "permission-denied"
      | "camera-error"
      | "detector-error",
  ): void => {
    updateSession((current) =>
      appendBarcodeBenchmarkFailure(current, {
        type,
        at: new Date().toISOString(),
      }),
    );
  };

  const openCamera = async (): Promise<void> => {
    const detectorConstructor = barcodeDetectorConstructor();

    if (detectorConstructor === null) {
      recordFailure("detector-unsupported");
      setStatus(
        "Native BarcodeDetector is unavailable. Record this device as unsupported and keep manual entry as the baseline.",
      );
      return;
    }

    if (navigator.mediaDevices?.getUserMedia === undefined) {
      recordFailure("camera-unsupported");
      setStatus("Camera capture is unavailable in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });
      const video = videoRef.current;

      if (video === null) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setStatus("Camera surface is unavailable.");
        return;
      }

      const supported = environment?.supportedFormats ?? [];
      const preferred = PREFERRED_FORMATS.filter((format) =>
        supported.includes(format),
      );

      detectorRef.current = new detectorConstructor(
        preferred.length > 0
          ? { formats: preferred }
          : undefined,
      );
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
      setStatus(
        preferred.length > 0
          ? `Camera ready · testing ${preferred.join(", ")}.`
          : "Camera ready · using detector default formats.",
      );
    } catch (error) {
      const type = failureMessage(error);
      recordFailure(type);
      setStatus(
        type === "permission-denied"
          ? "Camera permission was denied. Manual fallback remains available."
          : "Camera could not be started on this device.",
      );
    }
  };

  const finalizeAttempt = (
    outcome: BarcodeBenchmarkOutcome,
    detectedFormat: string | null,
  ): void => {
    const attempt = activeAttemptRef.current;

    if (attempt === null) {
      return;
    }

    const completedAt = new Date().toISOString();
    const durationMs = Math.max(
      0,
      performance.now() - attempt.startedPerf,
    );

    stopDetectionLoop();
    activeAttemptRef.current = null;
    setPendingCandidate(null);

    updateSession((current) =>
      appendBarcodeBenchmarkSample(current, {
        id: attempt.id,
        startedAt: attempt.startedAt,
        completedAt,
        durationMs,
        outcome,
        detectedFormat,
      }),
    );
  };

  const startTimedScan = (): void => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!cameraReady || detector === null || video === null) {
      setStatus("Open the camera before starting a timed scan.");
      return;
    }

    if (activeAttemptRef.current !== null) {
      return;
    }

    const generation = loopGenerationRef.current + 1;
    loopGenerationRef.current = generation;
    const attempt: ActiveAttempt = {
      id:
        globalThis.crypto?.randomUUID?.() ??
        `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      startedAt: new Date().toISOString(),
      startedPerf: performance.now(),
    };
    activeAttemptRef.current = attempt;
    setPendingCandidate(null);
    setScanning(true);
    setStatus("Scanning… keep the barcode steady in the camera view.");

    const detect = async (): Promise<void> => {
      if (
        loopGenerationRef.current !== generation ||
        activeAttemptRef.current?.id !== attempt.id
      ) {
        return;
      }

      if (performance.now() - attempt.startedPerf >= SCAN_TIMEOUT_MS) {
        finalizeAttempt("timeout", null);
        setStatus(
          "No barcode was detected within 8 seconds. Try again or use manual fallback.",
        );
        return;
      }

      try {
        const results = await detector.detect(video);
        const candidate = results.find(
          (result) => result.rawValue.trim().length > 0,
        );

        if (candidate !== undefined) {
          stopDetectionLoop();
          setPendingCandidate({
            rawValue: candidate.rawValue,
            format:
              candidate.format?.trim().length
                ? candidate.format
                : "unknown",
          });
          setStatus(
            "Candidate detected. Confirm it, reject it, or fall back to manual entry.",
          );
          return;
        }
      } catch {
        recordFailure("detector-error");
        finalizeAttempt("timeout", null);
        setStatus(
          "Detector error. The attempt was recorded as a recognition failure; manual fallback remains available.",
        );
        return;
      }

      window.setTimeout(() => {
        void detect();
      }, DETECTION_INTERVAL_MS);
    };

    void detect();
  };

  const resetSession = async (): Promise<void> => {
    stopCamera();
    const captured = await captureEnvironment();
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
            {environment.detectorSupported ? "Detector available" : "Detector unavailable"}
          </span>
        </div>

        <dl className={styles.capabilities}>
          <div>
            <dt>Camera API</dt>
            <dd>{environment.cameraSupported ? "Available" : "Unavailable"}</dd>
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

      <section className={styles.card} aria-labelledby="scan-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Timed interaction</p>
            <h2 id="scan-title">Scan → human decision</h2>
          </div>
          <span className={styles.badge}>
            8 s timeout · raw code not exported
          </span>
        </div>

        <div className={styles.cameraFrame}>
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Barcode camera preview"
          />
          {!cameraReady ? (
            <div className={styles.cameraPlaceholder}>
              Camera opens only after you choose Start camera.
            </div>
          ) : null}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => void openCamera()}
            disabled={cameraReady}
          >
            {cameraReady ? "Camera ready" : "Start camera"}
          </button>
          <button
            type="button"
            onClick={startTimedScan}
            disabled={!cameraReady || scanning || pendingCandidate !== null}
          >
            {scanning ? "Scanning…" : "Start timed scan"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              if (activeAttemptRef.current !== null) {
                finalizeAttempt(
                  "manual-fallback",
                  pendingCandidate?.format ?? null,
                );
                setStatus("Manual fallback recorded.");
                return;
              }

              setStatus(
                "Manual entry remains the baseline; start a timed scan to record fallback cost.",
              );
            }}
          >
            Manual fallback
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={stopCamera}
            disabled={!cameraReady}
          >
            Stop camera
          </button>
        </div>

        {pendingCandidate !== null ? (
          <div className={styles.candidate} aria-live="polite">
            <p>Detected candidate</p>
            <code>{pendingCandidate.rawValue}</code>
            <small>{pendingCandidate.format}</small>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  finalizeAttempt(
                    "confirmed",
                    pendingCandidate.format,
                  );
                  setStatus("Confirmed scan recorded.");
                }}
              >
                Confirm candidate
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  finalizeAttempt(
                    "rejected",
                    pendingCandidate.format,
                  );
                  setStatus(
                    "Rejected candidate recorded. Start another scan to retry.",
                  );
                }}
              >
                Reject / retry
              </button>
            </div>
          </div>
        ) : null}

        <p className={styles.note}>
          The timer starts when you press Start timed scan and stops only when
          you confirm, reject, time out, or choose manual fallback. That makes
          the metric interaction-level rather than detector-only latency.
        </p>
      </section>

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
