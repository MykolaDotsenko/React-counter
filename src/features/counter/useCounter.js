import { useLayoutEffect, useReducer } from "react";
import { flushSync } from "react-dom";
import { counterReducer } from "./counter-model.js";
import { readCounterState, writeCounterState } from "./counter-storage.js";

const TRANSITION_COMMIT_WATCHDOG_MS = 120;

const KEYBOARD_ACTIONS = Object.freeze({
  ArrowUp: { action: { type: "increment" }, transition: "increment" },
  ArrowRight: { action: { type: "increment" }, transition: "increment" },
  ArrowDown: { action: { type: "decrement" }, transition: "decrement" },
  ArrowLeft: { action: { type: "decrement" }, transition: "decrement" },
});

const resolveStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const supportsTypedViewTransitions = () => {
  try {
    if (typeof document === "undefined") return false;
    if (typeof document.startViewTransition !== "function") return false;
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
    if (!CSS.supports("selector(:active-view-transition-type(increment))")) return false;

    return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

export function useCounter() {
  const [state, dispatch] = useReducer(
    counterReducer,
    undefined,
    () => readCounterState(resolveStorage()),
  );
  const { value, step } = state;

  useLayoutEffect(() => {
    writeCounterState(resolveStorage(), { value, step });
  }, [value, step]);

  const commitAction = (action) => {
    flushSync(() => {
      dispatch(action);
    });
  };

  const runAction = (action, transitionType, { animate = true } = {}) => {
    if (!animate || !supportsTypedViewTransitions()) {
      dispatch(action);
      return;
    }

    let committed = false;
    let watchdogId = null;

    const commitOnce = () => {
      if (committed) return;
      committed = true;
      commitAction(action);
    };

    try {
      document.activeViewTransition?.skipTransition();

      const transition = document.startViewTransition({
        update: commitOnce,
        types: [transitionType],
      });

      watchdogId = window.setTimeout(() => {
        if (committed) return;

        transition.skipTransition();
        commitOnce();
      }, TRANSITION_COMMIT_WATCHDOG_MS);

      transition.updateCallbackDone
        .catch(() => {
          commitOnce();
        })
        .finally(() => {
          if (watchdogId !== null) {
            window.clearTimeout(watchdogId);
          }
        });

      transition.finished.catch(() => {
        // A skipped or interrupted visual transition is non-fatal.
        // The reducer commit remains the source of truth.
      });
    } catch {
      if (watchdogId !== null) {
        window.clearTimeout(watchdogId);
      }
      commitOnce();
    }
  };

  const handleKeyboardAction = (event) => {
    if (event.currentTarget !== event.target) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

    const command = KEYBOARD_ACTIONS[event.key];
    if (!command) return;

    event.preventDefault();

    // Keyboard commands prioritize immediate response and predictable focus.
    runAction(command.action, command.transition, { animate: false });
  };

  return {
    state,
    increment: () => runAction({ type: "increment" }, "increment"),
    decrement: () => runAction({ type: "decrement" }, "decrement"),
    reset: () => runAction({ type: "reset" }, "reset"),
    setStep: (stepOption) =>
      runAction({ type: "set-step", step: stepOption }, "step"),
    handleKeyboardAction,
  };
}
