import { describe, expect, it } from "vitest";

import {
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
} from "../src/domain/money";
import {
  canDecreaseQuantity,
  canIncreaseQuantity,
  decreaseQuantity,
  defaultQuantity,
  increaseQuantity,
} from "../src/features/shopping/quantity-draft";

describe("quantity draft helpers", () => {
  it("starts at the Phase 2 minimum quantity", () => {
    expect(defaultQuantity()).toBe(MIN_MVP_QUANTITY);
  });

  it("increments and decrements within the canonical quantity range", () => {
    expect(increaseQuantity(1)).toBe(2);
    expect(decreaseQuantity(2)).toBe(1);
  });

  it("never creates a value below the minimum", () => {
    expect(canDecreaseQuantity(MIN_MVP_QUANTITY)).toBe(false);
    expect(decreaseQuantity(MIN_MVP_QUANTITY)).toBe(MIN_MVP_QUANTITY);
  });

  it("never creates a value above the maximum", () => {
    expect(canIncreaseQuantity(MAX_MVP_QUANTITY)).toBe(false);
    expect(increaseQuantity(MAX_MVP_QUANTITY)).toBe(MAX_MVP_QUANTITY);
  });

  it("rejects unsafe values as increment/decrement candidates", () => {
    expect(canDecreaseQuantity(Number.NaN)).toBe(false);
    expect(canIncreaseQuantity(Number.NaN)).toBe(false);
    expect(canDecreaseQuantity(1.5)).toBe(false);
    expect(canIncreaseQuantity(1.5)).toBe(false);
  });
});
