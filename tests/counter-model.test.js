import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_COUNT,
  MIN_COUNT,
  counterReducer,
  createCounterState,
} from "../src/features/counter/counter-model.js";

test("creates a safe default state", () => {
  assert.deepEqual(createCounterState(), {
    value: 0,
    step: 1,
    lastDelta: 0,
    motion: "idle",
    revision: 0,
  });
});

test("increments and decrements by the selected step", () => {
  let state = createCounterState({ value: 10, step: 5 });
  state = counterReducer(state, { type: "increment" });
  assert.equal(state.value, 15);
  assert.equal(state.lastDelta, 5);
  assert.equal(state.motion, "up");

  state = counterReducer(state, { type: "decrement" });
  assert.equal(state.value, 10);
  assert.equal(state.lastDelta, -5);
  assert.equal(state.motion, "down");
});

test("clamps values to the supported range", () => {
  const atMin = counterReducer(createCounterState({ value: MIN_COUNT }), { type: "decrement" });
  assert.equal(atMin.value, MIN_COUNT);
  assert.equal(atMin.motion, "blocked");

  const atMax = counterReducer(createCounterState({ value: MAX_COUNT, step: 25 }), { type: "increment" });
  assert.equal(atMax.value, MAX_COUNT);
  assert.equal(atMax.motion, "blocked");
});

test("normalizes unsupported steps and resets deterministically", () => {
  let state = createCounterState({ value: 42, step: 5 });
  state = counterReducer(state, { type: "set-step", step: 7 });
  assert.equal(state.step, 1);

  state = counterReducer(state, { type: "reset" });
  assert.equal(state.value, 0);
  assert.equal(state.lastDelta, -42);
  assert.equal(state.motion, "reset");
});
