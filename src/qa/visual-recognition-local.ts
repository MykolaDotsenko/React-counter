import {
  VISUAL_RECOGNITION_DEVICE,
  VISUAL_RECOGNITION_DTYPE,
  VISUAL_RECOGNITION_MODEL_ID,
  VISUAL_RECOGNITION_MODEL_REVISION,
} from "./visual-recognition-benchmark";

export interface VisualRecognitionCandidate {
  readonly label: string;
  readonly score: number;
}

export interface VisualRecognizer {
  recognize(
    image: HTMLCanvasElement | OffscreenCanvas | Blob,
    candidateLabels: readonly string[],
  ): Promise<readonly VisualRecognitionCandidate[]>;
  dispose(): Promise<void>;
}

export interface VisualRecognizerLoadProgress {
  readonly status: string;
  readonly progress: number | null;
}

export type VisualRecognizerProgressHandler = (
  progress: VisualRecognizerLoadProgress,
) => void;

const normalizeCandidateLabels = (
  labels: readonly string[],
): readonly string[] => {
  const normalized = labels.map((label) => label.trim());

  if (
    normalized.length < 2 ||
    normalized.length > 20 ||
    normalized.some(
      (label) => label.length === 0 || label.length > 120,
    ) ||
    new Set(normalized.map((label) => label.toLocaleLowerCase())).size !==
      normalized.length
  ) {
    throw new RangeError(
      "Visual benchmark requires 2–20 unique candidate labels",
    );
  }

  return Object.freeze(normalized);
};

const normalizeProgress = (
  value: unknown,
): VisualRecognizerLoadProgress => {
  if (typeof value !== "object" || value === null) {
    return Object.freeze({ status: "loading", progress: null });
  }

  const record = value as Record<string, unknown>;
  const progress =
    typeof record.progress === "number" &&
    Number.isFinite(record.progress)
      ? Math.max(0, Math.min(100, record.progress))
      : null;

  return Object.freeze({
    status:
      typeof record.status === "string"
        ? record.status.slice(0, 80)
        : "loading",
    progress,
  });
};

export const createLocalVisualRecognizer = async (
  onProgress?: VisualRecognizerProgressHandler,
): Promise<VisualRecognizer> => {
  const transformers = await import("@huggingface/transformers");
  const classifier = await transformers.pipeline(
    "zero-shot-image-classification",
    VISUAL_RECOGNITION_MODEL_ID,
    {
      revision: VISUAL_RECOGNITION_MODEL_REVISION,
      dtype: VISUAL_RECOGNITION_DTYPE,
      device: VISUAL_RECOGNITION_DEVICE,
      progress_callback: (value: unknown) => {
        onProgress?.(normalizeProgress(value));
      },
    },
  );

  return Object.freeze({
    async recognize(image, candidateLabels) {
      const labels = normalizeCandidateLabels(candidateLabels);
      const raw = await classifier(image, labels);
      const results = Array.isArray(raw) ? raw : [raw];

      const candidates = results
        .map((value) => {
          if (typeof value !== "object" || value === null) {
            return null;
          }

          const record = value as Record<string, unknown>;

          if (
            typeof record.label !== "string" ||
            !labels.includes(record.label) ||
            typeof record.score !== "number" ||
            !Number.isFinite(record.score)
          ) {
            return null;
          }

          return Object.freeze({
            label: record.label,
            score: Math.max(0, Math.min(1, record.score)),
          });
        })
        .filter(
          (value): value is VisualRecognitionCandidate => value !== null,
        )
        .sort((left, right) => right.score - left.score);

      if (candidates.length !== labels.length) {
        throw new Error(
          "Visual recognizer returned an incomplete candidate set",
        );
      }

      return Object.freeze(candidates);
    },
    async dispose() {
      if (
        "dispose" in classifier &&
        typeof classifier.dispose === "function"
      ) {
        await classifier.dispose();
      }
    },
  });
};

export const validateVisualCandidateLabels = (
  labels: readonly string[],
): readonly string[] => normalizeCandidateLabels(labels);
