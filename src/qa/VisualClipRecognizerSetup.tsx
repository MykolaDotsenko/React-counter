import { useState } from "react";

import {
  VISUAL_CLIP_MAX_FILE_BYTES,
  VISUAL_CLIP_MAX_LABELS,
  VISUAL_CLIP_MIN_LABELS,
  VISUAL_CLIP_MODEL_ID,
  VISUAL_CLIP_MODEL_REVISION,
  VISUAL_CLIP_TRANSFORMERS_VERSION,
  configureVisualClipRecognizer,
  parseVisualClipCatalog,
  visualClipCatalogFingerprint,
  type VisualClipCatalog,
} from "./visual-product-clip-recognizer";
import styles from "./BarcodeBenchmarkApp.module.css";

interface VisualClipRecognizerSetupProps {
  readonly disabled: boolean;
  readonly onConfigured: () => void;
  readonly onStatus: (message: string) => void;
}

interface LoadedCatalog {
  readonly catalog: VisualClipCatalog;
  readonly fingerprint: string;
}

const readCatalogFile = async (
  file: File,
): Promise<LoadedCatalog> => {
  if (
    file.size <= 0 ||
    file.size > VISUAL_CLIP_MAX_FILE_BYTES
  ) {
    throw new RangeError("Candidate catalog file size is invalid.");
  }

  const parsed: unknown = JSON.parse(await file.text());
  const catalog = parseVisualClipCatalog(parsed);

  if (catalog === null) {
    throw new RangeError("Candidate catalog schema is invalid.");
  }

  return {
    catalog,
    fingerprint: await visualClipCatalogFingerprint(catalog),
  };
};

export function VisualClipRecognizerSetup({
  disabled,
  onConfigured,
  onStatus,
}: VisualClipRecognizerSetupProps) {
  const [loadedCatalog, setLoadedCatalog] =
    useState<LoadedCatalog | null>(null);
  const [loading, setLoading] = useState(false);

  const selectCatalog = async (
    file: File | undefined,
  ): Promise<void> => {
    if (file === undefined) {
      return;
    }

    try {
      const loaded = await readCatalogFile(file);
      setLoadedCatalog(loaded);
      onStatus(
        `Candidate catalog loaded in page memory: ${loaded.catalog.labels.length} labels, fingerprint ${loaded.fingerprint.slice(0, 16)}…. No labels were persisted.`,
      );
    } catch {
      setLoadedCatalog(null);
      onStatus(
        `Candidate catalog rejected. Use schemaVersion 1 with ${VISUAL_CLIP_MIN_LABELS}–${VISUAL_CLIP_MAX_LABELS} unique product labels.`,
      );
    }
  };

  const loadRecognizer = async (): Promise<void> => {
    if (loadedCatalog === null || loading || disabled) {
      return;
    }

    setLoading(true);
    const started = performance.now();
    onStatus(
      "Loading the pinned local CLIP recognizer. First use may download model files; camera images and catalog labels are not sent for inference.",
    );

    try {
      const recognizer = await configureVisualClipRecognizer(
        loadedCatalog.catalog,
      );
      const seconds = Math.max(
        0,
        (performance.now() - started) / 1_000,
      ).toFixed(1);

      onConfigured();
      onStatus(
        `Recognizer configured as ${recognizer.id} after ${seconds}s setup. Start a fresh benchmark session before collecting evidence if the environment changed.`,
      );
    } catch {
      onStatus(
        "CLIP recognizer could not be loaded. Existing benchmark evidence was not changed; retry on a supported network/device or continue with manual interaction.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="clip-setup-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Concrete experiment</p>
          <h3 id="clip-setup-title">Local CLIP closed-set recognizer</h3>
        </div>
        <span className={styles.badge}>
          {loadedCatalog === null
            ? "Catalog required"
            : `${loadedCatalog.catalog.labels.length} labels`}
        </span>
      </div>

      <p className={styles.note}>
        This experiment uses Transformers.js {VISUAL_CLIP_TRANSFORMERS_VERSION}
        {" "}with {VISUAL_CLIP_MODEL_ID} pinned to model revision{" "}
        {VISUAL_CLIP_MODEL_REVISION.slice(0, 12)}…. Model files may be
        downloaded and browser-cached, but captured product images and candidate
        labels are processed locally. Scores are closed-set ranking scores, not
        calibrated certainty.
      </p>

      <label className={styles.field}>
        <span>Candidate product catalog JSON</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={disabled || loading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            void selectCatalog(file);
            event.currentTarget.value = "";
          }}
        />
      </label>

      <p className={styles.note}>
        Required format: {"{"}"schemaVersion":1,"labels":[...]{"]"}{"}"}. Use
        {" "}{VISUAL_CLIP_MIN_LABELS}–{VISUAL_CLIP_MAX_LABELS} unique,
        SKU-specific labels. Include same-brand size/flavour confusions rather
        than broad classes such as “milk” or “chocolate”.
      </p>

      {loadedCatalog === null ? null : (
        <dl className={styles.capabilities}>
          <div>
            <dt>Catalog fingerprint</dt>
            <dd>{loadedCatalog.fingerprint.slice(0, 16)}…</dd>
          </div>
          <div>
            <dt>Labels</dt>
            <dd>{loadedCatalog.catalog.labels.length}</dd>
          </div>
        </dl>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          disabled={
            disabled ||
            loading ||
            loadedCatalog === null
          }
          onClick={() => void loadRecognizer()}
        >
          {loading ? "Loading local CLIP…" : "Load local CLIP recognizer"}
        </button>
      </div>
    </section>
  );
}
