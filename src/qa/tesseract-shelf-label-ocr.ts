import type {
  ShelfLabelOcrEngine,
  ShelfLabelOcrResult,
} from "./shelf-label-ocr-adapter";

export const TESSERACT_OCR_RUNTIME_VERSION = "7.0.0";
export const TESSERACT_OCR_LANGUAGES = [
  "fin",
  "swe",
  "eng",
] as const;
export const TESSERACT_OCR_DATASET = "4.0.0_best_int";

export interface TesseractPreparationProgress {
  readonly message: string;
  readonly percent: number | null;
}

export interface PreparedTesseractOcrEngine {
  readonly engine: ShelfLabelOcrEngine;
  dispose(): Promise<void>;
}

interface TesseractRecognition {
  readonly text: string;
  readonly confidence: number;
}

interface TesseractWorkerLike {
  recognize(image: Blob): Promise<TesseractRecognition>;
  terminate(): Promise<void>;
}

type WorkerFactory = (
  onProgress?: (progress: TesseractPreparationProgress) => void,
) => Promise<TesseractWorkerLike>;

const abortError = (): DOMException =>
  new DOMException("Shelf-label OCR aborted", "AbortError");

const normalizeProgress = (
  value: unknown,
): TesseractPreparationProgress => {
  if (typeof value !== "object" || value === null) {
    return {
      message: "Preparing Tesseract OCR worker…",
      percent: null,
    };
  }

  const record = value as Record<string, unknown>;
  const status =
    typeof record.status === "string"
      ? record.status.replace(/_/g, " ")
      : "preparing OCR";
  const rawProgress =
    typeof record.progress === "number" &&
    Number.isFinite(record.progress) &&
    record.progress >= 0 &&
    record.progress <= 1
      ? record.progress * 100
      : null;

  return {
    message: `Tesseract: ${status}`,
    percent: rawProgress,
  };
};

const defaultWorkerFactory: WorkerFactory = async (onProgress) => {
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker(
    [...TESSERACT_OCR_LANGUAGES],
    1,
    {
      logger: (message: unknown) => {
        onProgress?.(normalizeProgress(message));
      },
    },
  );

  return {
    async recognize(image: Blob): Promise<TesseractRecognition> {
      const result = await worker.recognize(image);

      return {
        text: result.data.text,
        confidence: result.data.confidence,
      };
    },
    async terminate(): Promise<void> {
      await worker.terminate();
    },
  };
};

const normalizedConfidence = (value: number): number | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value / 100));
};

export const prepareTesseractOcrEngine = async (
  onProgress?: (progress: TesseractPreparationProgress) => void,
  createWorker: WorkerFactory = defaultWorkerFactory,
): Promise<PreparedTesseractOcrEngine> => {
  onProgress?.({
    message: "Preparing Tesseract OCR worker…",
    percent: null,
  });

  let worker: TesseractWorkerLike | null =
    await createWorker(onProgress);
  let preparingWorker: Promise<TesseractWorkerLike> | null = null;
  let disposed = false;

  const ensureWorker = async (): Promise<TesseractWorkerLike> => {
    if (disposed) {
      throw new Error("Tesseract OCR engine is disposed");
    }

    if (worker !== null) {
      return worker;
    }

    if (preparingWorker === null) {
      preparingWorker = createWorker().then(async (next) => {
        preparingWorker = null;

        if (disposed) {
          await next.terminate();
          throw new Error("Tesseract OCR engine is disposed");
        }

        worker = next;
        return next;
      });
    }

    return preparingWorker;
  };

  const invalidateWorker = async (
    expected: TesseractWorkerLike,
  ): Promise<void> => {
    if (worker === expected) {
      worker = null;
    }

    try {
      await expected.terminate();
    } catch {
      // Termination is best-effort after abort/failure.
    }
  };

  const engine: ShelfLabelOcrEngine = Object.freeze({
    id: [
      "tesseractjs",
      TESSERACT_OCR_RUNTIME_VERSION,
      "lstm",
      TESSERACT_OCR_LANGUAGES.join("+"),
      TESSERACT_OCR_DATASET,
    ].join(":"),
    dataBoundary: "local-only",
    async recognize(
      image: Blob,
      signal: AbortSignal,
    ): Promise<ShelfLabelOcrResult> {
      if (signal.aborted) {
        throw abortError();
      }

      const activeWorker = await ensureWorker();

      if (signal.aborted) {
        void invalidateWorker(activeWorker);
        throw abortError();
      }

      let abortListener: (() => void) | null = null;
      const abortPromise = new Promise<never>((_, reject) => {
        abortListener = () => {
          void invalidateWorker(activeWorker);
          reject(abortError());
        };
        signal.addEventListener("abort", abortListener, {
          once: true,
        });
      });

      try {
        const result = await Promise.race([
          activeWorker.recognize(image),
          abortPromise,
        ]);

        if (signal.aborted) {
          throw abortError();
        }

        return Object.freeze({
          text: result.text,
          confidence: normalizedConfidence(result.confidence),
        });
      } catch (error) {
        if (
          !(error instanceof DOMException) ||
          error.name !== "AbortError"
        ) {
          await invalidateWorker(activeWorker);
        }

        throw error;
      } finally {
        if (abortListener !== null) {
          signal.removeEventListener("abort", abortListener);
        }
      }
    },
  });

  return Object.freeze({
    engine,
    async dispose(): Promise<void> {
      if (disposed) {
        return;
      }

      disposed = true;
      const activeWorker = worker;
      worker = null;

      if (activeWorker !== null) {
        await invalidateWorker(activeWorker);
      }

      if (preparingWorker !== null) {
        try {
          const pending = await preparingWorker;
          await pending.terminate();
        } catch {
          // A failed/aborted preparation has nothing else to release.
        } finally {
          preparingWorker = null;
        }
      }
    },
  });
};
