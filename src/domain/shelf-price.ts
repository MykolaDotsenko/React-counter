import {
  formatEur,
  parseEurDraft,
  type MinorUnits,
} from "./money";

export type ShelfPriceCandidateKind =
  | "decimal"
  | "split-cents"
  | "whole-euro";

export interface ShelfPriceCandidateContext {
  readonly unitPrice: boolean;
  readonly multiBuy: boolean;
  readonly regularPrice: boolean;
  readonly loyaltyPrice: boolean;
}

export interface ShelfPriceCandidate {
  readonly minorUnits: MinorUnits;
  readonly displayValue: string;
  readonly kind: ShelfPriceCandidateKind;
  readonly context: ShelfPriceCandidateContext;
  readonly score: number;
}

interface RawCandidate {
  readonly start: number;
  readonly end: number;
  readonly rawMoney: string;
  readonly kind: ShelfPriceCandidateKind;
  readonly explicitEuro: boolean;
}

const MAX_OCR_TEXT_LENGTH = 20_000;
const MAX_PRICE_CANDIDATES = 8;

const overlaps = (
  left: Pick<RawCandidate, "start" | "end">,
  right: Pick<RawCandidate, "start" | "end">,
): boolean => left.start < right.end && right.start < left.end;

const surroundingWindow = (
  text: string,
  start: number,
  end: number,
): {
  readonly before: string;
  readonly around: string;
  readonly after: string;
} => ({
  before: text.slice(Math.max(0, start - 32), start).toLowerCase(),
  around: text
    .slice(Math.max(0, start - 32), Math.min(text.length, end + 32))
    .toLowerCase(),
  after: text.slice(end, Math.min(text.length, end + 24)).toLowerCase(),
});

const classifyContext = (
  text: string,
  candidate: RawCandidate,
): ShelfPriceCandidateContext => {
  const window = surroundingWindow(text, candidate.start, candidate.end);

  const unitPrice =
    /^\s*(?:€\s*)?\/\s*(?:kg|g|100\s*g|l|cl|ml|kpl|pcs|st)\b/i.test(
      window.after,
    ) || /^\s*(?:€\s*)?\/\s*[|I](?![a-z])/.test(window.after);

  const singleUnit = /\b(?:yks|kpl-hinta|st-pris|each)\.?\s*$/i.test(
    window.before,
  );

  const multiBuy =
    !singleUnit &&
    (/\b\d+\s*(?:kpl|pcs|st|pkt|pack)\b/i.test(window.before) ||
      /\b\d+\s*[x×]\s*$/i.test(window.before));

  const regularPrice =
    /\b(?:norm\.?|normaali(?:hinta)?|regular|ennen|was)\b/i.test(
      window.before,
    );

  const loyaltyPrice =
    /\b(?:jäsen|plussa|k-plussa|s-etukortti|member|club)\b/i.test(
      window.before,
    );

  return Object.freeze({
    unitPrice,
    multiBuy,
    regularPrice,
    loyaltyPrice,
  });
};

const baseScore = (candidate: RawCandidate): number => {
  if (candidate.kind === "split-cents") {
    return 95;
  }

  if (candidate.kind === "whole-euro") {
    return 60;
  }

  return candidate.explicitEuro ? 100 : 85;
};

const hasImplicitPriceContext = (
  text: string,
  candidate: RawCandidate,
): boolean =>
  /\b(?:hinta|price|tarjous|ale|jäsen|plussa|k-plussa|s-etukortti|member|club|norm\.?|normaali(?:hinta)?|regular)\b/i.test(
    surroundingWindow(text, candidate.start, candidate.end).around,
  );

const contextualScore = (
  candidate: RawCandidate,
  context: ShelfPriceCandidateContext,
): number =>
  baseScore(candidate) -
  (context.unitPrice ? 45 : 0) -
  (context.multiBuy ? 30 : 0) -
  (context.regularPrice ? 15 : 0);

const addIfNonOverlapping = (
  candidates: RawCandidate[],
  next: RawCandidate,
): void => {
  if (!candidates.some((candidate) => overlaps(candidate, next))) {
    candidates.push(next);
  }
};

