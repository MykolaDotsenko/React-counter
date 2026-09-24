import { useEffect, useRef, useState } from "react";

import {
  benchmarkCameraFailureType,
  captureBenchmarkFrame,
  stopBenchmarkMediaStream,
} from "./camera-benchmark-capture";
import type {
  VisualProductBenchmarkEnvironment,
  VisualProductBenchmarkFailureType,
  VisualProductBenchmarkOutcome,
  VisualProductBenchmarkSample,
} from "./visual-product-benchmark";
import {
  runVisualProductRecognition,
  visualProductRecognizer,
  type VisualProductCandidate,
} from "./visual-product-benchmark-adapter";
import styles from "./BarcodeBenchmarkApp.module.css";

const RECOGNITION_TIMEOUT_MS = 12_000;

interface ActiveAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly startedPerf: number;
  readonly abortController: AbortController;
}

export interface VisualProductBenchmarkCaptureProps {
  readonly environment: VisualProductBenchmarkEnvironment;
  readonly onFailure: (type: VisualProductBenchmarkFailureType) => void;
  readonly onSample: (sample: VisualProductBenchmarkSample) => void;
  readonly onStatus: (message: string) => void;
  readonly onAttemptActiveChange: (active: boolean) => void;
}

const attemptId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  "visual-" +
    Date.now().toString(16) +
    "-" +
    Math.random().toString(16).slice(2);

