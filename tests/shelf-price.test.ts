import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  parseShelfPriceCandidates,
  rankPriceTagCandidates,
  type PriceTagSuperscriptCents,
} from "../src/domain/shelf-price";

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

  it("requires explicit price context when a decimal has no euro marker", () => {
    expect(values("Päivä 24.09.2026")).toEqual([]);
    expect(values("Paino 2.5 kg")).toEqual([]);
    expect(values("Tarjous 2.5")).toEqual([250]);
    expect(values("Price 3.79")).toEqual([379]);
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

describe("price tag candidate ranking", () => {
  const rank = (
    lines: readonly [string, number][],
    superscript: PriceTagSuperscriptCents | null = null,
  ) =>
    rankPriceTagCandidates({
      lines: lines.map(([text, height]) => ({ text, height })),
      superscript,
    });
  const valuesOf = (candidates: readonly { minorUnits: number }[]) =>
    candidates.map((candidate) => Number(candidate.minorUnits));

  it("accepts the largest printed number as the price even without a euro sign", () => {
    const candidates = rank([
      ["Banaani luomu", 40],
      ["1.99", 110],
      ["1 kg = 3.98", 30],
    ]);

    expect(valuesOf(candidates)).toEqual([199]);
    expect(candidates[0]).toMatchObject({ prominent: true, kind: "decimal" });
  });

  it("ranks the headline price above smaller regular and unit prices, keeping their context", () => {
    const candidates = rank([
      ["Fazer Puikula 330 g", 38],
      ["JÄSENHINTA", 30],
      ["2,49.", 132],
      ["Norm. 2,99 € · 7,55 €/kg", 30],
    ]);

    expect(valuesOf(candidates)).toEqual([249, 299, 755]);
    expect(candidates[1]?.context.regularPrice).toBe(true);
    expect(candidates[2]?.context.unitPrice).toBe(true);
    expect(candidates.map((candidate) => candidate.prominent)).toEqual([true, false, false]);
  });

  it("keeps one entry per amount, preferring the headline reading", () => {
    const candidates = rank([
      ["Valio kevytmaito 1 l", 38],
      ["1,29€", 131],
      ["1,29 €/l", 30],
    ]);

    expect(valuesOf(candidates)).toEqual([129]);
    expect(candidates[0]?.prominent).toBe(true);
  });

  it("joins euros with superscript cents read separately and drops the merged misreading", () => {
    expect(
      valuesOf(
        rank(
          [
            ["Juustoraaste 150 g", 38],
            ["3”.", 123],
            ["26,60 €/kg", 30],
          ],
          { lineIndex: 1, euros: 3, cents: 99 },
        ),
      ),
    ).toEqual([399, 2660]);
    expect(valuesOf(rank([["399 €", 120]], { lineIndex: 0, euros: 3, cents: 99 }))).toEqual([399]);
    expect(rank([["1 05 €", 120]], { lineIndex: 0, euros: 1, cents: 5 })[0]).toMatchObject({
      minorUnits: 105,
      kind: "split-cents",
    });
  });

  it("puts the single-item price of a multi-buy label first and keeps the offer as a choice", () => {
    const candidates = rank([
      ["Coca-Cola 1,5 |", 38],
      ["2 kpl", 30],
      ["5,00.", 132],
      ["yks. 2,79 € - 1,67 €/|", 30],
    ]);

    expect(valuesOf(candidates)).toEqual([279, 500, 167]);
    expect(candidates[0]?.context.multiBuy).toBe(false);
    expect(candidates[1]?.context.multiBuy).toBe(true);
    expect(candidates[2]?.context.unitPrice).toBe(true);
  });

  it("joins cents that OCR split into single digits instead of reading the last digit as euros", () => {
    expect(valuesOf(rank([["Valio kevytmaito 1 |", 53], ["1, 2 9 €", 211]]))).toEqual([129]);
    expect(valuesOf(rank([["1,2 9", 180]]))).toEqual([129]);
  });

  it("never turns quantities, bare digits or codes into prices", () => {
    expect(valuesOf(rank([["1,5 l", 120]]))).toEqual([]);
    expect(valuesOf(rank([["Tuote 429", 100]]))).toEqual([]);
    expect(valuesOf(rank([["6408430000081", 90]]))).toEqual([]);
    expect(valuesOf(rank([["ALE -30%", 120], ["Hinta 3,49 €", 40]]))).toEqual([349]);
  });

  it("falls back to text rules when heights are missing and ignores an impossible superscript hint", () => {
    expect(valuesOf(rank([["1.99", Number.NaN]]))).toEqual([]);
    expect(valuesOf(rank([["Hinta 2,49 €", -5]]))).toEqual([249]);
    expect(valuesOf(rank([["3", 100]], { lineIndex: 4, euros: 3, cents: 99 }))).toEqual([]);
    expect(valuesOf(rank([["3", 100]], { lineIndex: 0, euros: 3, cents: 100 }))).toEqual([]);
  });

  it("joins cents that OCR separated from the euros", () => {
    expect(valuesOf(rank([["1, 29 €", 120]]))).toEqual([129]);
  });

  it("returns a bounded, duplicate-free list ordered by score for any reading", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.stringMatching(/^[0-9A-Za-zäöÄÖ €.,/%-]{0,24}$/),
            fc.integer({ min: 0, max: 200 }),
          ),
          { maxLength: 12 },
        ),
        (lines) => {
          const candidates = rank(lines);
          const values = valuesOf(candidates);

          expect(candidates.length).toBeLessThanOrEqual(8);
          expect(new Set(values).size).toBe(values.length);
          expect(values.every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);

          for (let index = 1; index < candidates.length; index += 1) {
            expect((candidates[index - 1]?.score ?? 0) >= (candidates[index]?.score ?? 0)).toBe(true);
          }
        },
      ),
    );
  });
});
