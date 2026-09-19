import {
  addTransitionType,
  startTransition,
  useEffect,
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

export function useCounter() {
  const [state, dispatch] = useReducer(
    counterReducer,
    undefined,
    () => readCounterState(resolveStorage()),
  );
  const { value, step } = state;

  useEffect(() => {
    writeCounterState(resolveStorage(), { value, step });
  }, [value, step]);

  const runAction = (action, transitionType) => {
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
    runAction(command.action, command.transition);
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
