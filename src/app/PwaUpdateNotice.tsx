import { useRegisterSW } from "virtual:pwa-register/react";

import { useShoppingAppState } from "../application/react/use-shopping-app-state";
import type { ShoppingAppController } from "../application/shopping-app-controller";
import styles from "./PwaUpdateNotice.module.css";

export interface PwaUpdateNoticeProps {
  readonly controller: ShoppingAppController;
}

export function PwaUpdateNotice({
  controller,
}: PwaUpdateNoticeProps) {
  const state = useShoppingAppState(controller);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || state.lifecycle !== "idle") {
    return null;
  }

  return (
    <aside
      className={styles.notice}
      aria-label="App update available"
    >
      <div>
        <p className={styles.title}>A newer version is ready.</p>
        <p className={styles.copy} aria-live="polite">
          Update when convenient. Your saved shopping data stays on this
          device.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          type="button"
          onClick={() => {
            setNeedRefresh(false);
          }}
        >
          Later
        </button>
        <button
          className={styles.primary}
          type="button"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          Update app
        </button>
      </div>
    </aside>
  );
}
