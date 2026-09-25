import { useEffect, useId, useRef, useState } from "react";

import { useShoppingAppState } from "../../application/react/use-shopping-app-state";
import type {
  PersistenceProblem,
  ShoppingAppController,
} from "../../application/shopping-app-controller";
import { isSessionOnly } from "../../application/session-only-persistence";
import styles from "./PersistenceHealthNotice.module.css";

export interface HistoryIntegrityNoticeProps {
  readonly controller: ShoppingAppController;
}

const SET_ASIDE_CODES = [
  "invalid-history-entry",
  "history-conflict",
  "malformed-json",
  "invalid-envelope",
  "invalid-data",
  "unsupported-version",
];

const historyCopy = (
  issue: PersistenceProblem,
  keptTripCount: number,
): { readonly title: string; readonly body: string } => {
  switch (issue.code) {
    case "invalid-history-entry":
      return {
        title: "Some trip history could not be restored",
        body: `${keptTripCount === 1 ? "1 completed trip is" : `${keptTripCount} completed trips are`} still available. The damaged part was preserved rather than guessed or overwritten, so finished trips can't be added to history until it is set aside.`,
      };
    case "unsupported-version":
      return {
        title: "Trip history was saved by a newer version",
        body:
          "This version can't read it, so it was preserved unchanged. Update the app to use it, or set it aside to keep finishing trips here.",
      };
    case "read-failed":
    case "storage-unavailable":
      return {
        title: "Trip history can't be read right now",
        body:
          "Browser storage did not return the saved history. Nothing was changed; try reading it again.",
      };
    default:
      return {
        title: "Trip history could not be read safely",
        body:
          "Saved history was preserved unchanged instead of being guessed. Finished trips can't be added to it until it is set aside.",
      };
  }
};

export function HistoryIntegrityNotice({
  controller,
}: HistoryIntegrityNoticeProps) {
  const state = useShoppingAppState(controller);
  const [confirming, setConfirming] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [resolved, setResolved] = useState(false);
  const panelId = useId();
  const resolvedRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (resolved) {
      resolvedRef.current?.focus();
    }
  }, [resolved]);

  const sessionOnly = isSessionOnly(state.persistence);

  if (state.historyIntegrity.status === "healthy") {
    return resolved ? (
      <aside
        className={styles.notice}
        data-risk="cleanup"
        aria-labelledby="history-integrity-title"
      >
        <span className={styles.marker} aria-hidden="true">
          ✓
        </span>
        <div className={styles.copy}>
          <strong id="history-integrity-title">Trip history is readable again</strong>
          <p ref={resolvedRef} tabIndex={-1} role="status">
            The damaged record was set aside as a backup copy on this device.
          </p>
        </div>
      </aside>
    ) : null;
  }

  // In a session-only run the shopper chose not to touch stored data, and the
  // persistence notice already says nothing is being saved.
  if (sessionOnly) {
    return null;
  }

  const issue = state.historyIntegrity.issue;
  const copy = historyCopy(issue, state.completedTrips.length);
  // History repair waits until the finished-trip summary is closed.
  const inSummary = state.lifecycle === "completed-summary";
  const canSetAside = !inSummary && SET_ASIDE_CODES.includes(issue.code);
  const canRetry =
    !inSummary &&
    (issue.code === "read-failed" || issue.code === "storage-unavailable");
  const keptCount = state.completedTrips.length;

  const retry = (): void => {
    setStatusMessage("");
    const result = controller.retryHistoryRead();

    if (result.state.historyIntegrity.status === "degraded") {
      setStatusMessage("History still can't be read. Nothing was changed.");
    }
  };

  const setAside = (): void => {
    setStatusMessage("");
    const result = controller.setAsideDamagedHistory();

    if (result.ok) {
      setResolved(true);
      return;
    }

    setConfirming(false);
    setStatusMessage(
      "History could not be set aside safely, so it was left unchanged.",
    );
  };

  return (
    <aside
      className={styles.notice}
      data-risk="trip"
      aria-labelledby="history-integrity-title"
    >
      <span className={styles.marker} aria-hidden="true">
        !
      </span>
      <div className={styles.copy}>
        <strong id="history-integrity-title">{copy.title}</strong>
        <p>{copy.body}</p>
        {inSummary ? <p>You can set it aside after closing this summary.</p> : null}
        {confirming ? (
          <div id={panelId} className={styles.copy}>
            <p>
              {`The unreadable record will be moved to a backup copy on this device and ${
                keptCount === 0
                  ? "history will start empty"
                  : `${keptCount} readable ${keptCount === 1 ? "trip" : "trips"} will be kept`
              }.${state.activeTrip === null ? "" : " Your current trip is not affected."}`}
            </p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={setAside}
            >
              Set aside now
            </button>
          </div>
        ) : null}
        {statusMessage ? (
          <p className={styles.retryStatus} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
      </div>
      {canSetAside ? (
        // The confirming action appears elsewhere, and focus stays here, so a
        // double tap or a repeated key arms and then cancels, never confirms.
        <button
          type="button"
          className={styles.retryButton}
          aria-expanded={confirming}
          {...(confirming ? { "aria-controls": panelId } : {})}
          onClick={() => {
            setStatusMessage("");
            setConfirming((current) => !current);
          }}
        >
          {confirming ? "Keep as is" : "Set aside…"}
        </button>
      ) : null}
      {canRetry ? (
        <button type="button" className={styles.retryButton} onClick={retry}>
          Retry
        </button>
      ) : null}
    </aside>
  );
}