export function VisualProductBenchmarkCapture({
  environment,
  onFailure,
  onSample,
  onStatus,
  onAttemptActiveChange,
}: VisualProductBenchmarkCaptureProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [attemptActive, setAttemptActive] = useState(false);
  const [candidates, setCandidates] =
    useState<readonly VisualProductCandidate[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const generationRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const clearTimeoutHandle = (): void => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const finishAttempt = (
    outcome: VisualProductBenchmarkOutcome,
    selectedRank: 1 | 2 | 3 | null,
    candidateCount: number,
    topConfidence: number | null,
  ): void => {
    const attempt = activeAttemptRef.current;

    if (attempt === null) {
      return;
    }

    generationRef.current += 1;
    clearTimeoutHandle();
    attempt.abortController.abort();

    onSample({
      id: attempt.id,
      startedAt: attempt.startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Math.max(
        0,
        performance.now() - attempt.startedPerf,
      ),
      outcome,
      candidateCount,
      selectedRank,
      topConfidence,
    });

    activeAttemptRef.current = null;
    setAttemptActive(false);
    setRecognizing(false);
    setCandidates([]);
    onAttemptActiveChange(false);
  };

  const stopCamera = (recordFallback: boolean): void => {
    if (recordFallback && activeAttemptRef.current !== null) {
      const topConfidence = candidates[0]?.confidence ?? null;
      finishAttempt(
        "manual-fallback",
        null,
        candidates.length,
        topConfidence,
      );
    } else {
      generationRef.current += 1;
      clearTimeoutHandle();
      activeAttemptRef.current?.abortController.abort();
      activeAttemptRef.current = null;
      setAttemptActive(false);
      setRecognizing(false);
      setCandidates([]);
      onAttemptActiveChange(false);
    }

    stopBenchmarkMediaStream(streamRef.current);

    streamRef.current = null;
    setCameraReady(false);

    if (videoRef.current !== null) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(
    () => () => {
      generationRef.current += 1;
      clearTimeoutHandle();
      activeAttemptRef.current?.abortController.abort();

      stopBenchmarkMediaStream(streamRef.current);

      onAttemptActiveChange(false);
    },
    [onAttemptActiveChange],
  );

  const openCamera = async (): Promise<void> => {
    if (navigator.mediaDevices?.getUserMedia === undefined) {
      onFailure("camera-unsupported");
      onStatus("Camera capture is unavailable in this browser.");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      const video = videoRef.current;

      if (video === null) {
        throw new Error("Camera preview is unavailable");
      }

      video.srcObject = stream;
      await video.play();

      streamRef.current = stream;
      setCameraReady(true);
      onStatus(
        environment.recognizerAvailable
          ? "Camera ready. Keep one product package prominent in frame."
          : "Camera ready, but no visual recognizer adapter is configured.",
      );
    } catch (error) {
      stopBenchmarkMediaStream(stream);

      const failureType = benchmarkCameraFailureType(error);
      onFailure(failureType);
      onStatus(
        failureType === "permission-denied"
          ? "Camera permission was denied."
          : "Camera could not be started.",
      );
    }
  };

  const startRecognition = async (): Promise<void> => {
    if (activeAttemptRef.current !== null) {
      return;
    }

    if (
      window.innerWidth !== environment.viewportWidth ||
      window.innerHeight !== environment.viewportHeight
    ) {
      onStatus(
        "Viewport changed. Export/reset before recording more comparable visual-recognition evidence.",
      );
      return;
    }

    const recognizer = visualProductRecognizer();

    if (
      recognizer === null ||
      recognizer.id !== environment.recognizerId ||
      recognizer.dataBoundary !== environment.dataBoundary
    ) {
      onFailure("recognizer-unavailable");
      onStatus(
        "Visual recognizer adapter is unavailable or changed. Start a fresh benchmark session after configuring it.",
      );
      return;
    }

    const video = videoRef.current;

    if (video === null || !cameraReady) {
      onStatus("Start the camera before a timed recognition attempt.");
      return;
    }

    const abortController = new AbortController();
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    activeAttemptRef.current = {
      id: attemptId(),
      startedAt: new Date().toISOString(),
      startedPerf: performance.now(),
      abortController,
    };

    setCandidates([]);
    setAttemptActive(true);
    setRecognizing(true);
    onAttemptActiveChange(true);
    onStatus("Recognizing product candidate…");

    timeoutRef.current = window.setTimeout(() => {
      if (
        activeAttemptRef.current !== null &&
        generationRef.current === generation
      ) {
        finishAttempt("timeout", null, 0, null);
        onStatus(
          "Recognition timed out. Manual entry remains the fallback.",
        );
      }
    }, RECOGNITION_TIMEOUT_MS);

    try {
      const frame = await captureBenchmarkFrame(video);

      if (
        activeAttemptRef.current === null ||
        generationRef.current !== generation
      ) {
        return;
      }

      const result = await runVisualProductRecognition(
        frame,
        abortController.signal,
      );

      if (
        activeAttemptRef.current === null ||
        generationRef.current !== generation
      ) {
        return;
      }

      const topThree = result.slice(0, 3);

      if (topThree.length === 0) {
        finishAttempt("no-result", null, 0, null);
        onStatus(
          "Recognizer returned no candidates. Use manual entry or retry.",
        );
        return;
      }

      setCandidates(topThree);
      setRecognizing(false);
      onStatus(
        "Review the candidates and record the first correct rank, or reject them all.",
      );
    } catch (error) {
      if (
        activeAttemptRef.current === null ||
        generationRef.current !== generation
      ) {
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const outcome =
        error instanceof Error &&
        error.message.includes("capture")
          ? "capture-error"
          : "recognizer-error";

      finishAttempt(outcome, null, 0, null);
      onStatus(
        outcome === "capture-error"
          ? "Camera frame capture failed."
          : "Visual recognizer failed. Manual entry remains available.",
      );
    }
  };

  const confirmRank = (rank: 1 | 2 | 3): void => {
    if (candidates[rank - 1] === undefined) {
      return;
    }

    finishAttempt(
      rank === 1 ? "top1-confirmed" : "top3-confirmed",
      rank,
      candidates.length,
      candidates[0]?.confidence ?? null,
    );
    onStatus("Candidate decision recorded without storing its label.");
  };

  const rejectAll = (): void => {
    if (candidates.length === 0) {
      return;
    }

    finishAttempt(
      "rejected",
      null,
      candidates.length,
      candidates[0]?.confidence ?? null,
    );
    onStatus(
      "All visual candidates rejected. Candidate labels were not persisted.",
    );
  };

  return (
    <section className={styles.card} aria-labelledby="visual-camera-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Timed interaction</p>
          <h2 id="visual-camera-title">Camera recognition attempt</h2>
        </div>
        <span className={styles.badge}>
          {cameraReady ? "Camera ready" : "Camera stopped"}
        </span>
      </div>

      <div className={styles.cameraFrame}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Visual product recognition camera preview"
        />
        {!cameraReady ? (
          <p className={styles.cameraPlaceholder}>
            Camera frames stay transient. The benchmark never stores or
            exports an image.
          </p>
        ) : null}
      </div>

      {candidates.length > 0 ? (
        <div className={styles.candidate} aria-live="polite">
          <p>Recognizer candidates</p>
          {candidates.map((candidate, index) => (
            <div key={index}>
              <strong>{index + 1}. {candidate.label}</strong>
              <small>
                Confidence: {candidate.confidence === null
                  ? "not reported"
                  : (candidate.confidence * 100).toFixed(1) + "%"}
              </small>
              <button
                type="button"
                onClick={() => confirmRank((index + 1) as 1 | 2 | 3)}
              >
                Candidate {index + 1} is correct
              </button>
            </div>
          ))}
          <button type="button" onClick={rejectAll}>
            None of these candidates is correct
          </button>
        </div>
      ) : null}

      <div className={styles.actions}>
        {!cameraReady ? (
          <button type="button" onClick={() => void openCamera()}>
            Start camera
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void startRecognition()}
              disabled={
                attemptActive ||
                !environment.recognizerAvailable
              }
            >
              {recognizing
                ? "Recognizing…"
                : candidates.length > 0
                  ? "Decision pending"
                  : "Start timed recognition"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                if (activeAttemptRef.current !== null) {
                  finishAttempt(
                    "manual-fallback",
                    null,
                    candidates.length,
                    candidates[0]?.confidence ?? null,
                  );
                  onStatus("Manual fallback recorded.");
                }
              }}
              disabled={!attemptActive}
            >
              Manual fallback
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => stopCamera(true)}
            >
              Stop camera
            </button>
          </>
        )}
      </div>
    </section>
  );
}
