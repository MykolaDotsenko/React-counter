import { useEffect, useMemo, useState } from "react";

import {
  buildRetentionBetaExport,
  summarizeRetentionBeta,
  type RetentionBetaSession,
} from "./retention-beta";
import styles from "./RetentionBetaPanel.module.css";

export interface RetentionBetaPanelProps {
  readonly session: RetentionBetaSession;
  readonly onReset: () => void;
  readonly resetDisabled?: boolean;
}

const seconds = (milliseconds: number | null): string =>
  milliseconds === null ? "—" : `${(milliseconds / 1_000).toFixed(2)} s`;

export function RetentionBetaPanel({
  session,
  onReset,
  resetDisabled = false,
}: RetentionBetaPanelProps) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const summary = useMemo(
    () => summarizeRetentionBeta(session),
    [session],
  );

  useEffect(() => {
    document.title = "Budget Cart — Retention Beta";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }

    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );

    if (description !== null) {
      description.content =
        "Internal Budget Cart real-store retention beta with privacy-safe local evidence.";
    }
  }, []);

  const copyEvidence = async (): Promise<void> => {
    const report = buildRetentionBetaExport(
      session,
      new Date().toISOString(),
    );

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(report, null, 2),
      );
      setCopyStatus("Evidence copied");
    } catch {
      setCopyStatus("Copy failed — evidence remains in local storage");
    }
  };

  return (
    <aside className={styles.root} aria-label="Retention beta evidence">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setCopyStatus("");
          setResetArmed(false);
        }}
      >
        Beta evidence
      </button>

      {open ? (
        <div className={styles.panel}>
          <header>
            <p>Retention validation</p>
            <h2>Local beta evidence</h2>
          </header>

          <p className={styles.privacy}>
            Stored only on this device. No prices, budgets, item names,
            stores, camera content, or network telemetry are recorded.
          </p>

          <dl className={styles.metrics}>
            <div>
              <dt>Trips started</dt>
              <dd>{summary.tripsStarted}</dd>
            </div>
            <div>
              <dt>Trips finished</dt>
              <dd>{summary.tripsFinished}</dd>
            </div>
            <div>
              <dt>Second trip</dt>
              <dd>{summary.secondTripStarted ? "Reached" : "Not yet"}</dd>
            </div>
            <div>
              <dt>Third trip</dt>
              <dd>{summary.thirdTripStarted ? "Reached" : "Not yet"}</dd>
            </div>
            <div>
              <dt>Repeat starts</dt>
              <dd>{summary.repeatTripStarts}</dd>
            </div>
            <div>
              <dt>Reached 10 items</dt>
              <dd>{summary.tenthItemTrips} trips</dd>
            </div>
            <div>
              <dt>Remembered uses</dt>
              <dd>{summary.rememberedItemUses}</dd>
            </div>
            <div>
              <dt>Current-price overrides</dt>
              <dd>{summary.currentPriceOverrides}</dd>
            </div>
            <div>
              <dt>Manual entries</dt>
              <dd>{summary.manualEntriesCompleted}</dd>
            </div>
            <div>
              <dt>Median manual entry</dt>
              <dd>{seconds(summary.medianManualEntryMs)}</dd>
            </div>
            <div>
              <dt>Manual abandons</dt>
              <dd>{summary.manualEntriesAbandoned}</dd>
            </div>
          </dl>

          <p className={styles.note}>
            This recorder supports the real-store beta gate. It does not
            replace observation, interviews, one-hand testing, or cohort
            analysis.
          </p>

          <div className={styles.actions}>
            <button type="button" onClick={copyEvidence}>
              Copy privacy-safe evidence
            </button>
            <button
              type="button"
              className={styles.reset}
              disabled={resetDisabled}
              title={
                resetDisabled
                  ? "Finish or leave the active trip before resetting evidence."
                  : undefined
              }
              onClick={() => {
                if (!resetArmed) {
                  setResetArmed(true);
                  setCopyStatus("Press reset again to clear local evidence");
                  return;
                }

                onReset();
                setResetArmed(false);
                setCopyStatus("Evidence reset");
              }}
            >
              {resetArmed ? "Confirm reset" : "Reset evidence"}
            </button>
            {resetDisabled ? (
              <p className={styles.resetHint}>
                Finish or leave the active trip before resetting evidence.
              </p>
            ) : null}
          </div>

          {copyStatus ? (
            <p className={styles.status} role="status">
              {copyStatus}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
