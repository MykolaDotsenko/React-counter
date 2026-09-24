import {
  installVisualProductRecognizer,
  type VisualProductCandidate,
  type VisualProductRecognizer,
} from "./visual-product-benchmark-adapter";

export const VISUAL_CLIP_CATALOG_SCHEMA_VERSION = 1;
export const VISUAL_CLIP_MIN_LABELS = 3;
export const VISUAL_CLIP_MAX_LABELS = 30;
export const VISUAL_CLIP_MAX_FILE_BYTES = 64 * 1024;
export const VISUAL_CLIP_MODEL_ID = "Xenova/clip-vit-base-patch32";
export const VISUAL_CLIP_MODEL_REVISION =
  "d15189d7028b43f1d3e65039190477f6af591c2a";
export const VISUAL_CLIP_TRANSFORMERS_VERSION = "4.3.0";
export const VISUAL_CLIP_PROMPT_VERSION = "retail-package-v1";

const HYPOTHESIS_TEMPLATE = "a photo of the retail product {}";

export interface VisualClipCatalog {
  readonly schemaVersion: 1;
  readonly labels: readonly string[];
}

export type VisualClipDevice = "webgpu" | "wasm";

interface VisualClipRawCandidate {
  readonly label: string;
  readonly score: number;
}

export type VisualClipClassifier = (
  image: Blob,
  labels: readonly string[],
  options: {
    readonly hypothesis_template: string;
  },
) => Promise<unknown>;

export type VisualClipClassifierLoader = () => Promise<{
  readonly classifier: VisualClipClassifier;
  readonly device: VisualClipDevice;
}>;

const exactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const normalizeLabel = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export const parseVisualClipCatalog = (
  value: unknown,
): VisualClipCatalog | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !exactKeys(record, ["schemaVersion", "labels"]) ||
    record.schemaVersion !== VISUAL_CLIP_CATALOG_SCHEMA_VERSION ||
    !Array.isArray(record.labels) ||
    record.labels.length < VISUAL_CLIP_MIN_LABELS ||
    record.labels.length > VISUAL_CLIP_MAX_LABELS ||
    !record.labels.every(
      (label) =>
        typeof label === "string" &&
        normalizeLabel(label).length >= 2 &&
        normalizeLabel(label).length <= 120,
    )
  ) {
    return null;
  }

  const labels = record.labels.map((label) =>
    normalizeLabel(label as string),
  );
  const normalizedKeys = labels.map((label) => label.toLowerCase());

  if (new Set(normalizedKeys).size !== labels.length) {
    return null;
  }

  return Object.freeze({
    schemaVersion: 1,
    labels: Object.freeze(labels),
  });
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

export const visualClipCatalogFingerprint = async (
  catalog: VisualClipCatalog,
): Promise<string> => {
  const canonical = JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    labels: catalog.labels,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );

  return toHex(new Uint8Array(digest));
};

const isRawCandidate = (
  value: unknown,
): value is VisualClipRawCandidate => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VisualClipRawCandidate>;

  return (
    typeof candidate.label === "string" &&
    typeof candidate.score === "number" &&
    Number.isFinite(candidate.score) &&
    candidate.score >= 0 &&
    candidate.score <= 1
  );
};

export const normalizeVisualClipCandidates = (
  value: unknown,
  catalog: VisualClipCatalog,
): readonly VisualProductCandidate[] => {
  if (!Array.isArray(value)) {
    throw new Error("CLIP recognizer returned a non-array result");
  }

  const allowed = new Set(catalog.labels);

  if (
    value.length > VISUAL_CLIP_MAX_LABELS ||
    !value.every(isRawCandidate) ||
    value.some((candidate) => !allowed.has(candidate.label))
  ) {
    throw new Error("CLIP recognizer returned invalid candidates");
  }

  const seen = new Set<string>();
  const normalized: VisualProductCandidate[] = [];

  for (const candidate of [...value].sort(
    (left, right) => right.score - left.score,
  )) {
    if (seen.has(candidate.label)) {
      continue;
    }

    seen.add(candidate.label);
    normalized.push(
      Object.freeze({
        label: candidate.label,
        confidence: candidate.score,
      }),
    );

    if (normalized.length >= 10) {
      break;
    }
  }

  return Object.freeze(normalized);
};

const abortError = (): DOMException =>
  new DOMException("Visual recognition aborted", "AbortError");

const withAbort = async <T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  if (signal.aborted) {
    throw abortError();
  }

  let onAbort: (() => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([work, aborted]);
  } finally {
    if (onAbort !== null) {
      signal.removeEventListener("abort", onAbort);
    }
  }
};

const hasWebGpu = (): boolean =>
  "gpu" in (navigator as Navigator & { readonly gpu?: unknown });

export const loadDefaultVisualClipClassifier: VisualClipClassifierLoader =
  async () => {
    const { pipeline } = await import("@huggingface/transformers");

    const load = async (
      device: VisualClipDevice,
    ): Promise<VisualClipClassifier> => {
      const classifier = await pipeline(
        "zero-shot-image-classification",
        VISUAL_CLIP_MODEL_ID,
        {
          revision: VISUAL_CLIP_MODEL_REVISION,
          device,
        },
      );

      return classifier as unknown as VisualClipClassifier;
    };

    if (hasWebGpu()) {
      try {
        return {
          classifier: await load("webgpu"),
          device: "webgpu",
        };
      } catch {
        // The benchmark still needs a deterministic local fallback on
        // browsers/devices where WebGPU model initialization fails.
      }
    }

    return {
      classifier: await load("wasm"),
      device: "wasm",
    };
  };

export const createVisualClipRecognizer = async (
  catalog: VisualClipCatalog,
  loadClassifier: VisualClipClassifierLoader =
    loadDefaultVisualClipClassifier,
): Promise<VisualProductRecognizer> => {
  const fingerprint = await visualClipCatalogFingerprint(catalog);
  const { classifier, device } = await loadClassifier();
  const id = [
    "hf-clip32",
    "tjs-" + VISUAL_CLIP_TRANSFORMERS_VERSION,
    "model-" + VISUAL_CLIP_MODEL_REVISION.slice(0, 12),
    device,
    "catalog-" + fingerprint.slice(0, 16),
    VISUAL_CLIP_PROMPT_VERSION,
  ].join(":");

  return Object.freeze({
    id,
    dataBoundary: "local-only" as const,
    recognize: async (
      image: Blob,
      signal: AbortSignal,
    ): Promise<readonly VisualProductCandidate[]> => {
      const result = await withAbort(
        classifier(image, catalog.labels, {
          hypothesis_template: HYPOTHESIS_TEMPLATE,
        }),
        signal,
      );

      if (signal.aborted) {
        throw abortError();
      }

      return normalizeVisualClipCandidates(result, catalog);
    },
  });
};

export const configureVisualClipRecognizer = async (
  catalog: VisualClipCatalog,
  loadClassifier?: VisualClipClassifierLoader,
): Promise<VisualProductRecognizer> => {
  const recognizer = await createVisualClipRecognizer(
    catalog,
    loadClassifier,
  );
  installVisualProductRecognizer(recognizer);

  return recognizer;
};
