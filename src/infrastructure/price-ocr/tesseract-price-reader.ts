import { createWorker, OEM, PSM } from "tesseract.js";

import type {
  PriceTagReadResult,
  PriceTagReaderProgress,
} from "../../application/price-tag-ports";
import {
  rankPriceTagCandidates,
  type PriceTagSuperscriptCents,
} from "../../domain/shelf-price";
import {
  centsFromText,
  centsRegion,
  heroWord,
  layoutLines,
  priceTagLines,
  superscriptInWord,
  wholeEuros,
  type OcrRectangle,
} from "./tesseract-layout";

export const PRICE_OCR_LANGUAGE = "fin";
export const PRICE_OCR_TIMEOUT_MS = 20_000;

export interface TesseractAssets {
  readonly workerPath: string;
  readonly corePath: string;
  readonly langPath: string;
}

export interface PreparedImage {
  readonly image: Blob;
  readonly width: number;
  readonly height: number;
}

interface RecognizeOutput {
  readonly data: { readonly text: string; readonly blocks?: unknown };
}

export interface PriceOcrWorker {
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  recognize(
    image: Blob,
    options: { readonly rectangle?: OcrRectangle },
    output: { readonly text: boolean; readonly blocks: boolean },
  ): Promise<RecognizeOutput>;
  terminate(): Promise<unknown>;
}

export interface PriceTagEngine {
  read(image: Blob, signal: AbortSignal): Promise<PriceTagReadResult>;
  dispose(): Promise<void>;
}

export interface PriceTagEngineDependencies {
  readonly createWorker: (
    assets: TesseractAssets,
    onProgress: (progress: PriceTagReaderProgress) => void,
  ) => Promise<PriceOcrWorker>;
  readonly prepareImage: (image: Blob) => Promise<PreparedImage | null>;
  readonly timeoutMs: number;
}

const PREPARATION_STAGES: readonly (readonly [string, number])[] = [
  ["loading tesseract core", 0.35],
  ["initializing tesseract", 0.05],
  ["loading language traineddata", 0.5],
  ["initializing api", 0.1],
];

export const preparationFraction = (
  status: unknown,
  progress: unknown,
): number | null => {
  if (typeof status !== "string") {
    return null;
  }

  let completed = 0;

  for (const [stage, weight] of PREPARATION_STAGES) {
    if (stage === status) {
      const share =
        typeof progress === "number" && progress >= 0 && progress <= 1
          ? progress
          : 0;
      return Math.min(1, completed + weight * share);
    }

    completed += weight;
  }

  return null;
};

const defaultCreateWorker: PriceTagEngineDependencies["createWorker"] =
  async (assets, onProgress) => {
    const worker = await createWorker(PRICE_OCR_LANGUAGE, OEM.LSTM_ONLY, {
      workerPath: assets.workerPath,
      corePath: assets.corePath,
      langPath: assets.langPath,
      cacheMethod: "none",
      gzip: true,
      workerBlobURL: false,
      logger: (message: { status?: unknown; progress?: unknown }) => {
        const fraction = preparationFraction(message.status, message.progress);

        if (fraction !== null) {
          onProgress({ fraction });
        }
      },
    });

    return worker as unknown as PriceOcrWorker;
  };

const MIN_OCR_WIDTH = 1000;
const MAX_OCR_EDGE = 1600;

export const ocrScale = (width: number, height: number): number => {
  const longest = Math.max(width, height);

  if (longest <= 0) {
    return 1;
  }

  const upscale = width < MIN_OCR_WIDTH ? MIN_OCR_WIDTH / width : 1;
  return Math.min(upscale, MAX_OCR_EDGE / longest, 3);
};

export const normalizeContrast = (pixels: Uint8ClampedArray): void => {
  const histogram = new Uint32Array(256);
  const count = Math.floor(pixels.length / 4);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const luminance = Math.round(
      0.299 * (pixels[offset] ?? 0) +
        0.587 * (pixels[offset + 1] ?? 0) +
        0.114 * (pixels[offset + 2] ?? 0),
    );
    histogram[luminance] = (histogram[luminance] ?? 0) + 1;
    pixels[offset] = luminance;
  }

  const clip = Math.floor(count * 0.01);
  let low = 0;
  let high = 255;
  let seen = 0;

  while (low < 255 && seen + (histogram[low] ?? 0) <= clip) {
    seen += histogram[low] ?? 0;
    low += 1;
  }

  seen = 0;

  while (high > 0 && seen + (histogram[high] ?? 0) <= clip) {
    seen += histogram[high] ?? 0;
    high -= 1;
  }

  const range = high - low;

  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const luminance = pixels[offset] ?? 0;
    const stretched =
      range < 32 ? luminance : ((luminance - low) * 255) / range;
    pixels[offset] = stretched;
    pixels[offset + 1] = stretched;
    pixels[offset + 2] = stretched;
  }
};

