import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type VisualRecognitionEnvironment,
  type VisualRecognitionFailureType,
  type VisualRecognitionOutcome,
  type VisualRecognitionSample,
} from "./visual-recognition-benchmark";
import {
  createLocalVisualRecognizer,
  validateVisualCandidateLabels,
  type VisualRecognitionCandidate,
  type VisualRecognizer,
  type VisualRecognizerProgressHandler,
} from "./visual-recognition-local";
import styles from "./BarcodeBenchmarkApp.module.css";

const RECOGNITION_TIMEOUT_MS = 15_000;

interface ActiveAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly startedPerf: number;
  readonly generation: number;
}

interface PendingDecision {
  readonly candidates: readonly VisualRecognitionCandidate[];
  readonly correctRank: number;
  readonly topScore: number;
  readonly scoreMargin: number;
}

export interface VisualRecognitionBenchmarkCameraProps {
  readonly environment: VisualRecognitionEnvironment;
  readonly candidateLabels: readonly string[];
  readonly expectedLabel: string;
  readonly onFailure: (type: VisualRecognitionFailureType) => void;
  readonly onModelLoad: (durationMs: number) => void;
  readonly onSample: (sample: VisualRecognitionSample) => void;
  readonly onStatus: (message: string) => void;
  readonly onAttemptActiveChange: (active: boolean) => void;
  readonly recognizerFactory?: (
    onProgress?: VisualRecognizerProgressHandler,
  ) => Promise<VisualRecognizer>;
}

