import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPriceTagReader,
  createLazyTesseractPriceReader,
  priceOcrAssets,
  wasmSimdSupported,
} from "../src/infrastructure/price-ocr/lazy-price-reader";
import {
  centsFromText,
  centsRegion,
  heroWord,
  layoutLines,
  priceTagLines,
  superscriptInWord,
  wholeEuros,
  type OcrLine,
  type OcrSymbol,
  type OcrWord,
} from "../src/infrastructure/price-ocr/tesseract-layout";
import {
  createTesseractPriceEngine,
  normalizeContrast,
  ocrScale,
  preparationFraction,
  type PriceOcrWorker,
  type PriceTagEngine,
  type PriceTagEngineDependencies,
} from "../src/infrastructure/price-ocr/tesseract-price-reader";

const createEngineModule = vi.hoisted(() => ({
  createTesseractPriceEngine: vi.fn(),
}));

vi.mock("../src/infrastructure/price-ocr/tesseract-price-reader", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/infrastructure/price-ocr/tesseract-price-reader")
  >();

  return {
    ...actual,
    createTesseractPriceEngine: vi.fn(
      (...args: Parameters<typeof actual.createTesseractPriceEngine>) =>
        createEngineModule.createTesseractPriceEngine.getMockImplementation() === undefined
          ? actual.createTesseractPriceEngine(...args)
          : createEngineModule.createTesseractPriceEngine(...args),
    ),
  };
});

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

const symbol = (text: string, x0: number, y0: number, width: number, height: number): OcrSymbol => ({
  text,
  bbox: box(x0, y0, x0 + width, y0 + height),
});

const word = (text: string, height: number, symbols: readonly OcrSymbol[] = [], y0 = 0): OcrWord => ({
  text,
  bbox: box(0, y0, 40 * Math.max(1, text.length), y0 + height),
  symbols,
});

const line = (text: string, height: number, words?: readonly OcrWord[]): OcrLine => ({
  text,
  bbox: box(0, 0, 400, height),
  words: words ?? [word(text, height)],
});

const page = (lines: readonly OcrLine[]) => ({
  data: {
    text: lines.map((entry) => entry.text).join("\n"),
    blocks: [{ paragraphs: [{ lines }] }],
  },
});

interface FakePage {
  readonly data: { readonly text: string; readonly blocks?: unknown };
}

const fakeWorker = (...pages: readonly FakePage[]) => {
  const queue = [...pages];
  const worker = {
    setParameters: vi.fn(async () => undefined),
    recognize: vi.fn(async () => {
      const next = queue.shift();

      if (next === undefined) {
        throw new Error("unexpected recognize call");
      }

      return next;
    }),
    terminate: vi.fn(async () => undefined),
  };
  return worker;
};

const prepared = {
  image: new Blob(["png"], { type: "image/png" }),
  width: 1200,
  height: 800,
};

const dependencies = (
  workers: readonly PriceOcrWorker[],
  overrides: Partial<PriceTagEngineDependencies> = {},
): PriceTagEngineDependencies => {
  const queue = [...workers];

  return {
    createWorker: vi.fn(async () => {
      const next = queue.shift();

      if (next === undefined) {
        throw new Error("no worker");
      }

      return next;
    }),
    prepareImage: vi.fn(async () => prepared),
    timeoutMs: 1_000,
    ...overrides,
  };
};

const assets = { workerPath: "/w.js", corePath: "/c.js", langPath: "/lang" };
const frame = new Blob(["frame"], { type: "image/png" });

afterEach(() => {
  vi.useRealTimers();
  createEngineModule.createTesseractPriceEngine.mockReset();
});