const collectRawCandidates = (text: string): RawCandidate[] => {
  const candidates: RawCandidate[] = [];

  const splitCents =
    /(^|[^\d])((?:\d{1,4}))\s+((?:\d{2}))\s*€(?!\s*%)/g;

  for (const match of text.matchAll(splitCents)) {
    if (match.index === undefined) {
      continue;
    }

    const prefix = match[1] ?? "";
    const major = match[2];
    const cents = match[3];

    if (major === undefined || cents === undefined) {
      continue;
    }

    const start = match.index + prefix.length;
    const matchedMoney = match[0].slice(prefix.length);

    addIfNonOverlapping(candidates, {
      start,
      end: start + matchedMoney.length,
      rawMoney: major + "," + cents,
      kind: "split-cents",
      explicitEuro: true,
    });
  }

  const decimals =
    /(^|[^\d])((?:€\s*)?\d{1,6}[.,]\d{1,2}(?:\s*€)?)(?!\s*%|\d)/g;

  for (const match of text.matchAll(decimals)) {
    if (match.index === undefined) {
      continue;
    }

    const prefix = match[1] ?? "";
    const rawMoney = match[2];

    if (rawMoney === undefined) {
      continue;
    }

    const start = match.index + prefix.length;

    addIfNonOverlapping(candidates, {
      start,
      end: start + rawMoney.length,
      rawMoney,
      kind: "decimal",
      explicitEuro: rawMoney.includes("€"),
    });
  }

  const wholeEuro = /(^|[^\d])((?:€\s*)?\d{1,6}\s*€)(?!\s*%|\d)/g;

  for (const match of text.matchAll(wholeEuro)) {
    if (match.index === undefined) {
      continue;
    }

    const prefix = match[1] ?? "";
    const rawMoney = match[2];

    if (rawMoney === undefined) {
      continue;
    }

    const start = match.index + prefix.length;

    addIfNonOverlapping(candidates, {
      start,
      end: start + rawMoney.length,
      rawMoney,
      kind: "whole-euro",
      explicitEuro: true,
    });
  }

  return candidates;
};

interface RankedCandidate<T extends ShelfPriceCandidate> {
  readonly candidate: T;
  readonly start: number;
}

const rankAndDeduplicate = <T extends ShelfPriceCandidate>(
  ranked: RankedCandidate<T>[],
): readonly T[] => {
  ranked.sort(
    (left, right) =>
      right.candidate.score - left.candidate.score ||
      left.start - right.start ||
      Number(left.candidate.minorUnits) -
        Number(right.candidate.minorUnits),
  );

  const deduplicated: T[] = [];
  const seenMinorUnits = new Set<number>();

  for (const entry of ranked) {
    const numericValue = Number(entry.candidate.minorUnits);

    if (seenMinorUnits.has(numericValue)) {
      continue;
    }

    seenMinorUnits.add(numericValue);
    deduplicated.push(entry.candidate);

    if (deduplicated.length >= MAX_PRICE_CANDIDATES) {
      break;
    }
  }

  return Object.freeze(deduplicated);
};

export const parseShelfPriceCandidates = (
  rawText: string,
): readonly ShelfPriceCandidate[] => {
  if (rawText.length > MAX_OCR_TEXT_LENGTH) {
    throw new RangeError("OCR text exceeds benchmark parser limit");
  }

  const text = rawText.replace(/\u00a0/g, " ");
  const ranked: RankedCandidate<ShelfPriceCandidate>[] = [];

  for (const rawCandidate of collectRawCandidates(text)) {
    if (
      !rawCandidate.explicitEuro &&
      !hasImplicitPriceContext(text, rawCandidate)
    ) {
      continue;
    }

    const parsed = parseEurDraft({
      raw: rawCandidate.rawMoney,
      mode: "decimal",
    });

    if (!parsed.ok) {
      continue;
    }

    const context = classifyContext(text, rawCandidate);
    const score = contextualScore(rawCandidate, context);

    ranked.push({
      start: rawCandidate.start,
      candidate: Object.freeze({
        minorUnits: parsed.value,
        displayValue: formatEur(parsed.value, "fi-FI"),
        kind: rawCandidate.kind,
        context,
        score,
      }),
    });
  }

  return rankAndDeduplicate(ranked);
};

export const PROMINENT_PRICE_RATIO = 0.6;
export const MAX_PRICE_TAG_LINES = 80;

const PROMINENCE_BONUS = 40;

export interface PriceTagTextLine {
  readonly text: string;
  readonly height: number;
}

export interface PriceTagSuperscriptCents {
  readonly lineIndex: number;
  readonly euros: number;
  readonly cents: number;
}

export interface PriceTagText {
  readonly lines: readonly PriceTagTextLine[];
  readonly superscript: PriceTagSuperscriptCents | null;
}

export interface PriceTagCandidate extends ShelfPriceCandidate {
  readonly prominent: boolean;
}

const isQuantity = (text: string, candidate: RawCandidate): boolean =>
  /^\s*(?:kg|g|l|dl|cl|ml|kpl|pcs|st)\b/i.test(
    surroundingWindow(text, candidate.start, candidate.end).after,
  );

