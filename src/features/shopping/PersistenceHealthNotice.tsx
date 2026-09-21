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
  readonly context?: "active" | "completed" | "idle";
}

const retryIsMeaningful = (issue: PersistenceProblem): boolean =>
  ![
    "storage-unavailable",
    "legacy-retirement-failed",
    "invalid-history-entry",
    "history-conflict",
    "unsupported-version",
    "malformed-json",
    "invalid-envelope",
    "invalid-data",
  ].includes(issue.code);

const noticeCopy = (
  issue: PersistenceProblem,
  context: "active" | "completed" | "idle",
): {
  readonly title: string;
  readonly body: string;
  readonly risk: "trip" | "cleanup";
} => {
  if (context === "completed") {
    if (
      issue.code === "remove-failed" &&
      issue.storageKey === "budget-cart:active-trip"
    ) {
      return {
        title: "Trip saved — cleanup is incomplete",
        body:
          "Your completed trip is already in history, but an old active-trip copy could not be removed. Retry cleanup before leaving this summary.",
        risk: "cleanup",
      };
    }

    if (issue.storageKey === "budget-cart:history") {
      return {
        title: "Trip history is not fully saved",
        body:
          "This completed trip is still visible here, but the latest history change could not be stored safely. Retry before leaving this summary.",
        risk: "trip",
      };
    }
  }

  if (context === "idle" && issue.storageKey === "budget-cart:history") {
    switch (issue.code) {
      case "invalid-history-entry":
        return {
          title: "Some trip history could not be restored",
          body:
            "Valid completed trips are still available. At least one damaged history entry was ignored rather than guessed or overwritten.",
          risk: "cleanup",
        };
      case "history-conflict":
        return {
          title: "Trip history needs recovery",
          body:
            "Conflicting completed-trip records were preserved unchanged. Starting a new trip is still separate from resolving that history data.",
          risk: "cleanup",
        };
      default:
        return {
          title: "Trip history could not be read safely",
          body:
            "Saved history was preserved unchanged. The app will not overwrite data it cannot validate.",
          risk: "cleanup",
        };
    }
  }

  switch (issue.code) {
    case "legacy-retirement-failed":
      return {
        title: "Old app data could not be cleaned up",
        body:
          context === "active"
            ? "Your current shopping trip is still available. Old Pulse Counter data was left untouched and was not converted into shopping money."
            : "Old Pulse Counter data was left untouched and was not converted into shopping money.",
        risk: "cleanup",
      };
    case "storage-unavailable":
      return {
        title:
          context === "active"
            ? "This trip cannot be saved on this device"
            : "Shopping data cannot be saved on this device",
        body:
          context === "active"
            ? "Browser storage is unavailable. Your totals still work in this tab, but reloading or closing it can lose this trip."
            : "Browser storage is unavailable. Changes made in this tab may be lost after reload or close.",
        risk: "trip",
      };
    default:
      return {
        title:
          context === "active"
            ? "This trip is not being saved right now"
            : "Shopping data is not being saved right now",
        body:
          context === "active"
            ? "Keep this page open until checkout. Your totals still work in this tab, and you can retry saving without changing the cart."
            : "Keep this page open while you retry saving. The app will not claim durability until storage succeeds.",
        risk: "trip",
      };
  }
};

export function PersistenceHealthNotice({
  controller,
  health,
  context = "active",
}: PersistenceHealthNoticeProps) {
  const [retryMessage, setRetryMessage] = useState("");

  if (health.status === "healthy") {
    return null;
  }

  const copy = noticeCopy(health.issue, context);
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
        context === "active"
          ? "Still not saved. Keep this page open and try again later."
          : "Still not safely saved. Keep this page open and try again later.",
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
