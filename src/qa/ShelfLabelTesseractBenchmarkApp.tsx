import { useEffect, useRef, useState } from "react";

import { App as BenchmarkApp } from "./ShelfLabelOcrBenchmarkApp";
import {
  installShelfLabelOcrEngine,
} from "./shelf-label-ocr-adapter";
import {
  prepareTesseractOcrEngine,
  TESSERACT_OCR_DATASET,
  TESSERACT_OCR_LANGUAGES,
  TESSERACT_OCR_RUNTIME_VERSION,
  type PreparedTesseractOcrEngine,
  type TesseractPreparationProgress,
} from "./tesseract-shelf-label-ocr";
import styles from "./BarcodeBenchmarkApp.module.css";

interface ActiveEngine {
  readonly prepared: PreparedTesseractOcrEngine;
  readonly uninstall: () => void;
}

export function App() {
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [progress, setProgress] =
    useState<TesseractPreparationProgress | null>(null);
  const [status, setStatus] = useState(
    "Prepare the pinned local OCR worker before timed attempts.",
  );
  const activeRef = useRef<ActiveEngine | null>(null);
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

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setPreparing(true);
    setProgress({
      message: "Preparing Tesseract OCR worker…",
      percent: null,
    });
    setStatus(
      "Worker/core/language preparation is outside timed OCR attempts.",
    );

    try {
      const next = await prepareTesseractOcrEngine((value) => {
        if (generationRef.current === generation) {
          setProgress(value);
        }
      });

      if (generationRef.current !== generation) {
        await next.dispose();
        return;
      }

      const uninstall = installShelfLabelOcrEngine(next.engine);
      activeRef.current = {
        prepared: next,
        uninstall,
      };
      setPrepared(true);
      setPreparing(false);
      setProgress({
        message: "Pinned Tesseract OCR worker ready.",
        percent: 100,
      });
      setStatus(
        "OCR engine ready. Timed evidence begins only inside the benchmark capture flow.",
      );
    } catch (error) {
      if (generationRef.current !== generation) {
        return;
      }

      setPreparing(false);
      setProgress(null);
      setStatus(
        error instanceof Error
          ? `OCR preparation failed: ${error.message}`
          : "OCR preparation failed.",
      );
    }
  };

  if (prepared) {
    return <BenchmarkApp />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Concrete OCR experiment</p>
        <h1>Tesseract.js shelf-label OCR benchmark</h1>
        <p className={styles.lead}>
          Prepare a pinned multilingual browser-local OCR worker, then reuse
          the existing shelf-label benchmark for camera → OCR → deterministic
          exact-money candidates → human decision.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="tesseract-model-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Pinned experiment</p>
            <h2 id="tesseract-model-title">OCR contract</h2>
          </div>
          <span className={styles.badge}>Local image inference</span>
        </div>

        <dl className={styles.capabilities}>
          <div>
            <dt>Runtime</dt>
            <dd>Tesseract.js {TESSERACT_OCR_RUNTIME_VERSION}</dd>
          </div>
          <div>
            <dt>Languages</dt>
            <dd>{TESSERACT_OCR_LANGUAGES.join(" + ")}</dd>
          </div>
          <div>
            <dt>Engine</dt>
            <dd>LSTM</dd>
          </div>
          <div>
            <dt>Language dataset</dt>
            <dd>{TESSERACT_OCR_DATASET}</dd>
          </div>
        </dl>

        <p className={styles.note}>
          Tesseract worker/core/language assets may be downloaded and cached
          by the browser. Camera image bytes stay inside browser-side OCR and
          are not uploaded by this adapter. Raw OCR text remains transient and
          only deterministic price candidates reach the review UI.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="tesseract-prepare-title">
        <p className={styles.eyebrow}>Benchmark preparation</p>
        <h2 id="tesseract-prepare-title">Load OCR worker before timing</h2>
        <p className={styles.note}>
          Model/language preparation is intentionally excluded from
          capture-to-human-decision timing. Record cold and warm preparation
          observations separately in issue #90.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => void prepare()}
            disabled={preparing}
          >
            {preparing
              ? "Preparing OCR…"
              : "Prepare pinned Tesseract OCR"}
          </button>
        </div>

        {progress === null ? null : (
          <div aria-live="polite">
            <p>{progress.message}</p>
            {progress.percent === null ? null : (
              <progress
                max={100}
                value={progress.percent}
                aria-label="Tesseract OCR preparation progress"
              >
                {progress.percent}%
              </progress>
            )}
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="tesseract-boundaries-title">
        <h2 id="tesseract-boundaries-title">Experiment boundaries</h2>
        <ul>
          <li>
            OCR worker preparation is outside the timed interaction.
          </li>
          <li>
            The existing exact-money parser remains the only money authority.
          </li>
          <li>
            Raw OCR text is transient and is never persisted in benchmark
            evidence.
          </li>
          <li>
            Timeout/abort terminates the active worker so OCR does not continue
            consuming CPU in the background.
          </li>
          <li>
            A weak result leads to remediation or deferral, not automatic
            price entry.
          </li>
        </ul>
      </section>

      <p className={styles.status} role="status">
        {status}
      </p>
    </main>
  );
}
