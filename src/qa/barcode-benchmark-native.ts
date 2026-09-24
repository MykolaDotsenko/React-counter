import type { BarcodeBenchmarkEnvironment } from "./barcode-benchmark";

export interface DetectedBarcode {
  readonly rawValue: string;
  readonly format?: string;
}

export interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>;
}

export interface NativeBarcodeDetectorConstructor {
  new (options?: {
    readonly formats?: readonly string[];
  }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<readonly string[]>;
}

export const PREFERRED_BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
] as const;

export const barcodeDetectorConstructor =
  (): NativeBarcodeDetectorConstructor | null =>
    (
      globalThis as typeof globalThis & {
        BarcodeDetector?: NativeBarcodeDetectorConstructor;
      }
    ).BarcodeDetector ?? null;

export const captureBarcodeBenchmarkEnvironment =
  async (): Promise<BarcodeBenchmarkEnvironment> => {
    const detector = barcodeDetectorConstructor();
    let supportedFormats: readonly string[] = [];

    if (detector?.getSupportedFormats !== undefined) {
      try {
        supportedFormats = await detector.getSupportedFormats();
      } catch {
        supportedFormats = [];
      }
    }

    return {
      userAgent: navigator.userAgent.slice(0, 512),
      viewportWidth: Math.max(1, Math.round(window.innerWidth)),
      viewportHeight: Math.max(1, Math.round(window.innerHeight)),
      detectorSupported: detector !== null,
      cameraSupported:
        navigator.mediaDevices?.getUserMedia !== undefined,
      supportedFormats: [
        ...new Set(
          supportedFormats
            .filter((format) => format.trim().length > 0)
            .slice(0, 32),
        ),
      ].sort(),
    };
  };

export const createNativeBarcodeDetector = (
  environment: BarcodeBenchmarkEnvironment,
): NativeBarcodeDetector | null => {
  const Constructor = barcodeDetectorConstructor();

  if (Constructor === null) {
    return null;
  }

  const preferred = PREFERRED_BARCODE_FORMATS.filter((format) =>
    environment.supportedFormats.includes(format),
  );

  return new Constructor(
    preferred.length > 0
      ? { formats: preferred }
      : undefined,
  );
};
