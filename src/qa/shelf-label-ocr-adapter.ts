import type {
  ShelfLabelOcrDataBoundary,
  ShelfLabelOcrEnvironment,
} from "./shelf-label-ocr-benchmark";

export interface ShelfLabelOcrResult {
  readonly text: string;
  readonly confidence: number | null;
}

export interface ShelfLabelOcrEngine {
  readonly id: string;
  readonly dataBoundary: ShelfLabelOcrDataBoundary;
  recognize(
    image: Blob,
    signal: AbortSignal,
  ): Promise<ShelfLabelOcrResult>;
}

type ShelfLabelOcrGlobal = typeof globalThis & {
  __SBC_SHELF_LABEL_OCR_ENGINE__?: ShelfLabelOcrEngine;
};

const MAX_OCR_RESULT_LENGTH = 20_000;

const isConfidence = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

export const shelfLabelOcrEngine =
  (): ShelfLabelOcrEngine | null => {
    const engine = (
      globalThis as ShelfLabelOcrGlobal
    ).__SBC_SHELF_LABEL_OCR_ENGINE__;

    if (
      engine === undefined ||
      typeof engine.id !== "string" ||
      engine.id.trim().length === 0 ||
      engine.id.length > 160 ||
      (engine.dataBoundary !== "local-only" &&
        engine.dataBoundary !== "remote-image") ||
      typeof engine.recognize !== "function"
    ) {
      return null;
    }

    return engine;
  };

export const captureShelfLabelOcrEnvironment =
  (): ShelfLabelOcrEnvironment => {
    const engine = shelfLabelOcrEngine();

    return {
      userAgent: navigator.userAgent.slice(0, 512),
      viewportWidth: Math.max(1, Math.round(window.innerWidth)),
      viewportHeight: Math.max(1, Math.round(window.innerHeight)),
      cameraSupported:
        navigator.mediaDevices?.getUserMedia !== undefined,
      ocrAvailable: engine !== null,
      engineId: engine?.id ?? null,
      dataBoundary: engine?.dataBoundary ?? null,
    };
  };

export const runShelfLabelOcr = async (
  image: Blob,
  signal: AbortSignal,
): Promise<ShelfLabelOcrResult> => {
  const engine = shelfLabelOcrEngine();

  if (engine === null) {
    throw new Error("Shelf-label OCR engine is unavailable");
  }

  const result = await engine.recognize(image, signal);

  if (
    typeof result !== "object" ||
    result === null ||
    typeof result.text !== "string" ||
    result.text.length > MAX_OCR_RESULT_LENGTH ||
    (result.confidence !== null &&
      !isConfidence(result.confidence))
  ) {
    throw new Error("Shelf-label OCR engine returned invalid output");
  }

  return Object.freeze({
    text: result.text,
    confidence: result.confidence,
  });
};