const lineHeight = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const joinSeparatedCents = (text: string): string =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/(\d)[,.]\s*(\d)\s(\d)(?![\d.,])/g, "$1,$2$3")
    .replace(/(\d)[,.]\s+(\d{2})(?!\d)/g, "$1,$2");

const isSuperscriptCents = (
  value: PriceTagSuperscriptCents | null,
  lineCount: number,
): value is PriceTagSuperscriptCents =>
  value !== null &&
  Number.isSafeInteger(value.lineIndex) &&
  value.lineIndex >= 0 &&
  value.lineIndex < lineCount &&
  Number.isSafeInteger(value.euros) &&
  value.euros >= 0 &&
  value.euros <= 9999 &&
  Number.isSafeInteger(value.cents) &&
  value.cents >= 0 &&
  value.cents <= 99;

export const rankPriceTagCandidates = (
  reading: PriceTagText,
): readonly PriceTagCandidate[] => {
  const lines = reading.lines.slice(0, MAX_PRICE_TAG_LINES).map((line) => ({
    text: joinSeparatedCents(line.text),
    height: lineHeight(line.height),
  }));
  const starts: number[] = [];
  let text = "";

  for (const line of lines) {
    starts.push(text.length);
    text += `${line.text}\n`;
  }

  if (text.length > MAX_OCR_TEXT_LENGTH) {
    throw new RangeError("OCR text exceeds price tag parser limit");
  }

  const maxHeight = Math.max(0, ...lines.map((line) => line.height));
  const lineIndexAt = (offset: number): number => {
    let index = 0;

    while (index + 1 < starts.length && (starts[index + 1] ?? Infinity) <= offset) {
      index += 1;
    }

    return index;
  };
  const prominenceOf = (lineIndex: number): number =>
    maxHeight === 0 ? 0 : (lines[lineIndex]?.height ?? 0) / maxHeight;
  const superscript = isSuperscriptCents(reading.superscript, lines.length)
    ? reading.superscript
    : null;
  const superscriptWholeEuro =
    superscript === null
      ? null
      : Number(`${superscript.euros}${String(superscript.cents).padStart(2, "0")}`) * 100;
  const ranked: RankedCandidate<PriceTagCandidate>[] = [];

  for (const rawCandidate of collectRawCandidates(text)) {
    const lineIndex = lineIndexAt(rawCandidate.start);
    const prominence = prominenceOf(lineIndex);
    const prominent = prominence >= PROMINENT_PRICE_RATIO;

    if (
      !rawCandidate.explicitEuro &&
      (isQuantity(text, rawCandidate) ||
        (!prominent && !hasImplicitPriceContext(text, rawCandidate)))
    ) {
      continue;
    }

    const parsed = parseEurDraft({
      raw: rawCandidate.rawMoney,
      mode: "decimal",
    });

    if (!parsed.ok) {
      continue;
    }

    if (
      superscript !== null &&
      rawCandidate.kind === "whole-euro" &&
      lineIndex === superscript.lineIndex &&
      Number(parsed.value) === superscriptWholeEuro
    ) {
      continue;
    }

    const context = classifyContext(text, rawCandidate);

    ranked.push({
      start: rawCandidate.start,
      candidate: Object.freeze({
        minorUnits: parsed.value,
        displayValue: formatEur(parsed.value, "fi-FI"),
        kind: rawCandidate.kind,
        context,
        score:
          contextualScore(rawCandidate, context) +
          Math.round(PROMINENCE_BONUS * prominence),
        prominent,
      }),
    });
  }

  if (superscript !== null) {
    const start = starts[superscript.lineIndex] ?? 0;
    const rawMoney = `${superscript.euros},${String(superscript.cents).padStart(2, "0")}`;
    const parsed = parseEurDraft({ raw: rawMoney, mode: "decimal" });

    if (parsed.ok) {
      const rawCandidate: RawCandidate = {
        start,
        end: start + String(superscript.euros).length,
        rawMoney,
        kind: "split-cents",
        explicitEuro: true,
      };
      const context = classifyContext(text, rawCandidate);
      const prominence = prominenceOf(superscript.lineIndex);

      ranked.push({
        start,
        candidate: Object.freeze({
          minorUnits: parsed.value,
          displayValue: formatEur(parsed.value, "fi-FI"),
          kind: "split-cents",
          context,
          score:
            contextualScore(rawCandidate, context) +
            Math.round(PROMINENCE_BONUS * prominence),
          prominent: prominence >= PROMINENT_PRICE_RATIO,
        }),
      });
    }
  }

  return rankAndDeduplicate(ranked);
};
