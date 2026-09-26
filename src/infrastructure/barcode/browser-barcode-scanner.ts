import type {
  BarcodeReading,
  BarcodeScannerPort,
  ScannerFailure,
  ScannerSession,
  ScannerStartResult,
  TorchControl,
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

export interface BrowserScannerEnvironment {
  readonly secureContext: boolean;
  readonly mediaDevices: Pick<MediaDevices, "getUserMedia"> | null;
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

export const cameraFailure = (error: unknown): ScannerFailure => {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "permission-denied";
    case "SecurityError":
      return "insecure-context";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "camera-busy";
    default:
      return "camera-error";
  }
};

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

const stopStream = (stream: MediaStream | null): void => {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
};

const torchFor = (track: MediaStreamTrack | undefined): TorchControl | null => {
  const capabilities =
    track !== undefined && typeof track.getCapabilities === "function"
      ? (track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean })
      : null;

  if (track === undefined || capabilities?.torch !== true) {
    return null;
  }

  let on = false;

  return {
    isOn: () => on,
    async set(next) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: next } as MediaTrackConstraintSet],
        });
        on = next;
        return true;
      } catch {
        return false;
      }
    },
  };
};

const openStream = async (
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
): Promise<MediaStream> => {
  try {
    return await mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch (error) {
    if (cameraFailure(error) !== "no-camera") {
      throw error;
    }

    return await mediaDevices.getUserMedia({ audio: false, video: true });
  }
};

export const createBarcodeScanner = (
  environment: BrowserScannerEnvironment,
): BarcodeScannerPort => {
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

  const createDetector = async (): Promise<{
    readonly detector: FrameBarcodeDetector;
    readonly engine: ScannerSession["engine"];
  }> => {
    const Detector = environment.nativeDetector;

    if (Detector !== null && (await nativeReady())) {
      return {
        detector: new Detector({ formats: RETAIL_BARCODE_FORMATS }),
        engine: "native",
      };
    }

    return {
      detector: await environment.loadFallbackDetector(),
      engine: "fallback",
    };
  };

  return {
    isAvailable: () =>
      environment.secureContext && environment.mediaDevices !== null,

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

    async start(preview): Promise<ScannerStartResult> {
      if (!environment.secureContext) {
        return { ok: false, failure: "insecure-context" };
      }

      if (environment.mediaDevices === null) {
        return { ok: false, failure: "unsupported" };
      }

      const detectorPromise = createDetector().then(
        (value) => ({ ok: true as const, value }),
        () => ({ ok: false as const }),
      );
      let stream: MediaStream | null = null;

      try {
        stream = await openStream(environment.mediaDevices);
        preview.muted = true;
        preview.playsInline = true;
        preview.srcObject = stream;
        await preview.play();
      } catch (error) {
        stopStream(stream);
        preview.srcObject = null;
        return { ok: false, failure: cameraFailure(error) };
      }

      const created = await detectorPromise;

      if (!created.ok) {
        stopStream(stream);
        preview.srcObject = null;
        return { ok: false, failure: "engine-failed" };
      }

      const activeStream = stream;
      let stopped = false;

      return {
        ok: true,
        session: {
          engine: created.value.engine,
          torch: torchFor(activeStream.getVideoTracks()[0]),
          async detect() {
            if (stopped || preview.readyState < 2) {
              return [];
            }

            const detected = await created.value.detector.detect(preview);
            return stopped ? [] : detected.map(toReading);
          },
          stop() {
            stopped = true;
            stopStream(activeStream);
            preview.srcObject = null;
          },
        },
      };
    },
  };
};
