import { useState } from "react";

import type {
  PersistenceHealth,
  PersistenceProblem,
  ShoppingAppController,
} from "../../application/shopping-app-controller";
import styles from "./PersistenceHealthNotice.module.css";

export interface PersistenceHealthNoticeProps {
  readonly controller: ShoppingAppController;
  readonly health: PersistenceHealth;
}

const retryIsMeaningful = (issue: PersistenceProblem): boolean =>
  issue.code !== "storage-unavailable" &&
  issue.code !== "legacy-retirement-failed";

const noticeCopy = (
  issue: PersistenceProblem,
): {
  readonly title: string;
  readonly body: string;
  readonly risk: "trip" | "cleanup";
} => {
  switch (issue.code) {
    case "legacy-retirement-failed":
      return {
        title: "Old app data could not be cleaned up",
        body:
          "Your current shopping trip is still available. Old Pulse Counter data was left untouched and was not converted into shopping money.",
        risk: "cleanup",
      };
    case "storage-unavailable":
      return {
        title: "This trip cannot be saved on this device",
        body:
          "Browser storage is unavailable. Your totals still work in this tab, but reloading or closing it can lose this trip.",
        risk: "trip",
      };
    default:
      return {
        title: "This trip is not being saved right now",
        body:
          "Keep this page open until checkout. Your totals still work in this tab, and you can retry saving without changing the cart.",
        risk: "trip",
      };
  }
};

export function PersistenceHealthNotice({
  controller,
  health,
}: PersistenceHealthNoticeProps) {
  const [retryMessage, setRetryMessage] = useState("");

  if (health.status === "healthy") {
    return null;
  }

  const copy = noticeCopy(health.issue);
  const canRetry = retryIsMeaningful(health.issue);

  const retry = (): void => {
    setRetryMessage("");

    const result = controller.retryPersistence();

    if (!result.ok) {
      setRetryMessage("Saving cannot be retried from the current app state.");
      return;
    }

    if (result.durability === "memory-only") {
      setRetryMessage(
        "Still not saved. Keep this page open and try again later.",
      );
    }
  };

  return (
    <aside
      className={styles.notice}
      data-risk={copy.risk}
      aria-labelledby="persistence-notice-title"
    >
      <span className={styles.marker} aria-hidden="true">
        !
      </span>
      <div className={styles.copy}>
        <strong id="persistence-notice-title">{copy.title}</strong>
        <p>{copy.body}</p>
        {retryMessage ? (
          <p className={styles.retryStatus} role="status" aria-live="polite">
            {retryMessage}
          </p>
        ) : null}
      </div>
      {canRetry ? (
        <button type="button" className={styles.retryButton} onClick={retry}>
          Retry
        </button>
      ) : null}
    </aside>
  );
}