const canvasImagePreparer = async (
  image: Blob,
): Promise<PreparedImage | null> => {
  const bitmap = await createImageBitmap(image);

  try {
    const scale = ocrScale(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");

    if (context === null) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    normalizeContrast(pixels.data);
    context.putImageData(pixels, 0, 0);

    return {
      image: await canvas.convertToBlob({ type: "image/png" }),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
};

const abortError = (): DOMException =>
  new DOMException("Price tag reading aborted", "AbortError");

class TimeoutError extends Error {}

export const createTesseractPriceEngine = async (
  assets: TesseractAssets,
  onProgress: (progress: PriceTagReaderProgress) => void,
  dependencies: PriceTagEngineDependencies = {
    createWorker: defaultCreateWorker,
    prepareImage: canvasImagePreparer,
    timeoutMs: PRICE_OCR_TIMEOUT_MS,
  },
): Promise<PriceTagEngine> => {
  let worker: PriceOcrWorker | null = await dependencies.createWorker(
    assets,
    onProgress,
  );
  let disposed = false;

  const invalidate = (expected: PriceOcrWorker): void => {
    if (worker === expected) {
      worker = null;
    }

    void expected.terminate().catch(() => undefined);
  };

  const readWith = async (
    active: PriceOcrWorker,
    prepared: PreparedImage,
    signal: AbortSignal,
  ): Promise<PriceTagReadResult> => {
    await active.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "",
    });
    const page = await active.recognize(prepared.image, {}, {
      text: true,
      blocks: true,
    });
    signal.throwIfAborted();

    const lines = layoutLines(page.data.blocks);
    const hero = heroWord(lines);
    let superscript: PriceTagSuperscriptCents | null = null;

    if (hero !== null && wholeEuros(hero.word) !== null) {
      superscript = superscriptInWord(hero);

      const region = superscript === null ? centsRegion(hero, prepared) : null;
      const euros = wholeEuros(hero.word);

      if (region !== null && euros !== null) {
        await active.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
          tessedit_char_whitelist: "0123456789",
        });
        const second = await active.recognize(
          prepared.image,
          { rectangle: region },
          { text: true, blocks: false },
        );
        signal.throwIfAborted();
        const cents = centsFromText(second.data.text);

        if (cents !== null) {
          superscript = { lineIndex: hero.lineIndex, euros, cents };
        }
      }
    }

    const candidates = rankPriceTagCandidates({
      lines: priceTagLines(lines),
      superscript,
    });

    return candidates.length === 0
      ? { status: "no-price" }
      : { status: "read", candidates };
  };

  return {
    async read(image, signal) {
      if (disposed) {
        return { status: "failed", reason: "engine-failed" };
      }

      signal.throwIfAborted();

      let prepared: PreparedImage | null;

      try {
        prepared = await dependencies.prepareImage(image);
      } catch {
        prepared = null;
      }

      signal.throwIfAborted();

      if (prepared === null) {
        return { status: "failed", reason: "engine-failed" };
      }

      let active: PriceOcrWorker;

      try {
        active = worker ?? (await dependencies.createWorker(assets, onProgress));
        worker = active;
      } catch {
        return { status: "failed", reason: "engine-failed" };
      }

      if (disposed) {
        invalidate(active);
        return { status: "failed", reason: "engine-failed" };
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      const interrupted = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutError());
        }, dependencies.timeoutMs);
        onAbort = () => {
          reject(abortError());
        };
        signal.addEventListener("abort", onAbort, { once: true });
      });

      try {
        return await Promise.race([
          readWith(active, prepared, signal),
          interrupted,
        ]);
      } catch (error) {
        invalidate(active);

        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        return {
          status: "failed",
          reason: error instanceof TimeoutError ? "timeout" : "engine-failed",
        };
      } finally {
        clearTimeout(timer);

        if (onAbort !== undefined) {
          signal.removeEventListener("abort", onAbort);
        }
      }
    },

    async dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      const active = worker;
      worker = null;

      if (active !== null) {
        await active.terminate().catch(() => undefined);
      }
    },
  };
};
