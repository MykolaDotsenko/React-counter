import { useEffect, useRef, useState } from "react";

import { App as BenchmarkApp } from "./VisualProductBenchmarkApp";
import {
  installVisualProductRecognizer,
} from "./visual-product-benchmark-adapter";
import {
  normalizeVisualClipLabels,
  prepareTransformersClipRecognizer,
  VISUAL_CLIP_MODEL_ID,
  VISUAL_CLIP_MODEL_REVISION,
  VISUAL_CLIP_RUNTIME_VERSION,
  type PreparedVisualClipRecognizer,
  type VisualClipDevice,
  type VisualClipPreparationProgress,
} from "./visual-transformers-clip-recognizer";
import styles from "./BarcodeBenchmarkApp.module.css";

interface ActiveRecognizer {
  readonly prepared: PreparedVisualClipRecognizer;
  readonly uninstall: () => void;
}

const webGpuAvailable = (): boolean =>
  typeof navigator !== "undefined" && "gpu" in navigator;

export function App() {
  const [candidateText, setCandidateText] = useState("");
  const [device, setDevice] = useState<VisualClipDevice>("wasm");
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [progress, setProgress] =
    useState<VisualClipPreparationProgress | null>(null);
  const [status, setStatus] = useState(
    "Configure one fixed candidate set before starting the benchmark.",
  );
  const activeRef = useRef<ActiveRecognizer | null>(null);
  const generationRef = useRef(0);

  useEffect(
    () => () => {
      generationRef.current += 1;
      const active = activeRef.current;
      activeRef.current = null;
      active?.uninstall();
      if (active !== null) {
        void active.prepared.dispose();
      }
    },
    [],
  );

  const prepare = async (): Promise<void> => {
    if (preparing || prepared) {
      return;
    }

    let labels: readonly string[];

    try {
      labels = normalizeVisualClipLabels(candidateText);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Candidate labels are invalid.",
      );
      return;
    }

    if (device === "webgpu" && !webGpuAvailable()) {
      setStatus(
        "WebGPU is unavailable in this browser. Use the WASM baseline.",
      );
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setPreparing(true);
    setProgress({
      message: "Preparing pinned CLIP model…",
      percent: null,
    });
    setStatus(
      "Model preparation is outside timed recognition attempts. Keep this page open until loading completes.",
    );

    try {
      const next = await prepareTransformersClipRecognizer(
        {
          candidateLabels: labels,
          device,
        },
        (value) => {
          if (generationRef.current === generation) {
            setProgress(value);
          }
        },
      );

      if (generationRef.current !== generation) {
        await next.dispose();
        return;
      }

      const uninstall = installVisualProductRecognizer(next.recognizer);
      activeRef.current = {
        prepared: next,
        uninstall,
      };
      setPrepared(true);
      setPreparing(false);
      setProgress({
        message: "Pinned CLIP recognizer ready.",
        percent: 100,
      });
      setStatus(
        "Recognizer ready. Timed evidence starts only inside the benchmark attempt.",
      );
    } catch (error) {
      if (generationRef.current !== generation) {
        return;
      }

      setPreparing(false);
      setProgress(null);
      setStatus(
        error instanceof Error
          ? `Recognizer preparation failed: ${error.message}`
          : "Recognizer preparation failed.",
      );
    }
  };

  if (prepared) {
    return <BenchmarkApp />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Concrete model experiment</p>
        <h1>Transformers.js CLIP retail benchmark</h1>
        <p className={styles.lead}>
          Configure one closed candidate set, load the pinned CLIP model
          locally in this browser, then use the existing visual benchmark to
          measure camera → ranked candidate → human decision.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="clip-model-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Pinned experiment</p>
            <h2 id="clip-model-title">Model contract</h2>
          </div>
          <span className={styles.badge}>Local image inference</span>
        </div>

        <dl className={styles.capabilities}>
          <div>
            <dt>Runtime</dt>
            <dd>Transformers.js {VISUAL_CLIP_RUNTIME_VERSION}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{VISUAL_CLIP_MODEL_ID}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{VISUAL_CLIP_MODEL_REVISION}</dd>
          </div>
          <div>
            <dt>Candidate mode</dt>
            <dd>Closed-set zero-shot labels</dd>
          </div>
        </dl>

        <p className={styles.note}>
          Model/config assets are downloaded from the Hugging Face Hub and may
          be cached by the browser. Camera frames and candidate labels are not
          uploaded by this adapter. Candidate labels stay in page memory and
          are represented in evidence only by a one-way label-set digest
          inside the recognizer ID.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="clip-setup-title">
        <p className={styles.eyebrow}>Benchmark configuration</p>
        <h2 id="clip-setup-title">Freeze the candidate set</h2>

        <label className={styles.field}>
          <span>Candidate product labels · one per line · 3–30 unique</span>
          <textarea
            rows={10}
            maxLength={4_000}
            value={candidateText}
            disabled={preparing}
            placeholder={
              "Brand product variant size\nBrand product variant size\nBrand product variant size"
            }
            onChange={(event) => {
              setCandidateText(event.currentTarget.value);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>Inference device</span>
          <select
            value={device}
            disabled={preparing}
            onChange={(event) => {
              setDevice(
                event.currentTarget.value === "webgpu"
                  ? "webgpu"
                  : "wasm",
              );
            }}
          >
            <option value="wasm">WASM · compatibility baseline</option>
            <option value="webgpu" disabled={!webGpuAvailable()}>
              WebGPU · accelerated experimental path
            </option>
          </select>
        </label>

        <p className={styles.note}>
          Use exact retail variants, not broad categories. Keep the same
          candidate set and inference device for every retained session in one
          analytical cohort.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => void prepare()}
            disabled={preparing}
          >
            {preparing ? "Preparing model…" : "Prepare pinned recognizer"}
          </button>
        </div>

        {progress === null ? null : (
          <div aria-live="polite">
            <p>{progress.message}</p>
            {progress.percent === null ? null : (
              <progress
                max={100}
                value={progress.percent}
                aria-label="CLIP model preparation progress"
              >
                {progress.percent}%
              </progress>
            )}
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="clip-boundaries-title">
        <h2 id="clip-boundaries-title">Experiment boundaries</h2>
        <ul>
          <li>
            Model loading is not counted as recognition interaction time.
          </li>
          <li>
            The timed benchmark begins only after the recognizer is ready.
          </li>
          <li>
            Zero-shot CLIP is a baseline hypothesis, not a claim of SKU-level
            production quality.
          </li>
          <li>
            Same-brand size/flavour confusions must be retained as failures or
            lower-ranked confirmations, not relabelled after the fact.
          </li>
          <li>
            A weak result should lead to remediation or deferral, not lower
            confidence thresholds or automatic cart mutation.
          </li>
        </ul>
      </section>

      <p className={styles.status} role="status">
        {status}
      </p>
    </main>
  );
}
