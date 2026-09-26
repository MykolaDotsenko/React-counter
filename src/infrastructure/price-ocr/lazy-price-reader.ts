import type {
  PriceTagReaderPort,
  PriceTagReaderProgress,
} from "../../application/price-tag-ports";
import type {
  PriceTagEngine,
  TesseractAssets,
} from "./tesseract-price-reader";

const PRICE_READER_IDLE_MS = 120_000;

export type PriceTagEngineLoader = (
  onProgress: (progress: PriceTagReaderProgress) => void,
) => Promise<PriceTagEngine>;

export interface PriceTagReaderOptions {
  readonly loadEngine: PriceTagEngineLoader;
  readonly idleMs?: number;
}

export const createPriceTagReader = ({
  loadEngine,
  idleMs = PRICE_READER_IDLE_MS,
}: PriceTagReaderOptions): PriceTagReaderPort => {
  let engine: Promise<PriceTagEngine> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(progress: PriceTagReaderProgress) => void>();

  const release = (): void => {
    clearTimeout(idleTimer);
    const current = engine;
    engine = null;
    void current?.then((loaded) => loaded.dispose()).catch(() => undefined);
  };

  const scheduleRelease = (): void => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(release, idleMs);
  };

  const ensureEngine = (): Promise<PriceTagEngine> => {
    const pending =
      engine ??
      loadEngine((progress) => {
        for (const listener of listeners) {
          listener(progress);
        }
      });

    if (engine === null) {
      engine = pending;
      pending.catch(() => {
        if (engine === pending) {
          engine = null;
        }
      });
    }

    return pending;
  };

  return {
    async prepare(onProgress) {
      if (onProgress !== undefined) {
        listeners.add(onProgress);
      }

      try {
        await ensureEngine();
        scheduleRelease();
        return true;
      } catch {
        return false;
      } finally {
        if (onProgress !== undefined) {
          listeners.delete(onProgress);
        }
      }
    },

    async read(image, signal) {
      signal.throwIfAborted();
      clearTimeout(idleTimer);

      let ready: PriceTagEngine;

      try {
        ready = await ensureEngine();
      } catch {
        return { status: "failed", reason: "engine-failed" };
      }

      try {
        return await ready.read(image, signal);
      } finally {
        scheduleRelease();
      }
    },

    release,
  };
};

const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1,
  8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

export const wasmSimdSupported = (): boolean => {
  try {
    return (
      typeof WebAssembly === "object" && WebAssembly.validate(SIMD_PROBE)
    );
  } catch {
    return false;
  }
};

export const priceOcrAssets = (
  base: string,
  directory: string,
  simd: boolean,
): TesseractAssets => {
  const root = `${base.endsWith("/") ? base : `${base}/`}${directory}`;

  return {
    workerPath: `${root}/worker.min.js`,
    corePath: `${root}/tesseract-core-${simd ? "simd-" : ""}lstm.js`,
    langPath: `${root}/lang`,
  };
};

export const createLazyTesseractPriceReader = (): PriceTagReaderPort =>
  createPriceTagReader({
    loadEngine: async (onProgress) => {
      const { createTesseractPriceEngine } = await import(
        "./tesseract-price-reader"
      );
      return await createTesseractPriceEngine(
        priceOcrAssets(
          new URL(import.meta.env.BASE_URL, window.location.href).href,
          __PRICE_OCR_ASSET_DIR__,
          wasmSimdSupported(),
        ),
        onProgress,
      );
    },
  });
