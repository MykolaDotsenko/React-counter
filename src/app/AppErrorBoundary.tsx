import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

import styles from "./AppErrorBoundary.module.css";

export interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly failed: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    failed: false,
  };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      failed: true,
    };
  }

  public componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // Intentionally local-only: the production app has no remote telemetry.
  }

  public render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="app-error-title">
          <p className={styles.eyebrow}>Shopping Budget Companion</p>
          <h1 id="app-error-title">The app hit an unexpected problem</h1>
          <p>
            Reload the app to restore the latest trip that was successfully
            saved on this device.
          </p>
          <button
            type="button"
            className={styles.reload}
            onClick={() => {
              globalThis.location.reload();
            }}
          >
            Reload app
          </button>
        </section>
      </main>
    );
  }
}
