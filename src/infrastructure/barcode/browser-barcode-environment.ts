import type { BarcodeReaderPort } from "../../application/barcode-ports";
import {
  createBarcodeReader,
  type FrameBarcodeDetector,
  type NativeDetectorConstructor,
} from "./browser-barcode-reader";

const loadFallbackDetector = async (): Promise<FrameBarcodeDetector> => {
  const { createZxingFallbackDetector } = await import(
    "./zxing-fallback-detector"
  );
  return await createZxingFallbackDetector();
};

const prefetchFallback = (): void => {
  void import("./zxing-fallback-detector")
    .then(({ ZXING_READER_WASM_URL }) =>
      fetch(ZXING_READER_WASM_URL, { credentials: "same-origin" }),
    )
    .catch(() => undefined);
};

export const createBrowserBarcodeReader = (): BarcodeReaderPort | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const nativeDetector =
    (
      globalThis as typeof globalThis & {
        BarcodeDetector?: NativeDetectorConstructor;
      }
    ).BarcodeDetector ?? null;

  return createBarcodeReader({
    nativeDetector,
    loadFallbackDetector,
    prefetchFallback,
  });
};
