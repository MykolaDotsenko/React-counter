import { useEffect, useReducer } from "react";
import { counterReducer } from "./counter-model.js";
import { readCounterState, writeCounterState } from "./counter-storage.js";

const KEYBOARD_ACTIONS = Object.freeze({
  ArrowUp: { type: "increment" },
  ArrowRight: { type: "increment" },
  ArrowDown: { type: "decrement" },
  ArrowLeft: { type: "decrement" },
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

  const handleKeyboardAction = (event) => {
    if (event.currentTarget !== event.target) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

    const action = KEYBOARD_ACTIONS[event.key];
    if (!action) return;

    event.preventDefault();
    dispatch(action);
  };

  return {
    state,
    increment: () => dispatch({ type: "increment" }),
    decrement: () => dispatch({ type: "decrement" }),
    reset: () => dispatch({ type: "reset" }),
    setStep: (stepOption) => dispatch({ type: "set-step", step: stepOption }),
    handleKeyboardAction,
  };
}