describe("Tesseract layout mapping", () => {
  it("reads nested blocks defensively", () => {
    const lines = layoutLines([
      { paragraphs: [{ lines: [line("1,29 €", 120), { text: 5 }, { text: "x", bbox: box(0, 5, 1, 1) }] }] },
      "junk",
      { paragraphs: "none" },
    ]);

    expect(lines.map((entry) => entry.text)).toEqual(["1,29 €"]);
    expect(layoutLines(null)).toEqual([]);
  });

  it("measures each line by its tallest number", () => {
    expect(
      priceTagLines([
        line("Valio 1 l", 40, [word("Valio", 40), word("1", 30)]),
        line("JÄSENHINTA", 32, [word("JÄSENHINTA", 32)]),
      ]),
    ).toEqual([
      { text: "Valio 1 l", height: 30 },
      { text: "JÄSENHINTA", height: 32 },
    ]);
  });

  it("finds the tallest number and its whole euros", () => {
    const hero = heroWord([
      line("Norm. 2,99 €", 30, [word("2,99", 30)]),
      line("3", 120, [word("Iso", 150), word("3”.", 120)]),
    ]);

    expect(hero?.lineIndex).toBe(1);
    expect(hero?.word.text).toBe("3”.");
    expect(hero === null ? null : wholeEuros(hero.word)).toBe(3);
    expect(wholeEuros(word("2,49", 100))).toBeNull();
    expect(wholeEuros(word("1,", 100))).toBeNull();
    expect(wholeEuros(word("3.", 100))).toBe(3);
    expect(wholeEuros(word("€12", 100))).toBe(12);
    expect(heroWord([line("Hinta", 40)])).toBeNull();
  });

  it("recognises raised small cents inside one word", () => {
    const raised = word("399", 120, [
      symbol("3", 0, 0, 60, 120),
      symbol("9", 64, 0, 30, 50),
      symbol("9", 96, 0, 30, 50),
    ]);
    const flat = word("399", 120, [
      symbol("3", 0, 0, 60, 120),
      symbol("9", 64, 0, 60, 120),
      symbol("9", 128, 0, 60, 120),
    ]);

    expect(superscriptInWord({ lineIndex: 2, word: raised })).toEqual({
      lineIndex: 2,
      euros: 3,
      cents: 99,
    });
    expect(superscriptInWord({ lineIndex: 0, word: flat })).toBeNull();
    expect(superscriptInWord({ lineIndex: 0, word: word("39", 120, [symbol("3", 0, 0, 60, 120), symbol("9", 64, 0, 30, 50)]) })).toBeNull();
  });

  it("targets the area right of the euros for a second read", () => {
    const hero = {
      lineIndex: 0,
      word: word("3", 100, [symbol("3", 10, 20, 50, 100)], 20),
    };

    expect(centsRegion(hero, { width: 1200, height: 800 })).toEqual({
      left: 62,
      top: 15,
      width: 95,
      height: 55,
    });
    expect(centsRegion(hero, { width: 66, height: 800 })).toBeNull();
    expect(centsFromText(" 9 9\n")).toBe(99);
    expect(centsFromText("909")).toBeNull();
    expect(centsFromText("")).toBeNull();
  });
});

