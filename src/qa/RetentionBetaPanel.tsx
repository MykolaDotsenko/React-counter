import { useEffect, useMemo, useState } from "react";

import {
  RETENTION_BETA_EVENT_LIMIT,
  buildRetentionBetaExport,
  summarizeRetentionBeta,
  type RetentionBetaSession,
} from "./retention-beta";
import styles from "./RetentionBetaPanel.module.css";

export type RetentionBetaRecordingStatus =
  | "persisted"
  | "memory-only"
  | "recording-error"
  | "invalid-retained";

export interface RetentionBetaPanelProps {
  readonly session: RetentionBetaSession;
  readonly onReset: () => void;
  readonly resetDisabled?: boolean;
  readonly recordingStatus?: RetentionBetaRecordingStatus;
}

const seconds = (milliseconds: number | null): string =>
  milliseconds === null ? "—" : `${(milliseconds / 1_000).toFixed(2)} s`;

const exportFileName = (createdAt: string): string =>
  `retention-beta-${createdAt.replace(/[-:.]/g, "")}.json`;

export function RetentionBetaPanel({
  session,
  onReset,
  resetDisabled = false,
  recordingStatus = "persisted",
}: RetentionBetaPanelProps) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  const summary = useMemo(
    () => summarizeRetentionBeta(session),
    [session],
  );
  const exportBlocked = recordingStatus === "invalid-retained";

  useEffect(() => {
    document.title = "Shopping Budget Companion — Retention Beta";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }

    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.createElement("meta");
    description.name = "description";
    description.content =
      "Internal Shopping Budget Companion real-store retention beta with privacy-safe local evidence.";

    if (!description.isConnected) {
      document.head.append(description);
    }
  }, []);

  const buildEvidencePayload = (): {
    readonly json: string;
    readonly fileName: string;
  } | null => {
    if (exportBlocked) {
      setCopyStatus(
        "Export blocked — retained evidence failed validation. Reset only after recording the exclusion.",
      );
      return null;
    }

    try {
      const report = buildRetentionBetaExport(
        session,
        new Date().toISOString(),
      );

      return {
        json: JSON.stringify(report, null, 2),
        fileName: exportFileName(session.createdAt),
      };
    } catch {
      setCopyStatus(
        "Evidence export unavailable — check this device date and time, then try again.",
      );
      return null;
    }
  };

  const copyEvidence = async (): Promise<void> => {
    const payload = buildEvidencePayload();

    if (payload === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload.json);
      setCopyStatus("Evidence copied");
    } catch {
      setCopyStatus("Copy failed — evidence remains in local storage");
    }
  };

  const downloadEvidence = (): void => {
    const payload = buildEvidencePayload();

    if (payload === null) {
      return;
    }

    let objectUrl: string | null = null;

    try {
      const blob = new Blob([payload.json], {
        type: "application/json",
      });
      objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = payload.fileName;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();

      setCopyStatus(`Evidence downloaded as ${payload.fileName}`);
    } catch {
      setCopyStatus(
        "Download failed — evidence remains in local storage. Copy it instead.",
      );
    } finally {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
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

          {recordingStatus === "memory-only" ? (
            <p className={styles.warning} role="alert">
              Evidence storage is unavailable. New beta evidence is
              memory-only and may be lost on reload. Keep shopping data
              unaffected, but export this evidence before leaving the tab.
            </p>
          ) : null}

          {recordingStatus === "recording-error" ? (
            <p className={styles.warning} role="alert">
              Evidence recording encountered an internal error. Shopping
              remains unaffected, but this beta session may be incomplete
              and must not be treated as complete retention evidence.
            </p>
          ) : null}

          {recordingStatus === "invalid-retained" ? (
            <p className={styles.warning} role="alert">
              Retained beta evidence failed validation. Recording and
              export are frozen so the invalid data is not silently
              overwritten or mistaken for a fresh participant session.
              Record the exclusion first, then reset evidence to begin a
              new session.
            </p>
          ) : null}

          {session.events.length >= RETENTION_BETA_EVENT_LIMIT ? (
            <p className={styles.warning} role="alert">
              Evidence event capacity reached. Earlier events were
              preserved, but no additional beta events can be recorded.
              Export this session for audit and exclude it from primary
              cohort interpretation.
            </p>
          ) : null}

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
              <dt>Restores</dt>
              <dd>{summary.tripRestores}</dd>
            </div>
            <div>
              <dt>2nd trip ≤7d</dt>
              <dd>{summary.secondTripWithin7Days ? "Yes" : "Not yet"}</dd>
            </div>
            <div>
              <dt>2nd trip ≤14d</dt>
              <dd>{summary.secondTripWithin14Days ? "Yes" : "Not yet"}</dd>
            </div>
            <div>
              <dt>2nd trip ≤30d</dt>
              <dd>{summary.secondTripWithin30Days ? "Yes" : "Not yet"}</dd>
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
            <button
              type="button"
              disabled={exportBlocked}
              title={
                exportBlocked
                  ? "Reset invalid retained evidence before exporting a new session."
                  : undefined
              }
              onClick={downloadEvidence}
            >
              Download JSON evidence
            </button>
            <button
              type="button"
              disabled={exportBlocked}
              title={
                exportBlocked
                  ? "Reset invalid retained evidence before exporting a new session."
                  : undefined
              }
              onClick={copyEvidence}
            >
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
