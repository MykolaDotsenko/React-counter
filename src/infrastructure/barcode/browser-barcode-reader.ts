import type {
  BarcodeReaderPort,
  BarcodeReading,
} from "../../application/barcode-ports";
import type { BarcodeSymbology } from "../../domain/product-code";

export const RETAIL_BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
] as const;

interface DetectedBarcodeLike {
  readonly rawValue: string;
  readonly format?: string;
}

export interface FrameBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<readonly DetectedBarcodeLike[]>;
}

export interface NativeDetectorConstructor {
  new (options?: { readonly formats?: readonly string[] }): FrameBarcodeDetector;
  getSupportedFormats?: () => Promise<readonly string[]>;
}

export interface BarcodeReaderEnvironment {
  readonly nativeDetector: NativeDetectorConstructor | null;
  readonly loadFallbackDetector: () => Promise<FrameBarcodeDetector>;
  readonly prefetchFallback: () => void;
}

const SYMBOLOGIES: Readonly<Record<string, BarcodeSymbology>> = {
  ean_13: "ean-13",
  ean_8: "ean-8",
  upc_a: "upc-a",
  upc_e: "upc-e",
  EAN13: "ean-13",
  EAN8: "ean-8",
  UPCA: "upc-a",
  UPCE: "upc-e",
  "EAN-13": "ean-13",
  "EAN-8": "ean-8",
  "UPC-A": "upc-a",
  "UPC-E": "upc-e",
};

export const toReading = (detected: DetectedBarcodeLike): BarcodeReading => ({
  rawValue: detected.rawValue,
  symbology:
    detected.format === undefined ? null : (SYMBOLOGIES[detected.format] ?? null),
});

const nativeSupportsRetailFormats = async (
  Detector: NativeDetectorConstructor,
): Promise<boolean> => {
  if (Detector.getSupportedFormats === undefined) {
    return false;
  }

  try {
    const supported = new Set(await Detector.getSupportedFormats());
    return RETAIL_BARCODE_FORMATS.every((format) => supported.has(format));
  } catch {
    return false;
  }
};

export const createBarcodeReader = (
  environment: BarcodeReaderEnvironment,
): BarcodeReaderPort => {
  let nativeUsable: Promise<boolean> | null = null;
  let prepared = false;
  const nativeReady = (): Promise<boolean> => {
    const Detector = environment.nativeDetector;

    nativeUsable ??=
      Detector === null
        ? Promise.resolve(false)
        : nativeSupportsRetailFormats(Detector);

    return nativeUsable;
  };

  return {
    prepare() {
      if (prepared) {
        return;
      }

      prepared = true;
      void nativeReady().then((usable) => {
        if (!usable) {
          environment.prefetchFallback();
        }
      });
    },

    async attach(preview) {
      try {
        const Detector = environment.nativeDetector;
        const native = Detector !== null && (await nativeReady());
        const detector =
          native && Detector !== null
            ? new Detector({ formats: RETAIL_BARCODE_FORMATS })
            : await environment.loadFallbackDetector();

        return {
          engine: native ? "native" : "fallback",
          async detect() {
            if (preview.readyState < 2) {
              return [];
            }

            const detected = await detector.detect(preview);
            return detected.map(toReading);
          },
        };
      } catch {
        return null;
      }
    },
  };
};
