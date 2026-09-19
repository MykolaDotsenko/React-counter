import { useEffect, useReducer } from "react";
import { counterReducer } from "./counter-model.js";
import { readCounterState, writeCounterState } from "./counter-storage.js";

const resolveStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isEditableTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

export const useCounter = () => {
  const [state, dispatch] = useReducer(
    counterReducer,
    undefined,
    () => readCounterState(resolveStorage()),
  );
  const { value, step } = state;

  useEffect(() => {
    writeCounterState(resolveStorage(), { value, step });
  }, [value, step]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const actionByKey = {
        ArrowUp: { type: "increment" },
        ArrowRight: { type: "increment" },
        ArrowDown: { type: "decrement" },
        ArrowLeft: { type: "decrement" },
        Home: { type: "reset" },
        r: { type: "reset" },
        R: { type: "reset" },
      };

      const action = actionByKey[event.key];
      if (!action) return;

      event.preventDefault();
      dispatch(action);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    state,
    increment: () => dispatch({ type: "increment" }),
    decrement: () => dispatch({ type: "decrement" }),
    reset: () => dispatch({ type: "reset" }),
    setStep: (step) => dispatch({ type: "set-step", step }),
  };
};
