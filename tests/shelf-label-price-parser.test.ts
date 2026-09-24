import { describe, expect, it } from "vitest";

import { parseShelfPriceCandidates } from "../src/qa/shelf-label-price-parser";

const values = (text: string): number[] =>
  parseShelfPriceCandidates(text).map((candidate) =>
    Number(candidate.minorUnits),
  );

describe("shelf-label price candidate parser", () => {
  it("uses the existing exact-money parser for comma and dot decimals", () => {
    expect(values("Hinta 4,29 €")).toEqual([429]);
    expect(values("Price € 3.79")).toEqual([379]);
    expect(values("Tarjous 2.5")).toEqual([250]);
  });

  it("supports split cents only when an explicit euro marker anchors the pattern", () => {
    const candidates = parseShelfPriceCandidates("HINTA\n4 29 €");

    expect(candidates).toHaveLength(1);
    expect(Number(candidates[0]?.minorUnits)).toBe(429);
    expect(candidates[0]?.kind).toBe("split-cents");
    expect(values("Tuotekoodi 4 29")).toEqual([]);
  });

  it("does not guess a decimal point into bare OCR digits", () => {
    expect(values("Tuote 429")).toEqual([]);
    expect(values("EAN 6411401034290")).toEqual([]);
  });

  it("does not parse percentage discounts as money", () => {
    expect(values("ALE -30%")).toEqual([]);
    expect(values("ALE 30%\nHinta 3,49 €")).toEqual([349]);
  });

  it("keeps unit price as a candidate but ranks the product price above it", () => {
    const candidates = parseShelfPriceCandidates(
      "Hinta 4,29 €\nYksikköhinta 12,48 €/kg",
    );

    expect(candidates.map((candidate) => Number(candidate.minorUnits))).toEqual([
      429,
      1248,
    ]);
    expect(candidates[0]?.context.unitPrice).toBe(false);
    expect(candidates[1]?.context.unitPrice).toBe(true);
    expect(
      Number(candidates[0]?.score) > Number(candidates[1]?.score),
    ).toBe(true);
  });

  it("ranks a direct loyalty price above a nearby labelled regular price", () => {
    const candidates = parseShelfPriceCandidates(
      "Jäsen 3,49 €\nNorm. 4,29 €",
    );

    expect(candidates.map((candidate) => Number(candidate.minorUnits))).toEqual([
      349,
      429,
    ]);
    expect(candidates[0]?.context.loyaltyPrice).toBe(true);
    expect(candidates[0]?.context.regularPrice).toBe(false);
    expect(candidates[1]?.context.regularPrice).toBe(true);
  });

  it("keeps multi-buy totals visible but ranks a direct price above them", () => {
    const candidates = parseShelfPriceCandidates(
      "Hinta 2,79 €\n2 kpl 5 €",
    );

    expect(candidates.map((candidate) => Number(candidate.minorUnits))).toEqual([
      279,
      500,
    ]);
    expect(candidates[1]?.context.multiBuy).toBe(true);
  });

  it("deduplicates repeated values after ranking", () => {
    const candidates = parseShelfPriceCandidates(
      "Hinta 4,29 €\nToista 4,29 €",
    );

    expect(candidates).toHaveLength(1);
    expect(Number(candidates[0]?.minorUnits)).toBe(429);
  });

  it("rejects unbounded OCR text instead of doing unlimited parsing work", () => {
    expect(() =>
      parseShelfPriceCandidates("x".repeat(20_001)),
    ).toThrow(/exceeds benchmark parser limit/i);
  });
});
