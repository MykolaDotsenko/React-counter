import { useEffect, useState } from "react";

import {
  APPEARANCE_MODES,
  applyAppearanceToDocument,
  persistAppearancePreference,
  readAppearancePreference,
  type AppearanceMode,
} from "./appearance";
import styles from "./AppearanceSwitcher.module.css";

const cameraToolHref = (route: string): string =>
  `${import.meta.env.BASE_URL}${route}/`;

const LABELS: Readonly<Record<AppearanceMode, string>> = Object.freeze({
  system: "System",
  light: "Light",
  dark: "Dark",
  aurora: "Aurora",
});

export function AppearanceSwitcher() {
  const [mode, setMode] = useState<AppearanceMode>(() =>
    readAppearancePreference(),
  );
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    applyAppearanceToDocument(mode);

    if (
      mode !== "system" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemChrome = () => {
      applyAppearanceToDocument("system", document, media.matches);
    };

    media.addEventListener?.("change", syncSystemChrome);

    return () => {
      media.removeEventListener?.("change", syncSystemChrome);
    };
  }, [mode]);

  const choose = (nextMode: AppearanceMode) => {
    setMode(nextMode);
    setSaveFailed(!persistAppearancePreference(nextMode));
    applyAppearanceToDocument(nextMode);
  };

  return (
    <section className={styles.appearance} aria-labelledby="appearance-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Appearance</p>
          <h2 id="appearance-title">Choose your look</h2>
        </div>
        <span className={styles.current}>{LABELS[mode]}</span>
      </div>

      <div className={styles.options} role="group" aria-label="Appearance theme">
        {APPEARANCE_MODES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={styles.option}
            aria-pressed={mode === candidate}
            data-mode={candidate}
            onClick={() => {
              choose(candidate);
            }}
          >
            <span className={styles.swatch} aria-hidden="true" />
            <span>{LABELS[candidate]}</span>
          </button>
        ))}
      </div>

      <p className={styles.hint}>
        System follows your device. Aurora is a visual mode; shopping data and
        calculations stay exactly the same.
      </p>

      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Camera tools</p>
          <h2>Scan & recognize</h2>
        </div>
        <span className={styles.current}>Experimental</span>
      </div>

      <div className={styles.toolOptions} aria-label="Camera and scanner tools">
        <a
          className={styles.option}
          href={cameraToolHref("barcode-benchmark")}
          target="_blank"
          rel="noreferrer"
        >
          Barcode scanner
        </a>
        <a
          className={styles.option}
          href={cameraToolHref("visual-recognition-benchmark")}
          target="_blank"
          rel="noreferrer"
        >
          Visual camera
        </a>
        <a
          className={styles.option}
          href={cameraToolHref("shelf-label-ocr-tesseract-benchmark")}
          target="_blank"
          rel="noreferrer"
        >
          Shelf-price OCR
        </a>
      </div>

      <p className={styles.hint}>
        Camera tools open in a new tab so your active trip stays intact. They do
        not auto-write a price into the cart; manual confirmation remains the
        financial authority.
      </p>

      {saveFailed ? (
        <p className={styles.saveWarning} role="status">
          Appearance changed for this session, but the preference could not be saved.
        </p>
      ) : null}
    </section>
  );
}
