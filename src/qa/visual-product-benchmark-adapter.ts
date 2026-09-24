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
}

type VisualRecognizerGlobal = typeof globalThis & {
  __SBC_VISUAL_PRODUCT_RECOGNIZER__?: VisualProductRecognizer;
};

const isRecognizer = (
  value: unknown,
): value is VisualProductRecognizer => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const recognizer = value as Partial<VisualProductRecognizer>;

  return (
    typeof recognizer.id === "string" &&
    recognizer.id.trim().length > 0 &&
    recognizer.id.length <= 160 &&
    (recognizer.dataBoundary === "local-only" ||
      recognizer.dataBoundary === "remote-image") &&
    typeof recognizer.recognize === "function"
  );
};

export const installVisualProductRecognizer = (
  recognizer: VisualProductRecognizer,
): (() => void) => {
  if (!isRecognizer(recognizer)) {
    throw new RangeError("Invalid visual product recognizer");
  }

  const target = globalThis as VisualRecognizerGlobal;
  const previous = target.__SBC_VISUAL_PRODUCT_RECOGNIZER__;
  target.__SBC_VISUAL_PRODUCT_RECOGNIZER__ = recognizer;

  return () => {
    if (target.__SBC_VISUAL_PRODUCT_RECOGNIZER__ === recognizer) {
      if (previous === undefined) {
        Reflect.deleteProperty(
          target,
          "__SBC_VISUAL_PRODUCT_RECOGNIZER__",
        );
      } else {
        target.__SBC_VISUAL_PRODUCT_RECOGNIZER__ = previous;
      }
    }
  };
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

    if (!isRecognizer(recognizer)) {
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
