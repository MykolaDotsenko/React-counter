import type { BarcodeScannerPort } from "../../application/barcode-ports";
import {
  createBarcodeScanner,
  type FrameBarcodeDetector,
  type NativeDetectorConstructor,
} from "./browser-barcode-scanner";

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

export const createBrowserBarcodeScanner = (): BarcodeScannerPort | null => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  const nativeDetector =
    (
      globalThis as typeof globalThis & {
        BarcodeDetector?: NativeDetectorConstructor;
      }
    ).BarcodeDetector ?? null;

  return createBarcodeScanner({
    secureContext: window.isSecureContext,
    mediaDevices:
      typeof navigator.mediaDevices?.getUserMedia === "function"
        ? navigator.mediaDevices
        : null,
    nativeDetector,
    loadFallbackDetector,
    prefetchFallback,
  });
};
