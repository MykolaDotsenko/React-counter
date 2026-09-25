import { useState } from "react";

import { useShoppingAppState } from "../../application/react/use-shopping-app-state";
import type {
  PersistenceProblem,
  ShoppingAppController,
} from "../../application/shopping-app-controller";
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

  const sessionOnly =
    state.persistence.status === "degraded" &&
    state.persistence.issue.code === "session-only";

  // In a session-only run the shopper chose not to touch stored data, and the
  // persistence notice already says nothing is being saved.
  if (state.historyIntegrity.status === "healthy" || sessionOnly) {
    return null;
  }

  const issue = state.historyIntegrity.issue;
  const copy = historyCopy(issue, state.completedTrips.length);
  const canSetAside = SET_ASIDE_CODES.includes(issue.code);
  const canRetry =
    issue.code === "read-failed" || issue.code === "storage-unavailable";

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

    if (!result.ok) {
      setConfirming(false);
      setStatusMessage(
        "History could not be set aside safely, so it was left unchanged.",
      );
    }
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
        {confirming ? (
          <>
            <p role="status" aria-live="polite">
              {`The unreadable record will be moved to a backup copy on this device and ${
                state.completedTrips.length === 0
                  ? "history will start empty"
                  : `${state.completedTrips.length} readable ${
                      state.completedTrips.length === 1 ? "trip" : "trips"
                    } will be kept`
              }.${state.activeTrip === null ? "" : " Your current trip is not affected."}`}
            </p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep as is
            </button>
          </>
        ) : null}
        {statusMessage ? (
          <p className={styles.retryStatus} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
      </div>
      {canSetAside ? (
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => {
            if (confirming) {
              setAside();
            } else {
              setStatusMessage("");
              setConfirming(true);
            }
          }}
        >
          {confirming ? "Set aside now" : "Set aside…"}
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
