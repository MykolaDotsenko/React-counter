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

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const resolveStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const prefersReducedMotion = () => {
  try {
    return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
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

  const runAction = (action, transitionType, { animate = true } = {}) => {
    if (!animate || prefersReducedMotion()) {
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
