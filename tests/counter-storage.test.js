import { describe, expect, it } from "vitest";
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

describe("counter persistence", () => {
  it("reads a valid versioned snapshot", () => {
    const storage = createStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, value: 125, step: 5 }),
    });

    expect(readCounterState(storage)).toMatchObject({ value: 125, step: 5 });
  });

  it("migrates the original counter key without losing zero or positive values", () => {
    expect(
      readCounterState(createStorage({ [LEGACY_STORAGE_KEY]: "0" })),
    ).toMatchObject({ value: 0, step: 1 });

    expect(
      readCounterState(createStorage({ [LEGACY_STORAGE_KEY]: "17" })),
    ).toMatchObject({ value: 17, step: 1 });
  });

  it("recovers safely from malformed and incompatible snapshots", () => {
    const malformed = createStorage({ [STORAGE_KEY]: "{broken-json" });
    expect(readCounterState(malformed)).toMatchObject({ value: 0, step: 1 });

    const future = createStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 99, value: 500, step: 25 }),
    });
    expect(readCounterState(future)).toMatchObject({ value: 0, step: 1 });
  });

  it("normalizes snapshot fields at the storage boundary", () => {
    const storage = createStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, value: -5, step: 7 }),
    });

    expect(readCounterState(storage)).toMatchObject({ value: 0, step: 1 });
  });

  it("writes a versioned snapshot and removes the legacy key", () => {
    const storage = createStorage({ [LEGACY_STORAGE_KEY]: "4" });

    writeCounterState(storage, { value: 50, step: 10 });

    expect(storage.values.has(LEGACY_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(storage.values.get(STORAGE_KEY))).toEqual({
      version: 1,
      value: 50,
      step: 10,
    });
  });

  it("degrades to in-memory behavior when storage throws", () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readCounterState(brokenStorage)).toMatchObject({ value: 0, step: 1 });
    expect(() =>
      writeCounterState(brokenStorage, { value: 10, step: 5 }),
    ).not.toThrow();
  });
});
