import { describe, expect, it, vi } from "vitest";

import {
  createBarcodeReader,
  toReading,
  type BarcodeReaderEnvironment,
  type FrameBarcodeDetector,
  type NativeDetectorConstructor,
} from "../src/infrastructure/barcode/browser-barcode-reader";

const detectorReturning = (
  results: readonly { rawValue: string; format?: string }[],
): FrameBarcodeDetector => ({
  detect: vi.fn(async () => results),
});

const nativeWith = (
  formats: readonly string[] | (() => Promise<readonly string[]>),
  detector: FrameBarcodeDetector,
): NativeDetectorConstructor => {
  const Constructor = vi.fn(function Native() {
    return detector;
  }) as unknown as NativeDetectorConstructor;
  Constructor.getSupportedFormats =
    typeof formats === "function" ? formats : async () => formats;
  return Constructor;
};

const environment = (
  overrides: Partial<BarcodeReaderEnvironment> = {},
): BarcodeReaderEnvironment => ({
  nativeDetector: null,
  loadFallbackDetector: vi.fn(async () => detectorReturning([])),
  prefetchFallback: vi.fn(),
  ...overrides,
});

const preview = (readyState = 4) => ({ readyState }) as HTMLVideoElement;

describe("barcode frame reader adapter", () => {
  it("uses the native detector when it reads every retail format", async () => {
    const native = detectorReturning([{ rawValue: "6414893386303", format: "ean_13" }]);
    const loadFallbackDetector = vi.fn(async () => detectorReturning([]));
    const reader = await createBarcodeReader(
      environment({
        nativeDetector: nativeWith(["qr_code", "ean_13", "ean_8", "upc_a", "upc_e"], native),
        loadFallbackDetector,
      }),
    ).attach(preview());

    expect(reader?.engine).toBe("native");
    expect(loadFallbackDetector).not.toHaveBeenCalled();
    await expect(reader?.detect()).resolves.toEqual([
      { rawValue: "6414893386303", symbology: "ean-13" },
    ]);
  });

  it("falls back to the lazy engine when the native detector lacks a retail format or fails to answer", async () => {
    const fallback = detectorReturning([{ rawValue: "96385074", format: "EAN8" }]);
    const missingFormat = await createBarcodeReader(
      environment({
        nativeDetector: nativeWith(["qr_code", "ean_13"], detectorReturning([])),
        loadFallbackDetector: vi.fn(async () => fallback),
      }),
    ).attach(preview());

    expect(missingFormat?.engine).toBe("fallback");
    await expect(missingFormat?.detect()).resolves.toEqual([
      { rawValue: "96385074", symbology: "ean-8" },
    ]);

    const throwing = await createBarcodeReader(
      environment({
        nativeDetector: nativeWith(async () => {
          throw new Error("no");
        }, detectorReturning([])),
      }),
    ).attach(preview());

    expect(throwing?.engine).toBe("fallback");

    const noFormatsApi = vi.fn(function Native() {
      return detectorReturning([]);
    }) as unknown as NativeDetectorConstructor;

    expect(
      (await createBarcodeReader(environment({ nativeDetector: noFormatsApi })).attach(preview()))
        ?.engine,
    ).toBe("fallback");
  });

  it("reports an engine that cannot load instead of throwing", async () => {
    await expect(
      createBarcodeReader(
        environment({
          loadFallbackDetector: vi.fn(async () => {
            throw new Error("offline");
          }),
        }),
      ).attach(preview()),
    ).resolves.toBeNull();
  });

  it("prefetches the fallback engine once, only where the native detector is not enough", async () => {
    const prefetchFallback = vi.fn();
    const reader = createBarcodeReader(environment({ prefetchFallback }));

    reader.prepare();
    reader.prepare();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(prefetchFallback).toHaveBeenCalledTimes(1);

    const nativePrefetch = vi.fn();
    createBarcodeReader(
      environment({
        nativeDetector: nativeWith(["ean_13", "ean_8", "upc_a", "upc_e"], detectorReturning([])),
        prefetchFallback: nativePrefetch,
      }),
    ).prepare();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(nativePrefetch).not.toHaveBeenCalled();
  });

  it("does not detect before the preview has a frame and ignores unknown formats", async () => {
    const detector = detectorReturning([{ rawValue: "6414893386303" }]);
    const reader = await createBarcodeReader(
      environment({ loadFallbackDetector: async () => detector }),
    ).attach(preview(1));

    await expect(reader?.detect()).resolves.toEqual([]);
    expect(detector.detect).not.toHaveBeenCalled();
    expect(toReading({ rawValue: "123", format: "qr_code" })).toEqual({
      rawValue: "123",
      symbology: null,
    });
    expect(toReading({ rawValue: "123" })).toEqual({ rawValue: "123", symbology: null });
  });
});
