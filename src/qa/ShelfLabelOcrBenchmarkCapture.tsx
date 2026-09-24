import { useEffect, useRef, useState } from "react";

import {
  benchmarkCameraFailureType,
  captureBenchmarkFrame,
  stopBenchmarkMediaStream,
} from "./camera-benchmark-capture";
import type {
  ShelfLabelOcrEnvironment,
  ShelfLabelOcrFailureType,
  ShelfLabelOcrOutcome,
  ShelfLabelOcrSample,
} from "./shelf-label-ocr-benchmark";
import {
  runShelfLabelOcr,
  shelfLabelOcrEngine,
} from "./shelf-label-ocr-adapter";
import {
  parseShelfPriceCandidates,
  type ShelfPriceCandidate,
} from "./shelf-label-price-parser";
import styles from "./BarcodeBenchmarkApp.module.css";

const OCR_TIMEOUT_MS = 12_000;

interface ActiveAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly startedPerf: number;
  readonly abortController: AbortController;
}

export interface ShelfLabelOcrBenchmarkCaptureProps {
  readonly environment: ShelfLabelOcrEnvironment;
  readonly onFailure: (type: ShelfLabelOcrFailureType) => void;
  readonly onSample: (sample: ShelfLabelOcrSample) => void;
  readonly onStatus: (message: string) => void;
  readonly onAttemptActiveChange: (active: boolean) => void;
}