describe("Tesseract price engine", () => {
  it("reads a headline price in one pass", async () => {
    const worker = fakeWorker(
      page([line("Banaani luomu", 40), line("1.99", 110), line("1 kg = 3.98", 30)]),
    );
    const engine = await createTesseractPriceEngine(assets, vi.fn(), dependencies([worker]));
    const result = await engine.read(frame, new AbortController().signal);

    expect(result).toMatchObject({ status: "read", candidates: [{ minorUnits: 199, prominent: true }] });
    expect(worker.recognize).toHaveBeenCalledTimes(1);
    expect(worker.setParameters).toHaveBeenCalledWith({
      tessedit_pageseg_mode: "11",
      tessedit_char_whitelist: "",
    });
  });

  it("reads superscript cents with a second, digits-only pass", async () => {
    const worker = fakeWorker(
      page([
        line("Juustoraaste 150 g", 38),
        line("3”.", 123, [word("3”.", 123, [symbol("3", 10, 0, 60, 123), symbol("”", 74, 0, 20, 30)])]),
        line("26,60 €/kg", 30),
      ]),
      { data: { text: "99\n" } },
    );
    const engine = await createTesseractPriceEngine(assets, vi.fn(), dependencies([worker]));
    const result = await engine.read(frame, new AbortController().signal);

    expect(result).toMatchObject({
      status: "read",
      candidates: [{ minorUnits: 399, kind: "split-cents" }, { minorUnits: 2660 }],
    });
    expect(worker.setParameters).toHaveBeenLastCalledWith({
      tessedit_pageseg_mode: "7",
      tessedit_char_whitelist: "0123456789",
    });
    expect(worker.recognize).toHaveBeenLastCalledWith(
      prepared.image,
      { rectangle: { left: 72, top: 0, width: 117, height: 68 } },
      { text: true, blocks: false },
    );
  });

  it("uses raised cents found in the first pass without a second read", async () => {
    const worker = fakeWorker(
      page([
        line("399", 120, [
          word("399", 120, [
            symbol("3", 0, 0, 60, 120),
            symbol("9", 64, 0, 30, 50),
            symbol("9", 96, 0, 30, 50),
          ]),
        ]),
      ]),
    );
    const engine = await createTesseractPriceEngine(assets, vi.fn(), dependencies([worker]));

    await expect(engine.read(frame, new AbortController().signal)).resolves.toMatchObject({
      status: "read",
      candidates: [{ minorUnits: 399 }],
    });
    expect(worker.recognize).toHaveBeenCalledTimes(1);
  });

  it("reports a tag without a readable price, and a whole-euro hero whose cents stay unreadable", async () => {
    const empty = await createTesseractPriceEngine(
      assets,
      vi.fn(),
      dependencies([fakeWorker(page([line("Tuote 429", 100)]), { data: { text: "" } })]),
    );

    await expect(empty.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "no-price",
    });

    const unreadable = await createTesseractPriceEngine(
      assets,
      vi.fn(),
      dependencies([
        fakeWorker(page([line("3", 120, [word("3", 120, [symbol("3", 0, 0, 60, 120)])])]), {
          data: { text: "9" },
        }),
      ]),
    );

    await expect(unreadable.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "no-price",
    });
  });

  it("replaces a worker that fails and recovers on the next read", async () => {
    const broken = fakeWorker();
    const healthy = fakeWorker(page([line("2,49 €", 120)]));
    const deps = dependencies([broken, healthy]);
    const engine = await createTesseractPriceEngine(assets, vi.fn(), deps);

    await expect(engine.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "failed",
      reason: "engine-failed",
    });
    expect(broken.terminate).toHaveBeenCalled();

    await expect(engine.read(frame, new AbortController().signal)).resolves.toMatchObject({
      status: "read",
    });
    expect(deps.createWorker).toHaveBeenCalledTimes(2);
  });

  it("gives up on a slow read and on an unreadable image", async () => {
    const hanging = {
      setParameters: vi.fn(async () => undefined),
      recognize: vi.fn(() => new Promise<never>(() => undefined)),
      terminate: vi.fn(async () => undefined),
    };
    const slow = await createTesseractPriceEngine(
      assets,
      vi.fn(),
      dependencies([hanging], { timeoutMs: 20 }),
    );

    await expect(slow.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "failed",
      reason: "timeout",
    });
    expect(hanging.terminate).toHaveBeenCalled();

    const blind = await createTesseractPriceEngine(
      assets,
      vi.fn(),
      dependencies([fakeWorker()], { prepareImage: vi.fn(async () => null) }),
    );

    await expect(blind.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "failed",
      reason: "engine-failed",
    });

    const crashing = await createTesseractPriceEngine(
      assets,
      vi.fn(),
      dependencies([fakeWorker()], {
        prepareImage: vi.fn(async () => {
          throw new Error("decode");
        }),
      }),
    );

    await expect(crashing.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "failed",
      reason: "engine-failed",
    });
  });

  it("stops at once when the shopper cancels, and releases the worker", async () => {
    const hanging = {
      setParameters: vi.fn(async () => undefined),
      recognize: vi.fn(() => new Promise<never>(() => undefined)),
      terminate: vi.fn(async () => undefined),
    };
    const engine = await createTesseractPriceEngine(assets, vi.fn(), dependencies([hanging]));
    const cancel = new AbortController();
    const pending = engine.read(frame, cancel.signal);

    await vi.waitFor(() => {
      expect(hanging.recognize).toHaveBeenCalled();
    });
    cancel.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(hanging.terminate).toHaveBeenCalled();

    const already = new AbortController();
    already.abort();
    await expect(engine.read(frame, already.signal)).rejects.toThrow();
  });

  it("refuses to read after it is disposed and disposes only once", async () => {
    const worker = fakeWorker();
    const engine = await createTesseractPriceEngine(assets, vi.fn(), dependencies([worker]));

    await engine.dispose();
    await engine.dispose();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await expect(engine.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "failed",
      reason: "engine-failed",
    });
  });

  it("reports preparation progress across loading stages", () => {
    expect(preparationFraction("loading tesseract core", 0)).toBe(0);
    expect(preparationFraction("loading tesseract core", 1)).toBeCloseTo(0.35);
    expect(preparationFraction("loading language traineddata", 0.5)).toBeCloseTo(0.65);
    expect(preparationFraction("initializing api", 1)).toBeCloseTo(1);
    expect(preparationFraction("initializing api", 7)).toBeCloseTo(0.9);
    expect(preparationFraction("recognizing text", 0.5)).toBeNull();
    expect(preparationFraction(undefined, 1)).toBeNull();
  });

  it("scales small crops up and large ones down, and stretches weak contrast", () => {
    expect(ocrScale(500, 300)).toBe(2);
    expect(ocrScale(2400, 1200)).toBeCloseTo(2 / 3);
    expect(ocrScale(1200, 800)).toBe(1);
    expect(ocrScale(100, 900)).toBeCloseTo(1600 / 900);
    expect(ocrScale(0, 0)).toBe(1);

    const pixels = new Uint8ClampedArray([
      100, 100, 100, 255, 150, 150, 150, 255, 100, 100, 100, 255, 150, 150, 150, 255,
    ]);
    normalizeContrast(pixels);

    expect([pixels[0], pixels[4], pixels[5], pixels[6]]).toEqual([0, 255, 255, 255]);

    const flat = new Uint8ClampedArray([120, 120, 120, 255, 125, 125, 125, 255]);
    normalizeContrast(flat);

    expect([flat[0], flat[4]]).toEqual([120, 125]);
  });
});

