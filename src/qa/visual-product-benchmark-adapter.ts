import type {
  VisualProductBenchmarkEnvironment,
  VisualProductDataBoundary,
} from "./visual-product-benchmark";

export interface VisualProductCandidate {
  readonly label: string;
  readonly confidence: number | null;
}

export interface VisualProductRecognizer {
  readonly id: string;
  readonly dataBoundary: VisualProductDataBoundary;
  recognize(
    image: Blob,
    signal: AbortSignal,
  ): Promise<readonly VisualProductCandidate[]>;
  dispose?(): Promise<void> | void;
}

type VisualRecognizerGlobal = typeof globalThis & {
  __SBC_VISUAL_PRODUCT_RECOGNIZER__?: VisualProductRecognizer;
};

const disposeRecognizer = (
  recognizer: VisualProductRecognizer | undefined,
): void => {
  if (recognizer?.dispose === undefined) {
    return;
  }

  try {
    const result = recognizer.dispose();

    if (result instanceof Promise) {
      void result.catch(() => {
        // Cleanup failure must not break the evidence harness.
      });
    }
  } catch {
    // Cleanup failure must not break the evidence harness.
  }
};

export const installVisualProductRecognizer = (
  recognizer: VisualProductRecognizer,
): void => {
  if (
    typeof recognizer.id !== "string" ||
    recognizer.id.trim().length === 0 ||
    recognizer.id.length > 160 ||
    (recognizer.dataBoundary !== "local-only" &&
      recognizer.dataBoundary !== "remote-image") ||
    typeof recognizer.recognize !== "function"
  ) {
    throw new RangeError("Invalid visual product recognizer");
  }

  const target = globalThis as VisualRecognizerGlobal;
  const previous = target.__SBC_VISUAL_PRODUCT_RECOGNIZER__;

  if (previous !== recognizer) {
    target.__SBC_VISUAL_PRODUCT_RECOGNIZER__ = recognizer;
    disposeRecognizer(previous);
  }
};

export const clearVisualProductRecognizer = (): void => {
  const target = globalThis as VisualRecognizerGlobal;
  const previous = target.__SBC_VISUAL_PRODUCT_RECOGNIZER__;

  Reflect.deleteProperty(
    target,
    "__SBC_VISUAL_PRODUCT_RECOGNIZER__",
  );
  disposeRecognizer(previous);
};

const isCandidate = (
  value: unknown,
): value is VisualProductCandidate => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VisualProductCandidate>;

  return (
    typeof candidate.label === "string" &&
    candidate.label.trim().length > 0 &&
    candidate.label.length <= 160 &&
    (candidate.confidence === null ||
      (typeof candidate.confidence === "number" &&
        Number.isFinite(candidate.confidence) &&
        candidate.confidence >= 0 &&
        candidate.confidence <= 1))
  );
};

export const visualProductRecognizer =
  (): VisualProductRecognizer | null => {
    const recognizer = (
      globalThis as VisualRecognizerGlobal
    ).__SBC_VISUAL_PRODUCT_RECOGNIZER__;

    if (
      recognizer === undefined ||
      typeof recognizer.id !== "string" ||
      recognizer.id.trim().length === 0 ||
      recognizer.id.length > 160 ||
      (recognizer.dataBoundary !== "local-only" &&
        recognizer.dataBoundary !== "remote-image") ||
      typeof recognizer.recognize !== "function"
    ) {
      return null;
    }

    return recognizer;
  };

export const captureVisualProductBenchmarkEnvironment =
  (): VisualProductBenchmarkEnvironment => {
    const recognizer = visualProductRecognizer();

    return {
      userAgent: navigator.userAgent.slice(0, 512),
      viewportWidth: Math.max(1, Math.round(window.innerWidth)),
      viewportHeight: Math.max(1, Math.round(window.innerHeight)),
      cameraSupported:
        navigator.mediaDevices?.getUserMedia !== undefined,
      recognizerAvailable: recognizer !== null,
      recognizerId: recognizer?.id ?? null,
      dataBoundary: recognizer?.dataBoundary ?? null,
    };
  };

export const runVisualProductRecognition = async (
  image: Blob,
  signal: AbortSignal,
): Promise<readonly VisualProductCandidate[]> => {
  const recognizer = visualProductRecognizer();

  if (recognizer === null) {
    throw new Error("Visual product recognizer is unavailable");
  }

  const result = await recognizer.recognize(image, signal);

  if (
    !Array.isArray(result) ||
    result.length > 10 ||
    !result.every(isCandidate)
  ) {
    throw new Error("Visual product recognizer returned invalid candidates");
  }

  return Object.freeze(
    result.slice(0, 10).map((candidate) =>
      Object.freeze({
        label: candidate.label,
        confidence: candidate.confidence,
      }),
    ),
  );
};