const attemptId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `ocr-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;

const contextLabel = (candidate: ShelfPriceCandidate): string => {
  if (candidate.context.unitPrice) {
    return "unit price";
  }

  if (candidate.context.multiBuy) {
    return "multi-buy";
  }

  if (candidate.context.loyaltyPrice) {
    return "loyalty";
  }

  if (candidate.context.regularPrice) {
    return "regular";
  }

  return "direct price";
};

export function ShelfLabelOcrBenchmarkCapture({
  environment,
  onFailure,
  onSample,
  onStatus,
  onAttemptActiveChange,
}: ShelfLabelOcrBenchmarkCaptureProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [candidates, setCandidates] =
    useState<readonly ShelfPriceCandidate[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
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
    outcome: ShelfLabelOcrOutcome,
    selectedRank: 1 | 2 | 3 | null,
    candidateCount: number,
    confidence: number | null,
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
      ocrConfidence: confidence,
    });

    activeAttemptRef.current = null;
    setRecognizing(false);
    setCandidates([]);
    setOcrConfidence(null);
    onAttemptActiveChange(false);
  };

  const stopCamera = (recordFallback: boolean): void => {
    if (recordFallback && activeAttemptRef.current !== null) {
      finishAttempt(
        "manual-fallback",
        null,
        candidates.length,
        ocrConfidence,
      );
    } else {
      generationRef.current += 1;
      clearTimeoutHandle();
      activeAttemptRef.current?.abortController.abort();
      activeAttemptRef.current = null;
      setRecognizing(false);
      setCandidates([]);
      setOcrConfidence(null);
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
        environment.ocrAvailable
          ? "Camera ready. Fill the frame with one shelf label."
          : "Camera ready, but no OCR benchmark adapter is configured.",
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

  const startOcr = async (): Promise<void> => {
    if (activeAttemptRef.current !== null) {
      return;
    }

    if (
      window.innerWidth !== environment.viewportWidth ||
      window.innerHeight !== environment.viewportHeight
    ) {
      onStatus(
        "Viewport changed. Export/reset before recording more comparable OCR evidence.",
      );
      return;
    }

    const engine = shelfLabelOcrEngine();

    if (
      engine === null ||
      engine.id !== environment.engineId ||
      engine.dataBoundary !== environment.dataBoundary
    ) {
      onFailure("ocr-unavailable");
      onStatus(
        "OCR adapter is unavailable or changed. Start a fresh benchmark session after configuring it.",
      );
      return;
    }

    const video = videoRef.current;

    if (video === null || !cameraReady) {
      onStatus("Start the camera before a timed OCR attempt.");
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
    setOcrConfidence(null);
    setRecognizing(true);
    onAttemptActiveChange(true);
    onStatus("Reading shelf label and extracting price candidates…");

    timeoutRef.current = window.setTimeout(() => {
      if (
        activeAttemptRef.current !== null &&
        generationRef.current === generation
      ) {
        finishAttempt("timeout", null, 0, null);
        onStatus(
          "OCR timed out. Manual price entry remains the fallback.",
        );
      }
    }, OCR_TIMEOUT_MS);

    try {
      const frame = await captureBenchmarkFrame(video);

      if (
        activeAttemptRef.current === null ||
        generationRef.current !== generation
      ) {
        return;
      }

      const result = await runShelfLabelOcr(
        frame,
        abortController.signal,
      );

      if (
        activeAttemptRef.current === null ||
        generationRef.current !== generation
      ) {
        return;
      }

      let parsed: readonly ShelfPriceCandidate[];

      try {
        parsed = parseShelfPriceCandidates(result.text);
      } catch {
        finishAttempt("parser-error", null, 0, result.confidence);
        onStatus(
          "OCR text could not be parsed safely. Manual entry remains available.",
        );
        return;
      }

      const topThree = parsed.slice(0, 3);

      if (topThree.length === 0) {
        finishAttempt("no-candidate", null, 0, result.confidence);
        onStatus(
          "No safe price candidate was found. Use manual entry or retry.",
        );
        return;
      }

      setCandidates(topThree);
      setOcrConfidence(result.confidence);
      setRecognizing(false);
      onStatus(
        "Review the ranked price candidates. Confirm the correct one or reject them all.",
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
        error.message.toLocaleLowerCase().includes("capture")
          ? "capture-error"
          : "ocr-error";

      finishAttempt(outcome, null, 0, null);
      onStatus(
        outcome === "capture-error"
          ? "Camera frame capture failed."
          : "OCR engine failed. Manual price entry remains available.",
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
      ocrConfidence,
    );
    onStatus(
      "Price-candidate decision recorded without storing the price or OCR text.",
    );
  };

  const rejectAll = (): void => {
    if (candidates.length === 0) {
      return;
    }

    finishAttempt(
      "rejected",
      null,
      candidates.length,
      ocrConfidence,
    );
    onStatus(
      "All OCR price candidates rejected. Prices and OCR text were not persisted.",
    );
  };

  return (
    <section className={styles.card} aria-labelledby="ocr-camera-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Timed interaction</p>
          <h2 id="ocr-camera-title">Shelf-label OCR attempt</h2>
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
          aria-label="Shelf-label OCR camera preview"
        />
        {!cameraReady ? (
          <p className={styles.cameraPlaceholder}>
            Camera frames and raw OCR text stay transient. Neither is stored
            in benchmark evidence.
          </p>
        ) : null}
      </div>

      {candidates.length > 0 ? (
        <div className={styles.candidate} aria-live="polite">
          <p>Price candidates</p>
          {candidates.map((candidate, index) => (
            <div key={`${Number(candidate.minorUnits)}-${index}`}>
              <strong>
                {index + 1}. {candidate.displayValue}
              </strong>
              <small>
                {contextLabel(candidate)}
                {" · "}
                {candidate.kind}
              </small>
              <button
                type="button"
                onClick={() =>
                  confirmRank((index + 1) as 1 | 2 | 3)
                }
              >
                Candidate {index + 1} is correct
              </button>
            </div>
          ))}
          <button type="button" onClick={rejectAll}>
            None of these prices is correct
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
              onClick={() => void startOcr()}
              disabled={
                activeAttemptRef.current !== null ||
                !environment.ocrAvailable
              }
            >
              {recognizing
                ? "Reading label…"
                : candidates.length > 0
                  ? "Decision pending"
                  : "Start timed OCR"}
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
                    ocrConfidence,
                  );
                  onStatus("Manual price-entry fallback recorded.");
                }
              }}
              disabled={activeAttemptRef.current === null}
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
