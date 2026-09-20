import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  MAX_MVP_MONEY_MINOR,
  MAX_MVP_QUANTITY,
  addMoney,
  formatEur,
  minorUnits,
  multiplyMoney,
  mvpMinorUnits,
  parseEurDraft,
  signedMinorUnits,
  subtractMoney,
  type MinorUnits,
  type Result,
} from "../src/domain/money";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected a successful result");
  }

  return result.value;
};

const expectInputError = (
  raw: string,
  code:
    | "empty"
    | "incomplete"
    | "invalid-format"
    | "negative-not-allowed"
    | "too-many-fraction-digits"
    | "above-product-limit"
    | "unsafe-integer",
): void => {
  expect(parseEurDraft({ raw, mode: "decimal" })).toEqual({
    ok: false,
    error: {
      kind: "money-input",
      code,
    },
  });
};

describe("parseEurDraft decimal mode", () => {
  it.each([
    ["0.01", 1],
    ["0,01", 1],
    [".79", 79],
    [",79", 79],
    ["1", 100],
    ["1.2", 120],
    ["1,2", 120],
    ["1.23", 123],
    ["001.23", 123],
    ["€4.79", 479],
    ["4,79 €", 479],
    [" 12.50 ", 1_250],
    ["999999.99", 99_999_999],
  ])("parses %s exactly as %i cents", (raw, expected) => {
    expect(parseEurDraft({ raw, mode: "decimal" })).toEqual({
      ok: true,
      value: expected,
    });
  });

  it("distinguishes incomplete drafts from malformed input", () => {
    expectInputError("", "empty");
    expectInputError(".", "incomplete");
    expectInputError(",", "incomplete");
    expectInputError("4.", "incomplete");
    expectInputError("4,", "incomplete");
  });

  it("rejects negative money", () => {
    expectInputError("-", "negative-not-allowed");
    expectInputError("-1", "negative-not-allowed");
    expectInputError("-4.79", "negative-not-allowed");
  });

  it("rejects excess fraction digits without rounding", () => {
    expectInputError("1.234", "too-many-fraction-digits");
    expectInputError("1,234", "too-many-fraction-digits");
    expectInputError("4.790", "too-many-fraction-digits");
  });

  it("rejects ambiguous grouping and mixed separators", () => {
    expectInputError("1,234.56", "invalid-format");
    expectInputError("1.234,56", "invalid-format");
    expectInputError("4,7.9", "invalid-format");
    expectInputError("4.7,9", "invalid-format");
  });

  it("rejects unsupported symbols, labels and internal whitespace", () => {
    expectInputError("$4.79", "invalid-format");
    expectInputError("EUR 4.79", "invalid-format");
    expectInputError("4 79", "invalid-format");
    expectInputError("€4.79€", "invalid-format");
  });

  it("enforces the product-level maximum", () => {
    expectInputError("1000000.00", "above-product-limit");
    expectInputError("999999.999", "too-many-fraction-digits");
  });

  it("round-trips every generated supported cent value through decimal text", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_MVP_MONEY_MINOR }),
        (value) => {
          const major = Math.floor(value / 100);
          const fraction = String(value % 100).padStart(2, "0");
          const parsed = parseEurDraft({
            raw: `${major}.${fraction}`,
            mode: "decimal",
          });

          expect(parsed).toEqual({ ok: true, value });
        },
      ),
      { numRuns: 2_000 },
    );
  });
});

describe("parseEurDraft auto-cents mode", () => {
  it.each([
    ["1", 1],
    ["01", 1],
    ["47", 47],
    ["479", 479],
    ["1250", 1_250],
    ["000479", 479],
    ["99999999", 99_999_999],
  ])("parses %s as %i cents", (raw, expected) => {
    expect(parseEurDraft({ raw, mode: "auto-cents" })).toEqual({
      ok: true,
      value: expected,
    });
  });

  it("rejects non-digit auto-cents input", () => {
    expect(parseEurDraft({ raw: "4.79", mode: "auto-cents" })).toEqual({
      ok: false,
      error: { kind: "money-input", code: "invalid-format" },
    });
    expect(parseEurDraft({ raw: "€479", mode: "auto-cents" })).toEqual({
      ok: false,
      error: { kind: "money-input", code: "invalid-format" },
    });
  });

  it("enforces the auto-cents maximum", () => {
    expect(parseEurDraft({ raw: "100000000", mode: "auto-cents" })).toEqual({
      ok: false,
      error: { kind: "money-input", code: "above-product-limit" },
    });
  });

  it("round-trips generated cents directly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_MVP_MONEY_MINOR }),
        (value) => {
          expect(
            parseEurDraft({ raw: String(value), mode: "auto-cents" }),
          ).toEqual({ ok: true, value });
        },
      ),
      { numRuns: 2_000 },
    );
  });
});

