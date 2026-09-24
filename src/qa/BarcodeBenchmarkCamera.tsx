import { useEffect, useRef, useState } from "react";

import type {
  BarcodeBenchmarkFailureType,
  BarcodeBenchmarkOutcome,
  BarcodeBenchmarkSample,
  BarcodeBenchmarkEnvironment,
} from "./barcode-benchmark";
import {
  barcodeDetectorConstructor,
  createNativeBarcodeDetector,
  type NativeBarcodeDetector,
} from "./barcode-benchmark-native";
import styles from "./BarcodeBenchmarkApp.module.css";

const SCAN_TIMEOUT_MS = 8_000;
const DETECTION_INTERVAL_MS = 120;

interface ActiveAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly startedPerf: number;
}

interface PendingCandidate {
  readonly rawValue: string;
  readonly format: string;
}

export interface BarcodeBenchmarkCameraProps {
  readonly environment: BarcodeBenchmarkEnvironment;
  readonly onFailure: (type: BarcodeBenchmarkFailureType) => void;
  readonly onSample: (sample: BarcodeBenchmarkSample) => void;
  readonly onStatus: (message: string) => void;
  readonly onAttemptActiveChange: (active: boolean) => void;
}

const cameraFailureType = (
  error: unknown,
): "permission-denied" | "camera-error" =>
  error instanceof DOMException &&
  (error.name === "NotAllowedError" ||
    error.name === "SecurityError")
    ? "permission-denied"
    : "camera-error";

const attemptId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function BarcodeBenchmarkCamera({
  environment,
  onFailure,
  onSample,
  onStatus,
  onAttemptActiveChange,
}: BarcodeBenchmarkCameraProps) {
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingCandidate, setPendingCandidate] =
    useState<PendingCandidate | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<NativeBarcodeDetector | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const loopGenerationRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const clearScanTimeout = (): void => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const stopDetectionLoop = (): void => {
    loopGenerationRef.current += 1;
    clearScanTimeout();
    setScanning(false);
  };

  const finalizeAttempt = (
    outcome: BarcodeBenchmarkOutcome,
    detectedFormat: string | null,
  ): void => {
    const attempt = activeAttemptRef.current;

    if (attempt === null) {
      return;
    }

    const sample: BarcodeBenchmarkSample = {
      id: attempt.id,
      startedAt: attempt.startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Math.max(
        0,
        performance.now() - attempt.startedPerf,
      ),
      outcome,
      detectedFormat,
    };

    stopDetectionLoop();
    activeAttemptRef.current = null;
    setPendingCandidate(null);
    onAttemptActiveChange(false);
    onSample(sample);
  };

  const stopCamera = (recordFallback: boolean): void => {
    if (recordFallback && activeAttemptRef.current !== null) {
      finalizeAttempt(
        "manual-fallback",
        pendingCandidate?.format ?? null,
      );
    } else {
      stopDetectionLoop();
      activeAttemptRef.current = null;
      setPendingCandidate(null);
    }

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

  useEffect(
    () => () => {
      loopGenerationRef.current += 1;

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }

      onAttemptActiveChange(false);
    },
    [onAttemptActiveChange],
  );

  const openCamera = async (): Promise<void> => {
    if (barcodeDetectorConstructor() === null) {
      onFailure("detector-unsupported");
      onStatus(
        "Native BarcodeDetector is unavailable. Record this device as unsupported and keep manual entry as the baseline.",
      );
      return;
    }

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
      const detector = createNativeBarcodeDetector(environment);

      if (video === null || detector === null) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        onStatus("Camera or detector surface is unavailable.");
        return;
      }

      detectorRef.current = detector;
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
      onStatus(
        environment.supportedFormats.length > 0
          ? `Camera ready · detector reports ${environment.supportedFormats.join(", ")}.`
          : "Camera ready · using detector default formats.",
      );
    } catch (error) {
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }

      streamRef.current = null;
      detectorRef.current = null;

      if (videoRef.current !== null) {
        videoRef.current.srcObject = null;
      }

      setCameraReady(false);

      const type = cameraFailureType(error);
      onFailure(type);
      onStatus(
        type === "permission-denied"
          ? "Camera permission was denied. Manual fallback remains available."
          : "Camera could not be started on this device.",
      );
    }
  };

  const startTimedScan = (): void => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!cameraReady || detector === null || video === null) {
      onStatus("Open the camera before starting a timed scan.");
      return;
    }

    if (activeAttemptRef.current !== null) {
      return;
    }

    const generation = loopGenerationRef.current + 1;
    loopGenerationRef.current = generation;
    const attempt: ActiveAttempt = {
      id: attemptId(),
      startedAt: new Date().toISOString(),
      startedPerf: performance.now(),
    };

    activeAttemptRef.current = attempt;
    setPendingCandidate(null);
    setScanning(true);
    onAttemptActiveChange(true);
    onStatus("Scanning… keep the barcode steady in the camera view.");

    timeoutRef.current = window.setTimeout(() => {
      if (
        loopGenerationRef.current === generation &&
        activeAttemptRef.current?.id === attempt.id
      ) {
        finalizeAttempt("timeout", null);
        onStatus(
          "No barcode was detected within 8 seconds. Try again or use manual fallback.",
        );
      }
    }, SCAN_TIMEOUT_MS);

    const detect = async (): Promise<void> => {
      if (
        loopGenerationRef.current !== generation ||
        activeAttemptRef.current?.id !== attempt.id
      ) {
        return;
      }

      try {
        const results = await detector.detect(video);

        if (
          loopGenerationRef.current !== generation ||
          activeAttemptRef.current?.id !== attempt.id
        ) {
          return;
        }

        if (performance.now() - attempt.startedPerf >= SCAN_TIMEOUT_MS) {
          finalizeAttempt("timeout", null);
          onStatus(
            "No barcode was detected within 8 seconds. Try again or use manual fallback.",
          );
          return;
        }

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
          onStatus(
            "Candidate detected. Confirm it, reject it, or fall back to manual entry.",
          );
          return;
        }
      } catch {
        finalizeAttempt("detector-error", null);
        onStatus(
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

  return (
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
              onStatus("Manual fallback recorded.");
              return;
            }

            onStatus(
              "Manual entry remains the baseline; start a timed scan to record fallback cost.",
            );
          }}
        >
          Manual fallback
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            stopCamera(true);
            onStatus("Camera stopped.");
          }}
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
                onStatus("Confirmed scan recorded.");
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
                onStatus(
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
        you confirm, reject, time out, hit a detector error, or choose manual
        fallback. This measures interaction-level latency rather than
        detector-only latency.
      </p>
    </section>
  );
}
