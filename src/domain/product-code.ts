import { ok, type Brand, type Result } from "./money";

export type Gtin = Brand<string, "Gtin">;

export type BarcodeSymbology = "ean-13" | "ean-8" | "upc-a" | "upc-e";

export type ProductCode =
  | {
      readonly kind: "trade-item";
      readonly gtin: Gtin;
      readonly symbology: BarcodeSymbology;
    }
  | { readonly kind: "in-store"; readonly symbology: BarcodeSymbology }
  | { readonly kind: "coupon"; readonly symbology: BarcodeSymbology };

export type ProductCodeErrorCode =
  | "invalid-characters"
  | "invalid-length"
  | "invalid-check-digit";

export interface ProductCodeError {
  readonly kind: "product-code";
  readonly code: ProductCodeErrorCode;
}

const codeError = (
  code: ProductCodeErrorCode,
): Result<never, ProductCodeError> => ({
  ok: false,
  error: { kind: "product-code", code },
});

const DIGITS = /^\d+$/u;

export const gs1CheckDigit = (body: string): number => {
  let sum = 0;

  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += index % 2 === 0 ? digit * 3 : digit;
  }

  return (10 - (sum % 10)) % 10;
};

const hasValidCheckDigit = (digits: string): boolean =>
  gs1CheckDigit(digits.slice(0, -1)) === Number(digits.at(-1));

export const expandUpcE = (upcE: string): string | null => {
  if (!/^[01]\d{7}$/u.test(upcE)) {
    return null;
  }

  const system = upcE.charAt(0);
  const data = upcE.slice(1, 7);
  const check = upcE.charAt(7);
  const last = Number(data.charAt(5));
  let body: string;

  if (last <= 2) {
    body = `${data.slice(0, 2)}${data.charAt(5)}0000${data.slice(2, 5)}`;
  } else if (last === 3) {
    body = `${data.slice(0, 3)}00000${data.slice(3, 5)}`;
  } else if (last === 4) {
    body = `${data.slice(0, 4)}00000${data.charAt(4)}`;
  } else {
    body = `${data.slice(0, 5)}0000${data.charAt(5)}`;
  }

  return `${system}${body}${check}`;
};

const classifyGtin13 = (
  gtin13: string,
  symbology: BarcodeSymbology,
): ProductCode => {
  if (
    gtin13.startsWith("2") ||
    gtin13.startsWith("02") ||
    gtin13.startsWith("04")
  ) {
    return { kind: "in-store", symbology };
  }

  if (
    gtin13.startsWith("05") ||
    gtin13.startsWith("99") ||
    /^98[0-4]/u.test(gtin13)
  ) {
    return { kind: "coupon", symbology };
  }

  return {
    kind: "trade-item",
    gtin: gtin13.padStart(14, "0") as Gtin,
    symbology,
  };
};

const classifyGtin8 = (gtin8: string): ProductCode =>
  gtin8.startsWith("0") || gtin8.startsWith("2")
    ? { kind: "in-store", symbology: "ean-8" }
    : {
        kind: "trade-item",
        gtin: gtin8.padStart(14, "0") as Gtin,
        symbology: "ean-8",
      };

const inferSymbology = (length: number): BarcodeSymbology | null => {
  switch (length) {
    case 8:
      return "ean-8";
    case 12:
      return "upc-a";
    case 13:
      return "ean-13";
    default:
      return null;
  }
};

export const parseProductCode = (
  raw: string,
  symbology: BarcodeSymbology | null = null,
): Result<ProductCode, ProductCodeError> => {
  const digits = raw.replace(/[\s-]/gu, "");

  if (digits === "" || !DIGITS.test(digits)) {
    return codeError("invalid-characters");
  }

  if (symbology === "upc-e") {
    const expanded =
      digits.length === 12 ? digits : expandUpcE(digits);

    if (expanded === null) {
      return codeError("invalid-length");
    }

    if (!hasValidCheckDigit(expanded) || /^0+$/u.test(expanded)) {
      return codeError("invalid-check-digit");
    }

    return ok(classifyGtin13(`0${expanded}`, "upc-e"));
  }

  const resolved = inferSymbology(digits.length);

  if (
    resolved === null ||
    (symbology !== null &&
      symbology !== resolved &&
      !(symbology === "upc-a" && resolved === "ean-13" && digits.startsWith("0")))
  ) {
    return codeError("invalid-length");
  }

  if (!hasValidCheckDigit(digits) || /^0+$/u.test(digits)) {
    return codeError("invalid-check-digit");
  }

  if (resolved === "ean-8") {
    return ok(classifyGtin8(digits));
  }

  const effective = symbology ?? resolved;

  return ok(
    classifyGtin13(
      resolved === "upc-a" ? `0${digits}` : digits,
      effective,
    ),
  );
};

export const isGtin = (value: string): value is Gtin =>
  /^\d{14}$/u.test(value) && hasValidCheckDigit(value) && !/^0+$/u.test(value);

export const gtinForDisplay = (gtin: Gtin): string =>
  gtin.startsWith("000000") ? gtin.slice(6) : gtin.startsWith("0") ? gtin.slice(1) : gtin;