describe("lazy price tag reader", () => {
  const engineReturning = (result: Awaited<ReturnType<PriceTagEngine["read"]>>) => ({
    read: vi.fn(async () => result),
    dispose: vi.fn(async () => undefined),
  });

  it("loads the engine once, shares progress and keeps it warm between reads", async () => {
    const engine = engineReturning({ status: "no-price" });
    const loadEngine = vi.fn(async (onProgress: (progress: { fraction: number | null }) => void) => {
      onProgress({ fraction: 0.5 });
      return engine;
    });
    const reader = createPriceTagReader({ loadEngine });
    const progress = vi.fn();

    await expect(reader.prepare(progress)).resolves.toBe(true);
    await expect(reader.prepare()).resolves.toBe(true);
    await expect(reader.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "no-price",
    });

    expect(loadEngine).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith({ fraction: 0.5 });
  });

  it("retries a failed load and reports it as an engine failure", async () => {
    const engine = engineReturning({ status: "no-price" });
    const loadEngine = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(engine);
    const reader = createPriceTagReader({ loadEngine });

    await expect(reader.prepare()).resolves.toBe(false);
    await expect(reader.read(frame, new AbortController().signal)).resolves.toEqual({
      status: "failed",
      reason: "engine-failed",
    });
    await expect(reader.prepare()).resolves.toBe(true);
    expect(loadEngine).toHaveBeenCalledTimes(3);
  });

  it("releases the engine after a quiet period or on request", async () => {
    vi.useFakeTimers();
    const first = engineReturning({ status: "no-price" });
    const second = engineReturning({ status: "no-price" });
    const loadEngine = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const reader = createPriceTagReader({ loadEngine, idleMs: 1_000 });

    await reader.read(frame, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(first.dispose).toHaveBeenCalled();

    await reader.read(frame, new AbortController().signal);
    reader.release();
    await vi.advanceTimersByTimeAsync(0);

    expect(second.dispose).toHaveBeenCalled();
    expect(loadEngine).toHaveBeenCalledTimes(2);
  });

  it("does not start a read that was already cancelled", async () => {
    const loadEngine = vi.fn();
    const cancelled = new AbortController();
    cancelled.abort();

    await expect(
      createPriceTagReader({ loadEngine }).read(frame, cancelled.signal),
    ).rejects.toThrow();
    expect(loadEngine).not.toHaveBeenCalled();
  });

  it("points the engine at this site's own worker, core and language files", () => {
    expect(priceOcrAssets("https://example.test/app/", "assets/ocr/v1", true)).toEqual({
      workerPath: "https://example.test/app/assets/ocr/v1/worker.min.js",
      corePath: "https://example.test/app/assets/ocr/v1/tesseract-core-simd-lstm.js",
      langPath: "https://example.test/app/assets/ocr/v1/lang",
    });
    expect(priceOcrAssets("https://example.test/app", "assets/ocr/v1", false).corePath).toBe(
      "https://example.test/app/assets/ocr/v1/tesseract-core-lstm.js",
    );
    expect(typeof wasmSimdSupported()).toBe("boolean");
  });

  it("loads the Tesseract engine only when a read is prepared", async () => {
    const engine = engineReturning({ status: "no-price" });
    createEngineModule.createTesseractPriceEngine.mockImplementation(async () => engine);
    const reader = createLazyTesseractPriceReader();

    expect(createEngineModule.createTesseractPriceEngine).not.toHaveBeenCalled();
    await expect(reader.prepare()).resolves.toBe(true);

    const [paths] = createEngineModule.createTesseractPriceEngine.mock.calls[0] as unknown as [
      { workerPath: string; corePath: string; langPath: string },
    ];

    expect(paths.workerPath).toMatch(/\/assets\/ocr\/test\/worker\.min\.js$/);
    expect(paths.langPath).toMatch(/\/assets\/ocr\/test\/lang$/);
    reader.release();
  });
});
