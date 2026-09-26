import type {
  PriceTagSuperscriptCents,
  PriceTagTextLine,
} from "../../domain/shelf-price";

export interface OcrBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface OcrSymbol {
  readonly text: string;
  readonly bbox: OcrBox;
}

export interface OcrWord {
  readonly text: string;
  readonly bbox: OcrBox;
  readonly symbols: readonly OcrSymbol[];
}

export interface OcrLine {
  readonly text: string;
  readonly bbox: OcrBox;
  readonly words: readonly OcrWord[];
}

export interface OcrRectangle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface HeroWord {
  readonly lineIndex: number;
  readonly word: OcrWord;
}

const MAX_LAYOUT_LINES = 80;
const SUPERSCRIPT_HEIGHT_RATIO = 0.75;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toBox = (value: unknown): OcrBox | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { x0, y0, x1, y1 } = value;

  return typeof x0 === "number" &&
    typeof y0 === "number" &&
    typeof x1 === "number" &&
    typeof y1 === "number" &&
    [x0, y0, x1, y1].every(Number.isFinite) &&
    x1 >= x0 &&
    y1 >= y0
    ? { x0, y0, x1, y1 }
    : null;
};

const listOf = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const toSymbol = (value: unknown): OcrSymbol | null => {
  if (!isRecord(value) || typeof value.text !== "string") {
    return null;
  }

  const bbox = toBox(value.bbox);
  return bbox === null ? null : { text: value.text, bbox };
};

const toWord = (value: unknown): OcrWord | null => {
  if (!isRecord(value) || typeof value.text !== "string") {
    return null;
  }

  const bbox = toBox(value.bbox);

  if (bbox === null) {
    return null;
  }

  return {
    text: value.text,
    bbox,
    symbols: listOf(value.symbols)
      .map(toSymbol)
      .filter((symbol): symbol is OcrSymbol => symbol !== null),
  };
};

const toLine = (value: unknown): OcrLine | null => {
  if (!isRecord(value) || typeof value.text !== "string") {
    return null;
  }

  const bbox = toBox(value.bbox);

  if (bbox === null) {
    return null;
  }

  return {
    text: value.text,
    bbox,
    words: listOf(value.words)
      .map(toWord)
      .filter((word): word is OcrWord => word !== null),
  };
};

export const layoutLines = (blocks: unknown): readonly OcrLine[] =>
  listOf(blocks)
    .flatMap((block) => (isRecord(block) ? listOf(block.paragraphs) : []))
    .flatMap((paragraph) =>
      isRecord(paragraph) ? listOf(paragraph.lines) : [],
    )
    .map(toLine)
    .filter((line): line is OcrLine => line !== null)
    .slice(0, MAX_LAYOUT_LINES);

const heightOf = (box: OcrBox): number => box.y1 - box.y0;

const hasDigit = (text: string): boolean => /\d/.test(text);

export const priceTagLines = (
  lines: readonly OcrLine[],
): readonly PriceTagTextLine[] =>
  lines.map((line) => {
    const numericHeights = line.words
      .filter((word) => hasDigit(word.text))
      .map((word) => heightOf(word.bbox));

    return {
      text: line.text.trim(),
      height:
        numericHeights.length > 0
          ? Math.max(...numericHeights)
          : heightOf(line.bbox),
    };
  });

export const heroWord = (lines: readonly OcrLine[]): HeroWord | null => {
  let hero: HeroWord | null = null;

  for (const [lineIndex, line] of lines.entries()) {
    for (const word of line.words) {
      if (
        hasDigit(word.text) &&
        (hero === null || heightOf(word.bbox) > heightOf(hero.word.bbox))
      ) {
        hero = { lineIndex, word };
      }
    }
  }

  return hero;
};

export const wholeEuros = (word: OcrWord): number | null => {
  const match = /^[^\d]*(\d{1,4})(?!\d|,|\.\d)/.exec(word.text);
  return match?.[1] === undefined ? null : Number(match[1]);
};

export const superscriptInWord = (
  hero: HeroWord,
): PriceTagSuperscriptCents | null => {
  const digits = hero.word.symbols.filter((symbol) => /^\d$/.test(symbol.text));

  if (digits.length < 3 || digits.length > 6) {
    return null;
  }

  const lead = digits.slice(0, -2);
  const cents = digits.slice(-2);
  const leadHeight = Math.max(...lead.map((symbol) => heightOf(symbol.bbox)));
  const leadMiddle = Math.min(
    ...lead.map((symbol) => (symbol.bbox.y0 + symbol.bbox.y1) / 2),
  );
  const raised = cents.every(
    (symbol) =>
      heightOf(symbol.bbox) <= leadHeight * SUPERSCRIPT_HEIGHT_RATIO &&
      symbol.bbox.y1 <= leadMiddle + leadHeight * 0.15,
  );

  if (!raised || leadHeight <= 0) {
    return null;
  }

  return {
    lineIndex: hero.lineIndex,
    euros: Number(lead.map((symbol) => symbol.text).join("")),
    cents: Number(cents.map((symbol) => symbol.text).join("")),
  };
};

export const centsRegion = (
  hero: HeroWord,
  image: { readonly width: number; readonly height: number },
): OcrRectangle | null => {
  const height = heightOf(hero.word.bbox);
  const digits = hero.word.symbols.filter((symbol) => /^\d$/.test(symbol.text));
  const lastDigit = digits.at(-1)?.bbox ?? hero.word.bbox;
  const left = Math.round(lastDigit.x1 + height * 0.02);
  const top = Math.max(0, Math.round(hero.word.bbox.y0 - height * 0.05));
  const width = Math.min(Math.round(height * 0.95), image.width - left);
  const regionHeight = Math.min(Math.round(height * 0.55), image.height - top);

  return height > 0 && width >= 8 && regionHeight >= 8
    ? { left, top, width, height: regionHeight }
    : null;
};

export const centsFromText = (text: string): number | null => {
  const digits = text.replace(/\D/g, "");
  return digits.length === 2 ? Number(digits) : null;
};
