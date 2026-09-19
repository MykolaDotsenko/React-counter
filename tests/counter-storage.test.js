import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  readCounterState,
  writeCounterState,
} from "../src/features/counter/counter-storage.js";

const createStorage = (entries = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
};

test("reads the versioned snapshot", () => {
  const storage = createStorage({
    [STORAGE_KEY]: JSON.stringify({ version: 1, value: 125, step: 5 }),
  });
  const state = readCounterState(storage);

  assert.equal(state.value, 125);
  assert.equal(state.step, 5);
});

test("migrates the original counter key without losing the value", () => {
  const storage = createStorage({ [LEGACY_STORAGE_KEY]: "17" });
  const state = readCounterState(storage);

  assert.equal(state.value, 17);
  assert.equal(state.step, 1);
});

test("falls back safely when persisted data is malformed", () => {
  const storage = createStorage({ [STORAGE_KEY]: "{broken-json" });
  const state = readCounterState(storage);

  assert.equal(state.value, 0);
  assert.equal(state.step, 1);
});

test("writes a versioned snapshot and removes the legacy key", () => {
  const storage = createStorage({ [LEGACY_STORAGE_KEY]: "4" });
  writeCounterState(storage, { value: 50, step: 10 });

  assert.equal(storage.values.has(LEGACY_STORAGE_KEY), false);
  assert.deepEqual(JSON.parse(storage.values.get(STORAGE_KEY)), {
    version: 1,
    value: 50,
    step: 10,
  });
});
