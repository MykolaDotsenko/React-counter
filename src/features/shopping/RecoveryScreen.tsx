import { useState } from "react";

import { useShoppingAppState } from "../../application/react/use-shopping-app-state";
import type {
  PersistenceProblem,
  ShoppingAppController,
} from "../../application/shopping-app-controller";
import styles from "./RecoveryScreen.module.css";

export interface RecoveryScreenProps {
  readonly controller: ShoppingAppController;
}

const recoveryCopy = (
  issue: PersistenceProblem,
): {
  readonly title: string;
  readonly body: string;
} => {
  switch (issue.code) {
    case "unsupported-version":
      return {
        title: "Saved trip needs a newer app version",
        body:
          "This device contains shopping data written by a newer version. It has been preserved unchanged. Update the app to use it, or choose another way to continue below.",
      };
    case "malformed-json":
    case "invalid-envelope":
    case "invalid-data":
      return {
        title: "Saved trip needs recovery",
        body:
          "The saved shopping data could not be read safely. It has been preserved unchanged instead of being guessed into a cart.",
      };
    case "storage-unavailable":
      return {
        title: "Saved trip is unavailable",
        body:
          "Browser storage cannot be accessed right now. Check the browser's storage settings, then try reading the trip again.",
      };
    default:
      return {
        title: "Saved trip could not be restored safely",
        body:
          "The app stopped before changing the saved data. You can try reading it again without overwriting the preserved record.",
      };
  }
};

const canSetAside = (issue: PersistenceProblem): boolean =>
  [
    "malformed-json",
    "invalid-envelope",
    "invalid-data",
    "unsupported-version",
  ].includes(issue.code);

// Recovery unmounts once it is resolved; land focus on the next screen's
// heading rather than leaving it on <body>.
const focusNextScreen = (): void => {
  queueMicrotask(() => {
    document.querySelector<HTMLElement>("main h1[tabindex]")?.focus();
  });
};

export function RecoveryScreen({ controller }: RecoveryScreenProps) {
  const state = useShoppingAppState(controller);
  const [retryMessage, setRetryMessage] = useState("");

  if (state.lifecycle !== "recovery" || state.recovery === null) {
    return null;
  }

  const issue = state.recovery.issue;
  const copy = recoveryCopy(issue);
  const raw = state.recovery.raw;
  const setAsideAvailable = canSetAside(issue) && raw !== undefined;

  const retry = (): void => {
    setRetryMessage("");
    const next = controller.bootstrap();

    if (next.lifecycle === "recovery") {
      setRetryMessage(
        "The saved trip still cannot be restored safely. Nothing was overwritten.",
      );
      return;
    }

    focusNextScreen();
  };

  const setAside = (): void => {
    setRetryMessage("");
    const result = controller.setAsideUnreadableActiveTrip();

    if (!result.ok) {
      setRetryMessage(
        "The saved trip could not be set aside safely, so it was left unchanged.",
      );
      return;
    }

    focusNextScreen();
  };

  const continueWithoutSaving = (): void => {
    setRetryMessage("");

    if (controller.continueWithoutSaving().ok) {
      focusNextScreen();
    }
  };

  return (
    <main className={styles.screen}>
      <section
        className={styles.panel}
        aria-labelledby="recovery-title"
      >
        <div className={styles.icon} aria-hidden="true">
          !
        </div>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>Recovery mode</p>
          <h1 id="recovery-title">{copy.title}</h1>
          <p>{copy.body}</p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.retryButton} onClick={retry}>
            Try reading again
          </button>
          <p className={styles.safetyNote}>
            Trying again only reads the saved record; it never changes it.
          </p>
        </div>

        {retryMessage ? (
          <p className={styles.retryStatus} role="status" aria-live="polite">
            {retryMessage}
          </p>
        ) : null}

        <details className={styles.details}>
          <summary>Other ways to continue</summary>
          <p>
            Keep shopping without saving: totals, finished trips and
            remembered prices work in this tab only, and closing or reloading
            it loses them. The saved record stays untouched.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.retryButton}
              onClick={continueWithoutSaving}
            >
              Continue without saving
            </button>
          </div>
          {setAsideAvailable ? (
            <>
              <p>
                Set the unreadable trip aside: the app keeps an exact backup
                copy of it on this device, stops using it, and lets you start
                a new saved trip. The backup is not shown in the app.
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={setAside}
                >
                  Set aside and start fresh
                </button>
              </div>
            </>
          ) : null}
        </details>

        {raw !== undefined ? (
          <details className={styles.details}>
            <summary>Recovery details</summary>
            <p>
              This is the preserved raw record for diagnostics. Opening this
              section does not modify it.
            </p>
            <pre>{raw}</pre>
          </details>
        ) : null}
      </section>
    </main>
  );
}