const attemptId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `visual-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const cameraFailureType = (
  error: unknown,
): "permission-denied" | "camera-error" =>
  error instanceof DOMException &&
  (error.name === "NotAllowedError" ||
    error.name === "SecurityError")
    ? "permission-denied"
    : "camera-error";

export function VisualRecognitionBenchmarkCamera({
  environment,
  candidateLabels,
  expectedLabel,
  onFailure,
  onModelLoad,
  onSample,
  onStatus,
  onAttemptActiveChange,
  recognizerFactory = createLocalVisualRecognizer,
}: VisualRecognitionBenchmarkCameraProps) {
  const [modelState, setModelState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDecision | null>(null);

  const recognizerRef = useRef<VisualRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  const setAttemptActive = (active: boolean): void => {
    onAttemptActiveChange(active);
  };

  const clearAttemptTimer = (): void => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const invalidateAttempt = (): void => {
    generationRef.current += 1;
    clearAttemptTimer();
    activeAttemptRef.current = null;
    setPending(null);
    setAttemptActive(false);
  };

  const stopCameraTracks = (): void => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }

    streamRef.current = null;

    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  };

  const finishTerminalAttempt = (
    outcome: Exclude<
      VisualRecognitionOutcome,
      "confirmed" | "rejected"
    >,
    status: string,
  ): void => {
    const active = activeAttemptRef.current;

    if (active === null) {
      return;
    }

    const durationMs = Math.max(
      0,
      performance.now() - active.startedPerf,
    );

    clearAttemptTimer();
    activeAttemptRef.current = null;
    generationRef.current += 1;
    setPending(null);
    setAttemptActive(false);

    onSample({
      id: active.id,
      startedAt: active.startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      outcome,
      candidateCount: candidateLabels.length,
      correctRank: null,
      topScore: null,
      scoreMargin: null,
    });
    onStatus(status);
  };

  const loadModel = async (): Promise<void> => {
    if (modelState === "loading" || modelState === "ready") {
      return;
    }

    setModelState("loading");
    setLoadProgress("Starting local model load…");
    const started = performance.now();

    try {
      const recognizer = await recognizerFactory((progress) => {
        if (!mountedRef.current) {
          return;
        }

        const suffix =
          progress.progress === null
            ? ""
            : ` · ${progress.progress.toFixed(0)}%`;
        setLoadProgress(`${progress.status}${suffix}`);
      });

      if (!mountedRef.current) {
        await recognizer.dispose();
        return;
      }

      recognizerRef.current = recognizer;
      const durationMs = Math.max(0, performance.now() - started);
      setModelState("ready");
      setLoadProgress(null);
      onModelLoad(durationMs);
      onStatus(
        "Local visual model is ready. Product images stay on this device.",
      );
    } catch {
      if (!mountedRef.current) {
        return;
      }

      setModelState("error");
      setLoadProgress(null);
      onFailure("model-load-error");
      onStatus(
        "Local visual model could not be loaded. Manual entry remains the benchmark fallback.",
      );
    }
  };

  const startCamera = async (): Promise<void> => {
    if (!environment.cameraSupported) {
      onFailure("camera-unsupported");
      onStatus("Camera API is unavailable on this browser/device.");
      return;
    }

    if (cameraReady) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      if (!mountedRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      streamRef.current = stream;

      if (videoRef.current === null) {
        throw new Error("Benchmark video element is unavailable");
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);
      onStatus("Camera ready. Candidate labels remain memory-only.");
    } catch (error) {
      stopCameraTracks();
      const failure = cameraFailureType(error);
      onFailure(failure);
      onStatus(
        failure === "permission-denied"
          ? "Camera permission was denied."
          : "Camera could not be started.",
      );
    }
  };

  const startAttempt = (): void => {
    if (activeAttemptRef.current !== null) {
      return;
    }

    if (modelState !== "ready" || recognizerRef.current === null) {
      onStatus("Load the local visual model before starting a timed attempt.");
      return;
    }

    if (!cameraReady || videoRef.current === null) {
      onStatus("Start the camera before starting a timed attempt.");
      return;
    }

    if (
      window.innerWidth !== environment.viewportWidth ||
      window.innerHeight !== environment.viewportHeight
    ) {
      onStatus(
        "Viewport changed. Export/reset before recording a new comparable attempt.",
      );
      return;
    }

    let labels: readonly string[];

    try {
      labels = validateVisualCandidateLabels(candidateLabels);
    } catch {
      onStatus("Enter 2–20 unique candidate labels before the attempt.");
      return;
    }

    if (!labels.includes(expectedLabel)) {
      onStatus("Choose the expected product before the timed attempt.");
      return;
    }

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width <= 0 || height <= 0) {
      onStatus("Camera frame is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (context === null) {
      onStatus("Camera frame could not be captured.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const active: ActiveAttempt = {
      id: attemptId(),
      startedAt: new Date().toISOString(),
      startedPerf: performance.now(),
      generation,
    };

    activeAttemptRef.current = active;
    setPending(null);
    setAttemptActive(true);
    onStatus(
      "Recognition running locally. Review the ranked candidates before recording the result.",
    );

    timeoutRef.current = window.setTimeout(() => {
      if (
        activeAttemptRef.current?.generation !== generation
      ) {
        return;
      }

      finishTerminalAttempt(
        "timeout",
        "Visual recognition timed out; use the manual fallback.",
      );
    }, RECOGNITION_TIMEOUT_MS);

    void recognizerRef.current
      .recognize(canvas, labels)
      .then((results) => {
        if (
          !mountedRef.current ||
          activeAttemptRef.current?.generation !== generation
        ) {
          return;
        }

        const rankIndex = results.findIndex(
          (candidate) => candidate.label === expectedLabel,
        );

        if (rankIndex < 0 || results.length < 2) {
          finishTerminalAttempt(
            "recognizer-error",
            "Recognizer returned an incomplete candidate set.",
          );
          return;
        }

        const topScore = results[0]?.score;
        const secondScore = results[1]?.score;

        if (topScore === undefined || secondScore === undefined) {
          finishTerminalAttempt(
            "recognizer-error",
            "Recognizer did not return enough scored candidates.",
          );
          return;
        }

        clearAttemptTimer();
        setPending({
          candidates: results,
          correctRank: rankIndex + 1,
          topScore,
          scoreMargin: topScore - secondScore,
        });
        onStatus(
          "Review the ranked candidates, then record whether correction was required.",
        );
      })
      .catch(() => {
        if (
          !mountedRef.current ||
          activeAttemptRef.current?.generation !== generation
        ) {
          return;
        }

        finishTerminalAttempt(
          "recognizer-error",
          "Local recognition failed; use the manual fallback.",
        );
      });
  };

  const recordDecision = (): void => {
    const active = activeAttemptRef.current;

    if (active === null || pending === null) {
      return;
    }

    const durationMs = Math.max(
      0,
      performance.now() - active.startedPerf,
    );
    const outcome: VisualRecognitionOutcome =
      pending.correctRank === 1 ? "confirmed" : "rejected";

    clearAttemptTimer();
    activeAttemptRef.current = null;
    generationRef.current += 1;
    setPending(null);
    setAttemptActive(false);

    onSample({
      id: active.id,
      startedAt: active.startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      outcome,
      candidateCount: candidateLabels.length,
      correctRank: pending.correctRank,
      topScore: pending.topScore,
      scoreMargin: pending.scoreMargin,
    });
    onStatus(
      pending.correctRank === 1
        ? "Top-1 visual candidate recorded as correct."
        : `Correction recorded: expected product ranked #${pending.correctRank}.`,
    );
  };

  const manualFallback = (): void => {
    finishTerminalAttempt(
      "manual-fallback",
      "Manual fallback recorded for this attempt.",
    );
  };

  const stopCamera = (): void => {
    if (activeAttemptRef.current !== null) {
      manualFallback();
    }

    stopCameraTracks();
    onStatus("Camera stopped.");
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearAttemptTimer();

      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }

      const recognizer = recognizerRef.current;
      recognizerRef.current = null;

      if (recognizer !== null) {
        void recognizer.dispose();
      }
    };
  }, []);

  return (
    <section className={styles.card} aria-labelledby="visual-camera-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Local camera inference</p>
          <h2 id="visual-camera-title">Timed visual recognition</h2>
        </div>
        <span className={styles.badge}>
          {modelState === "ready" ? "Model ready" : "Model not ready"}
        </span>
      </div>

      <p className={styles.note}>
        Model files may download from Hugging Face when first loaded. Captured
        frames are passed directly to the local browser model and are never
        uploaded or persisted.
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => void loadModel()}
          disabled={modelState === "loading" || modelState === "ready"}
        >
          {modelState === "loading"
            ? "Loading local model…"
            : modelState === "ready"
              ? "Local model ready"
              : "Load local model"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => void startCamera()}
          disabled={cameraReady}
        >
          {cameraReady ? "Camera ready" : "Start camera"}
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

      {loadProgress !== null ? (
        <p className={styles.note} aria-live="polite">
          {loadProgress}
        </p>
      ) : null}

      <div className={styles.cameraFrame}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Visual recognition camera preview"
        />
        {!cameraReady ? (
          <div className={styles.cameraPlaceholder}>
            Camera preview appears here after permission is granted.
          </div>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={startAttempt}
          disabled={
            modelState !== "ready" ||
            !cameraReady ||
            activeAttemptRef.current !== null
          }
        >
          Start timed recognition
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={manualFallback}
          disabled={activeAttemptRef.current === null}
        >
          Manual fallback
        </button>
      </div>

      {pending !== null ? (
        <div className={styles.candidate}>
          <p>Ranked candidates — memory only</p>
          <ol>
            {pending.candidates.slice(0, 5).map((candidate) => (
              <li key={candidate.label}>
                <strong>{candidate.label}</strong>{" "}
                <span>{(candidate.score * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ol>
          <p>
            Expected item rank: <strong>#{pending.correctRank}</strong>
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={recordDecision}>
              {pending.correctRank === 1
                ? "Record top-1 correct"
                : "Record correction required"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
