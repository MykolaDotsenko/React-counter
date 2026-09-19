import { createCounterState, MIN_COUNT, normalizeStep, normalizeValue } from "./counter-model.js";

export const STORAGE_KEY = "pulse-counter:state";
export const LEGACY_STORAGE_KEY = "counter";
export const STORAGE_VERSION = 1;

const safeParse = (raw) => {
  if (raw === null || raw === undefined || raw === "") return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const parseCounterSnapshot = (raw) => {
  const parsed = safeParse(raw);

  if (!parsed || typeof parsed !== "object" || parsed.version !== STORAGE_VERSION) {
    return null;
  }

  return {
    value: normalizeValue(parsed.value),
    step: normalizeStep(parsed.step),
  };
};

export const parseLegacyCounter = (raw) => {
  const parsed = safeParse(raw);
  if (!Number.isSafeInteger(parsed)) return null;

  return {
    value: normalizeValue(parsed),
    step: 1,
  };
};

export const readCounterState = (storage) => {
  if (!storage) return createCounterState();

  try {
    const snapshot = parseCounterSnapshot(storage.getItem(STORAGE_KEY));
    if (snapshot) return createCounterState(snapshot);

    const legacy = parseLegacyCounter(storage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) return createCounterState(legacy);
  } catch {
    return createCounterState();
  }

  return createCounterState();
};

export const writeCounterState = (storage, state) => {
  if (!storage) return;

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        value: normalizeValue(state.value ?? MIN_COUNT),
        step: normalizeStep(state.step),
      }),
    );
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing or constrained embeds.
    // The counter deliberately keeps working in memory in that case.
  }
};
