import { describe, expect, it } from "vitest";
import {
  MAX_COUNT,
  MIN_COUNT,
  counterReducer,
  createCounterState,
  normalizeStep,
  normalizeValue,
} from "../src/features/counter/counter-model.js";

describe("counter model", () => {
  it("creates a safe default state", () => {
    expect(createCounterState()).toEqual({
      value: 0,
      step: 1,
      lastDelta: 0,
      motion: "idle",
      revision: 0,
    });
  });

  it("increments and decrements by the selected step", () => {
    let state = createCounterState({ value: 10, step: 5 });

    state = counterReducer(state, { type: "increment" });
    expect(state).toMatchObject({ value: 15, lastDelta: 5, motion: "up" });

    state = counterReducer(state, { type: "decrement" });
    expect(state).toMatchObject({ value: 10, lastDelta: -5, motion: "down" });
  });

  it("clamps values and transitions at both boundaries", () => {
    const atMin = counterReducer(
      createCounterState({ value: MIN_COUNT }),
      { type: "decrement" },
    );
    expect(atMin).toMatchObject({ value: MIN_COUNT, lastDelta: 0, motion: "blocked" });

    const atMax = counterReducer(
      createCounterState({ value: MAX_COUNT, step: 25 }),
      { type: "increment" },
    );
    expect(atMax).toMatchObject({ value: MAX_COUNT, lastDelta: 0, motion: "blocked" });
  });

  it("clamps overshooting transitions to the exact supported boundary", () => {
    const high = counterReducer(
      createCounterState({ value: MAX_COUNT - 4, step: 25 }),
      { type: "increment" },
    );
    expect(high.value).toBe(MAX_COUNT);
    expect(high.lastDelta).toBe(4);

    const low = counterReducer(
      createCounterState({ value: 4, step: 25 }),
      { type: "decrement" },
    );
    expect(low.value).toBe(MIN_COUNT);
    expect(low.lastDelta).toBe(-4);
  });

  it("normalizes invalid persisted values and steps", () => {
    expect(normalizeValue(-99)).toBe(MIN_COUNT);
    expect(normalizeValue(MAX_COUNT + 100)).toBe(MAX_COUNT);
    expect(normalizeValue("not-a-number")).toBe(MIN_COUNT);
    expect(normalizeStep(10)).toBe(10);
    expect(normalizeStep(7)).toBe(1);
  });

  it("resets deterministically and leaves unknown actions unchanged", () => {
    const state = createCounterState({ value: 42, step: 5 });
    const reset = counterReducer(state, { type: "reset" });

    expect(reset).toMatchObject({
      value: 0,
      step: 5,
      lastDelta: -42,
      motion: "reset",
    });
    expect(counterReducer(reset, { type: "unknown" })).toBe(reset);
  });
});
