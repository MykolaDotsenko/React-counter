export const MIN_COUNT = 0;
export const MAX_COUNT = 999_999;
export const STEP_OPTIONS = Object.freeze([1, 5, 10, 25]);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
};

export const normalizeStep = (step) => {
  const normalized = normalizeInteger(step, STEP_OPTIONS[0]);
  return STEP_OPTIONS.includes(normalized) ? normalized : STEP_OPTIONS[0];
};

export const normalizeValue = (value) =>
  clamp(normalizeInteger(value, MIN_COUNT), MIN_COUNT, MAX_COUNT);

export const createCounterState = ({ value = MIN_COUNT, step = STEP_OPTIONS[0] } = {}) => ({
  value: normalizeValue(value),
  step: normalizeStep(step),
  lastDelta: 0,
  motion: "idle",
  revision: 0,
});

const transition = (state, nextValue, motion) => {
  const value = normalizeValue(nextValue);
  const lastDelta = value - state.value;

  return {
    ...state,
    value,
    lastDelta,
    motion: lastDelta === 0 ? "blocked" : motion,
    revision: state.revision + 1,
  };
};

export const counterReducer = (state, action) => {
  switch (action.type) {
    case "increment":
      return transition(state, state.value + state.step, "up");

    case "decrement":
      return transition(state, state.value - state.step, "down");

    case "reset":
      return {
        ...state,
        value: MIN_COUNT,
        lastDelta: MIN_COUNT - state.value,
        motion: state.value === MIN_COUNT ? "blocked" : "reset",
        revision: state.revision + 1,
      };

    case "set-step":
      return {
        ...state,
        step: normalizeStep(action.step),
        lastDelta: 0,
        motion: "step",
        revision: state.revision + 1,
      };

    default:
      return state;
  }
};
