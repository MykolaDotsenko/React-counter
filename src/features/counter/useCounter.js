import {
  addTransitionType,
  startTransition,
  useLayoutEffect,
  useReducer,
} from "react";
import { counterReducer } from "./counter-model.js";
import { readCounterState, writeCounterState } from "./counter-storage.js";

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

const isWebKitEngine = () => {
  const userAgent = navigator.userAgent;
  return /AppleWebKit/i.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR)/i.test(userAgent);
};

const canUseViewTransitions = () => {
  if (typeof document === "undefined") return false;
  if (typeof document.startViewTransition !== "function") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;

  // WebKit 26.6 exposes the API but currently fails this React 19.3
  // transition path in our browser matrix. Keep the effect progressive:
  // behavior remains identical, only the native transition is skipped.
  return !isWebKitEngine();
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

  const runAction = (action, transitionType, { animate = true } = {}) => {
    if (!animate || !canUseViewTransitions()) {
      dispatch(action);
      return;
    }

    startTransition(() => {
      addTransitionType(transitionType);
      dispatch(action);
    });
  };

  const handleKeyboardAction = (event) => {
    if (event.currentTarget !== event.target) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

    const command = KEYBOARD_ACTIONS[event.key];
    if (!command) return;

    event.preventDefault();
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