describe("money constructors", () => {
  it("accepts exact non-negative safe integers", () => {
    expect(minorUnits(0)).toEqual({ ok: true, value: 0 });
    expect(minorUnits(Number.MAX_SAFE_INTEGER)).toEqual({
      ok: true,
      value: Number.MAX_SAFE_INTEGER,
    });
  });

  it("rejects negative, fractional and unsafe canonical values", () => {
    expect(minorUnits(-1)).toEqual({
      ok: false,
      error: { kind: "money", code: "negative-not-allowed" },
    });
    expect(minorUnits(1.1)).toEqual({
      ok: false,
      error: { kind: "money", code: "unsafe-integer" },
    });
    expect(minorUnits(Number.MAX_SAFE_INTEGER + 1)).toEqual({
      ok: false,
      error: { kind: "money", code: "unsafe-integer" },
    });
  });

  it("separates technical minor units from MVP input limits", () => {
    expect(mvpMinorUnits(MAX_MVP_MONEY_MINOR)).toEqual({
      ok: true,
      value: MAX_MVP_MONEY_MINOR,
    });
    expect(mvpMinorUnits(MAX_MVP_MONEY_MINOR + 1)).toEqual({
      ok: false,
      error: { kind: "money", code: "above-product-limit" },
    });
  });

  it("permits negative signed derived values", () => {
    expect(signedMinorUnits(-341)).toEqual({ ok: true, value: -341 });
  });
});

describe("exact arithmetic", () => {
  it("matches the canonical examples exactly", () => {
    const first = unwrap(minorUnits(379));
    const second = unwrap(minorUnits(1_250));
    const third = unwrap(minorUnits(799));

    const subtotal = unwrap(addMoney(first, second));
    expect(subtotal).toBe(1_629);

    const total = unwrap(addMoney(subtotal, third));
    expect(total).toBe(2_428);

    const budget = unwrap(minorUnits(5_000));
    expect(unwrap(subtractMoney(budget, total))).toBe(2_572);
  });

  it("multiplies quantity in integer cents", () => {
    const unitPrice = unwrap(minorUnits(129));

    expect(multiplyMoney(unitPrice, 3)).toEqual({
      ok: true,
      value: 387,
    });
  });

  it("rejects invalid quantities", () => {
    const unitPrice = unwrap(minorUnits(129));

    for (const quantity of [0, -1, 1.5, MAX_MVP_QUANTITY + 1]) {
      expect(multiplyMoney(unitPrice, quantity)).toEqual({
        ok: false,
        error: { kind: "money", code: "invalid-quantity" },
      });
    }
  });

  it("detects arithmetic overflow rather than losing precision", () => {
    const max = unwrap(minorUnits(Number.MAX_SAFE_INTEGER));
    const one = unwrap(minorUnits(1));

    expect(addMoney(max, one)).toEqual({
      ok: false,
      error: { kind: "money", code: "unsafe-integer" },
    });

    expect(multiplyMoney(max, 2)).toEqual({
      ok: false,
      error: { kind: "money", code: "unsafe-integer" },
    });
  });

  it("preserves addition/subtraction invariants for generated safe values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_MVP_MONEY_MINOR }),
        fc.integer({ min: 0, max: MAX_MVP_MONEY_MINOR }),
        (leftValue, rightValue) => {
          const left = unwrap(minorUnits(leftValue));
          const right = unwrap(minorUnits(rightValue));
          const sum = unwrap(addMoney(left, right));

          expect(unwrap(subtractMoney(sum, right))).toBe(leftValue);
          expect(unwrap(subtractMoney(sum, left))).toBe(rightValue);
        },
      ),
      { numRuns: 2_000 },
    );
  });

  it("preserves exact quantity multiplication for generated inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_MVP_MONEY_MINOR }),
        fc.integer({ min: 1, max: MAX_MVP_QUANTITY }),
        (priceValue, quantity) => {
          const price = unwrap(minorUnits(priceValue));
          const result = unwrap(multiplyMoney(price, quantity));

          expect(result).toBe(priceValue * quantity);
          expect(Number.isSafeInteger(result)).toBe(true);
        },
      ),
      { numRuns: 2_000 },
    );
  });

  it("has no floating-point drift in classic decimal regression cases", () => {
    const ten = unwrap(
      parseEurDraft({ raw: "0.10", mode: "decimal" }),
    );
    const twenty = unwrap(
      parseEurDraft({ raw: "0.20", mode: "decimal" }),
    );
    const oneTen = unwrap(
      parseEurDraft({ raw: "1.10", mode: "decimal" }),
    );
    const twoTwenty = unwrap(
      parseEurDraft({ raw: "2.20", mode: "decimal" }),
    );

    expect(unwrap(addMoney(ten, twenty))).toBe(30);
    expect(unwrap(addMoney(oneTen, twoTwenty))).toBe(330);
  });
});

describe("EUR formatting", () => {
  it("formats with an explicit locale without mutating cents", () => {
    const amount = unwrap(minorUnits(479));

    expect(formatEur(amount, "en-US")).toBe("€4.79");
    expect(formatEur(amount, "fi-FI").replace(/\s/u, " ")).toBe("4,79 €");
    expect(amount).toBe(479);
  });

  it("formats signed derived values", () => {
    const amount = unwrap(signedMinorUnits(-341));

    expect(formatEur(amount, "en-US")).toBe("-€3.41");
  });
});
