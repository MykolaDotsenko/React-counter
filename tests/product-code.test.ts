import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  expandUpcE,
  gs1CheckDigit,
  gtinForDisplay,
  isGtin,
  parseProductCode,
  type Gtin,
} from "../src/domain/product-code";

const tradeItem = (raw: string, symbology: Parameters<typeof parseProductCode>[1] = null) => {
  const result = parseProductCode(raw, symbology);

  if (!result.ok || result.value.kind !== "trade-item") {
    throw new Error(`Expected a trade item for ${raw}`);
  }

  return result.value;
};

describe("product barcodes", () => {
  it("normalizes retail symbologies to one GTIN-14 identity", () => {
    expect(tradeItem("6414893386303")).toEqual({
      kind: "trade-item",
      gtin: "06414893386303",
      symbology: "ean-13",
    });
    expect(tradeItem("036000291452").gtin).toBe("00036000291452");
    expect(tradeItem("036000291452").symbology).toBe("upc-a");
    expect(tradeItem("0036000291452", "upc-a").gtin).toBe("00036000291452");
    expect(tradeItem("96385074").gtin).toBe("00000096385074");
    expect(tradeItem("04252614", "upc-e")).toEqual({
      kind: "trade-item",
      gtin: "00042100005264",
      symbology: "upc-e",
    });
    expect(tradeItem("9780143007234").gtin).toBe("09780143007234");
  });

  it("accepts the digits people type with spaces or dashes", () => {
    expect(tradeItem(" 6 414893-386303 ").gtin).toBe("06414893386303");
  });

  it("expands every UPC-E pattern to its UPC-A form", () => {
    expect(expandUpcE("04252614")).toBe("042100005264");
    expect(expandUpcE("01234565")).toBe("012345000065");
    expect(expandUpcE("01234533")).toBe("012300000453");
    expect(expandUpcE("01234543")).toBe("012340000053");
    expect(expandUpcE("01234573")).toBe("012345000073");
    expect(expandUpcE("21234565")).toBeNull();
    expect(expandUpcE("0123456")).toBeNull();
  });

  it("rejects misreads through the check digit", () => {
    expect(parseProductCode("6414893386304")).toEqual({
      ok: false,
      error: { kind: "product-code", code: "invalid-check-digit" },
    });
    expect(parseProductCode("0000000000000")).toMatchObject({
      ok: false,
      error: { code: "invalid-check-digit" },
    });
  });

  it("rejects values that are not product barcodes", () => {
    expect(parseProductCode("")).toMatchObject({ error: { code: "invalid-characters" } });
    expect(parseProductCode("64148933863O3")).toMatchObject({ error: { code: "invalid-characters" } });
    expect(parseProductCode("12345")).toMatchObject({ error: { code: "invalid-length" } });
    expect(parseProductCode("12345678901234")).toMatchObject({ error: { code: "invalid-length" } });
    expect(parseProductCode("6414893386303", "ean-8")).toMatchObject({ error: { code: "invalid-length" } });
    expect(parseProductCode("0425261", "upc-e")).toMatchObject({ error: { code: "invalid-length" } });
  });

  const withCheck = (body: string) => `${body}${gs1CheckDigit(body)}`;

  it("recognises store-printed codes that are no stable product identity", () => {
    for (const raw of [
      withCheck("201234567890"),
      withCheck("291234567890"),
      withCheck("21234567890"),
      withCheck("042100005264"),
      withCheck("0234567"),
      withCheck("2234567"),
    ]) {
      const result = parseProductCode(raw);
      expect(result.ok && result.value.kind, raw).toBe("in-store");
    }
  });

  it("recognises coupons and refund receipts", () => {
    for (const raw of [
      withCheck("51234567890"),
      withCheck("990000000001"),
      withCheck("981000000001"),
      withCheck("980000000001"),
      withCheck("051234567890"),
    ]) {
      const result = parseProductCode(raw);
      expect(result.ok && result.value.kind, raw).toBe("coupon");
    }
  });

  it("keeps books, magazines and regular products as trade items", () => {
    for (const raw of [
      withCheck("978014300723"),
      withCheck("977123456700"),
      withCheck("641489338630"),
      withCheck("1234567"),
    ]) {
      const result = parseProductCode(raw);
      expect(result.ok && result.value.kind, raw).toBe("trade-item");
    }
  });

  it("detects every single-digit error in a valid EAN-13", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 12, maxLength: 12 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 1, max: 9 }),
        (bodyDigits, position, delta) => {
          const body = bodyDigits.join("");
          const valid = `${body}${gs1CheckDigit(body)}`;
          fc.pre(!/^0+$/u.test(valid));
          expect(parseProductCode(valid).ok).toBe(true);

          const digits = [...valid];
          digits[position] = String((Number(digits[position]) + delta) % 10);
          expect(parseProductCode(digits.join("")).ok).toBe(false);
        },
      ),
    );
  });

  it("round-trips every trade item through its display form", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 12, maxLength: 12 }),
        (bodyDigits) => {
          const body = bodyDigits.join("");
          const parsed = parseProductCode(`${body}${gs1CheckDigit(body)}`);

          if (!parsed.ok || parsed.value.kind !== "trade-item") {
            return;
          }

          const again = parseProductCode(gtinForDisplay(parsed.value.gtin));
          expect(again.ok && again.value.kind === "trade-item" && again.value.gtin).toBe(
            parsed.value.gtin,
          );
          expect(isGtin(parsed.value.gtin)).toBe(true);
        },
      ),
    );
  });

  it("shows the shortest standard form of a GTIN", () => {
    expect(gtinForDisplay("06414893386303" as Gtin)).toBe("6414893386303");
    expect(gtinForDisplay("00000096385074" as Gtin)).toBe("96385074");
    expect(gtinForDisplay("10614141000415" as Gtin)).toBe("10614141000415");
    expect(isGtin("06414893386304")).toBe(false);
    expect(isGtin("00000000000000")).toBe(false);
  });
});
