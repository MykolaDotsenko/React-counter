import {
  formatEur,
  parseEurDraft,
  type MinorUnits,
} from "../domain/money";

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
  before: text.slice(Math.max(0, start - 32), start).toLocaleLowerCase(),
  around: text
    .slice(Math.max(0, start - 32), Math.min(text.length, end + 32))
    .toLocaleLowerCase(),
  after: text.slice(end, Math.min(text.length, end + 24)).toLocaleLowerCase(),
});

const classifyContext = (
  text: string,
  candidate: RawCandidate,
): ShelfPriceCandidateContext => {
  const window = surroundingWindow(text, candidate.start, candidate.end);

  const unitPrice =
    /^\s*(?:€\s*)?\/\s*(?:kg|g|100\s*g|l|cl|ml|kpl|pcs|st)\b/i.test(
      window.after,
    ) ||
    /(?:€\s*)?\/\s*(?:kg|g|100\s*g|l|cl|ml|kpl|pcs|st)\b/i.test(
      window.around,
    );

  const multiBuy =
    /\b\d+\s*(?:kpl|pcs|st|pkt|pack)\b/i.test(window.before) ||
    /\b\d+\s*[x×]\s*$/i.test(window.before);

  const regularPrice =
    /\b(?:norm\.?|normaali(?:hinta)?|regular|ennen|was)\b/i.test(
      window.around,
    );

  const loyaltyPrice =
    /\b(?:jäsen|plussa|k-plussa|s-etukortti|member|club)\b/i.test(
      window.around,
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

export const parseShelfPriceCandidates = (
  rawText: string,
): readonly ShelfPriceCandidate[] => {
  if (rawText.length > MAX_OCR_TEXT_LENGTH) {
    throw new RangeError("OCR text exceeds benchmark parser limit");
  }

  const text = rawText.replace(/\u00a0/g, " ");
  const ranked: {
    readonly candidate: ShelfPriceCandidate;
    readonly start: number;
  }[] = [];

  for (const rawCandidate of collectRawCandidates(text)) {
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

  ranked.sort(
    (left, right) =>
      right.candidate.score - left.candidate.score ||
      left.start - right.start ||
      Number(left.candidate.minorUnits) -
        Number(right.candidate.minorUnits),
  );

  const deduplicated: ShelfPriceCandidate[] = [];
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
