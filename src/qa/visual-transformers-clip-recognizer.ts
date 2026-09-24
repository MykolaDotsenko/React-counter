import type {
  VisualProductCandidate,
  VisualProductRecognizer,
} from "./visual-product-benchmark-adapter";

export const VISUAL_CLIP_MODEL_ID =
  "Xenova/clip-vit-base-patch32";
export const VISUAL_CLIP_MODEL_REVISION = "d15189d";
export const VISUAL_CLIP_RUNTIME_VERSION = "4.3.0";

export type VisualClipDevice = "wasm" | "webgpu";

export interface VisualClipRecognizerConfig {
  readonly candidateLabels: readonly string[];
  readonly device: VisualClipDevice;
}

export interface VisualClipPreparationProgress {
  readonly message: string;
  readonly percent: number | null;
}

export interface PreparedVisualClipRecognizer {
  readonly recognizer: VisualProductRecognizer;
  dispose(): Promise<void>;
}

interface ZeroShotResult {
  readonly label: string;
  readonly score: number;
}

interface ZeroShotPipeline {
  (
    image: Blob,
    candidateLabels: readonly string[],
    options: {
      readonly hypothesis_template: string;
    },
  ): Promise<unknown>;
  dispose?: () => Promise<void> | void;
}

type PipelineLoader = (
  config: VisualClipRecognizerConfig,
  onProgress?: (
    progress: VisualClipPreparationProgress,
  ) => void,
) => Promise<ZeroShotPipeline>;

const LABEL_LIMIT = 30;
const LABEL_MINIMUM = 3;
const LABEL_LENGTH_LIMIT = 120;
const HYPOTHESIS_TEMPLATE = "a retail product package of {}";

const abortError = (): DOMException =>
  new DOMException("Visual recognition aborted", "AbortError");

const isZeroShotResult = (value: unknown): value is ZeroShotResult => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ZeroShotResult>;

  return (
    typeof candidate.label === "string" &&
    candidate.label.trim().length > 0 &&
    candidate.label.length <= LABEL_LENGTH_LIMIT &&
    typeof candidate.score === "number" &&
    Number.isFinite(candidate.score) &&
    candidate.score >= 0 &&
    candidate.score <= 1
  );
};

export const normalizeVisualClipLabels = (
  value: string | readonly string[],
): readonly string[] => {
  const raw = typeof value === "string" ? value.split(/\r?\n/) : value;
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    const label = entry.trim().replace(/\s+/g, " ");

    if (label.length === 0) {
      continue;
    }

    if (label.length > LABEL_LENGTH_LIMIT) {
      throw new RangeError(
        `Visual CLIP candidate labels must be <= ${LABEL_LENGTH_LIMIT} characters`,
      );
    }

    const key = label.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(label);
  }

  if (labels.length < LABEL_MINIMUM || labels.length > LABEL_LIMIT) {
    throw new RangeError(
      `Visual CLIP benchmark requires ${LABEL_MINIMUM}-${LABEL_LIMIT} unique candidate labels`,
    );
  }

  return Object.freeze(labels);
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const visualClipLabelSetDigest = async (
  labels: readonly string[],
): Promise<string> => {
  const normalized = normalizeVisualClipLabels(labels);
  const payload = new TextEncoder().encode(
    normalized.map((label) => label.toLowerCase()).join("\n"),
  );
  const digest = await crypto.subtle.digest("SHA-256", payload);

  return toHex(new Uint8Array(digest)).slice(0, 16);
};

const normalizeProgress = (
  value: unknown,
): VisualClipPreparationProgress => {
  if (typeof value !== "object" || value === null) {
    return {
      message: "Loading pinned CLIP model…",
      percent: null,
    };
  }

  const record = value as Record<string, unknown>;
  const status =
    typeof record.status === "string" ? record.status : "loading";
  const percent =
    typeof record.progress === "number" &&
    Number.isFinite(record.progress) &&
    record.progress >= 0 &&
    record.progress <= 100
      ? record.progress
      : null;

  return {
    message:
      status === "ready"
        ? "Pinned CLIP model ready."
        : status === "progress_total"
          ? "Downloading/loading pinned CLIP model…"
          : "Preparing pinned CLIP model…",
    percent,
  };
};

const defaultPipelineLoader: PipelineLoader = async (
  config,
  onProgress,
) => {
  const { pipeline } = await import("@huggingface/transformers");

  const classifier = await pipeline(
    "zero-shot-image-classification",
    VISUAL_CLIP_MODEL_ID,
    {
      revision: VISUAL_CLIP_MODEL_REVISION,
      device: config.device,
      progress_callback: (progress: unknown) => {
        onProgress?.(normalizeProgress(progress));
      },
    },
  );

  return classifier as unknown as ZeroShotPipeline;
};

export const prepareTransformersClipRecognizer = async (
  config: VisualClipRecognizerConfig,
  onProgress?: (
    progress: VisualClipPreparationProgress,
  ) => void,
  loadPipeline: PipelineLoader = defaultPipelineLoader,
): Promise<PreparedVisualClipRecognizer> => {
  const candidateLabels = normalizeVisualClipLabels(
    config.candidateLabels,
  );
  const labelSetDigest = await visualClipLabelSetDigest(candidateLabels);

  onProgress?.({
    message: "Preparing pinned CLIP model…",
    percent: null,
  });

  const classifier = await loadPipeline(
    {
      candidateLabels,
      device: config.device,
    },
    onProgress,
  );

  let disposed = false;

  const recognizer: VisualProductRecognizer = Object.freeze({
    id: [
      "tjs",
      VISUAL_CLIP_RUNTIME_VERSION,
      "clip-b32",
      VISUAL_CLIP_MODEL_REVISION,
      config.device,
      labelSetDigest,
    ].join(":"),
    dataBoundary: "local-only",
    async recognize(
      image: Blob,
      signal: AbortSignal,
    ): Promise<readonly VisualProductCandidate[]> {
      if (disposed) {
        throw new Error("Visual CLIP recognizer is disposed");
      }

      if (signal.aborted) {
        throw abortError();
      }

      const result = await classifier(image, candidateLabels, {
        hypothesis_template: HYPOTHESIS_TEMPLATE,
      });

      if (signal.aborted) {
        throw abortError();
      }

      if (
        !Array.isArray(result) ||
        result.length > LABEL_LIMIT ||
        !result.every(isZeroShotResult)
      ) {
        throw new Error(
          "Visual CLIP pipeline returned invalid candidates",
        );
      }

      return Object.freeze(
        result.slice(0, 10).map((candidate) =>
          Object.freeze({
            label: candidate.label,
            confidence: candidate.score,
          }),
        ),
      );
    },
  });

  return Object.freeze({
    recognizer,
    async dispose(): Promise<void> {
      if (disposed) {
        return;
      }

      disposed = true;
      await classifier.dispose?.();
    },
  });
};
