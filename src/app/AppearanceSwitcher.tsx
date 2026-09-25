import { useEffect, useState } from "react";

import {
  APPEARANCE_MODES,
  applyAppearanceToDocument,
  persistAppearancePreference,
  readAppearancePreference,
  type AppearanceMode,
} from "./appearance";
import styles from "./AppearanceSwitcher.module.css";

const LABELS: Readonly<Record<AppearanceMode, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  aurora: "Aurora",
};

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
          <h2 id="appearance-title">Choose a look</h2>
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
        System follows your device. Aurora changes visuals only; shopping data and
        calculations stay unchanged.
      </p>

      <a
        className={styles.option}
        href="./camera-tools/"
        target="_blank"
      >
        Scanner & camera
      </a>

      {saveFailed ? (
        <p className={styles.saveWarning} role="status">
          Appearance changed for this session but could not be saved.
        </p>
      ) : null}
    </section>
  );
}
