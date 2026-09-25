import { describe, expect, it, vi } from "vitest";

import {
  cameraFailure,
  createBarcodeScanner,
  toReading,
  type BrowserScannerEnvironment,
  type FrameBarcodeDetector,
  type NativeDetectorConstructor,
} from "../src/infrastructure/barcode/browser-barcode-scanner";

const fakeTrack = (capabilities: Record<string, unknown> = {}) => ({
  stop: vi.fn(),
  getCapabilities: () => capabilities,
  applyConstraints: vi.fn(async () => undefined),
});

const fakeStream = (track = fakeTrack()) =>
  ({
    getTracks: () => [track],
    getVideoTracks: () => [track],
  }) as unknown as MediaStream;

const fakeVideo = () =>
  ({
    muted: false,
    playsInline: false,
    srcObject: null as MediaStream | null,
    readyState: 4,
    play: vi.fn(async () => undefined),
  }) as unknown as HTMLVideoElement & { srcObject: MediaStream | null };

const detectorReturning = (
  results: readonly { rawValue: string; format?: string }[],
): FrameBarcodeDetector => ({
  detect: vi.fn(async () => results),
});

const nativeWith = (
  formats: readonly string[],
  detector: FrameBarcodeDetector,
): NativeDetectorConstructor => {
  const Constructor = vi.fn(function Native() {
    return detector;
  }) as unknown as NativeDetectorConstructor;
  Constructor.getSupportedFormats = async () => formats;
  return Constructor;
};

const environment = (
  overrides: Partial<BrowserScannerEnvironment> = {},
): BrowserScannerEnvironment => ({
  secureContext: true,
  mediaDevices: { getUserMedia: vi.fn(async () => fakeStream()) },
  nativeDetector: null,
  loadFallbackDetector: vi.fn(async () => detectorReturning([])),
  prefetchFallback: vi.fn(),
  ...overrides,
});

const domError = (name: string) => Object.assign(new Error(name), { name });

describe("browser barcode scanner adapter", () => {
  it("is available only in a secure context with camera access", () => {
    expect(createBarcodeScanner(environment()).isAvailable()).toBe(true);
    expect(createBarcodeScanner(environment({ secureContext: false })).isAvailable()).toBe(false);
    expect(createBarcodeScanner(environment({ mediaDevices: null })).isAvailable()).toBe(false);
  });

  it("refuses to start without a secure context or camera API", async () => {
    await expect(
      createBarcodeScanner(environment({ secureContext: false })).start(fakeVideo()),
    ).resolves.toEqual({ ok: false, failure: "insecure-context" });
    await expect(
      createBarcodeScanner(environment({ mediaDevices: null })).start(fakeVideo()),
    ).resolves.toEqual({ ok: false, failure: "unsupported" });
  });

  it("uses the native detector when it reads every retail format", async () => {
    const native = detectorReturning([{ rawValue: "6414893386303", format: "ean_13" }]);
    const track = fakeTrack();
    const loadFallbackDetector = vi.fn(async () => detectorReturning([]));
    const scanner = createBarcodeScanner(
      environment({
        nativeDetector: nativeWith(["qr_code", "ean_13", "ean_8", "upc_a", "upc_e"], native),
        mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(track)) },
        loadFallbackDetector,
      }),
    );
    const video = fakeVideo();
    const started = await scanner.start(video);

    if (!started.ok) {
      throw new Error("Expected a session");
    }

    expect(started.session.engine).toBe("native");
    expect(loadFallbackDetector).not.toHaveBeenCalled();
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    await expect(started.session.detect()).resolves.toEqual([
      { rawValue: "6414893386303", symbology: "ean-13" },
    ]);

    started.session.stop();

    expect(track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    await expect(started.session.detect()).resolves.toEqual([]);
  });

  it("falls back to the lazy engine when the native detector lacks a retail format", async () => {
    const fallback = detectorReturning([{ rawValue: "96385074", format: "EAN8" }]);
    const scanner = createBarcodeScanner(
      environment({
        nativeDetector: nativeWith(["qr_code", "ean_13"], detectorReturning([])),
        loadFallbackDetector: vi.fn(async () => fallback),
      }),
    );
    const started = await scanner.start(fakeVideo());

    if (!started.ok) {
      throw new Error("Expected a session");
    }

    expect(started.session.engine).toBe("fallback");
    await expect(started.session.detect()).resolves.toEqual([
      { rawValue: "96385074", symbology: "ean-8" },
    ]);
  });

  it("releases the camera when the barcode engine cannot load", async () => {
    const track = fakeTrack();
    const video = fakeVideo();
    const scanner = createBarcodeScanner(
      environment({
        mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(track)) },
        loadFallbackDetector: vi.fn(async () => {
          throw new Error("offline");
        }),
      }),
    );

    await expect(scanner.start(video)).resolves.toEqual({
      ok: false,
      failure: "engine-failed",
    });
    expect(track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it("maps camera errors and retries without constraints when the camera cannot meet them", async () => {
    const denied = createBarcodeScanner(
      environment({
        mediaDevices: {
          getUserMedia: vi.fn(async () => {
            throw domError("NotAllowedError");
          }),
        },
      }),
    );

    await expect(denied.start(fakeVideo())).resolves.toEqual({
      ok: false,
      failure: "permission-denied",
    });

    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(domError("OverconstrainedError"))
      .mockResolvedValueOnce(fakeStream());
    const relaxed = createBarcodeScanner(environment({ mediaDevices: { getUserMedia } }));

    await expect(relaxed.start(fakeVideo())).resolves.toMatchObject({ ok: true });
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: true });

    expect(cameraFailure(domError("NotReadableError"))).toBe("camera-busy");
    expect(cameraFailure(domError("NotFoundError"))).toBe("no-camera");
    expect(cameraFailure(domError("SecurityError"))).toBe("insecure-context");
    expect(cameraFailure(new Error("other"))).toBe("camera-error");
    expect(cameraFailure("nope")).toBe("camera-error");
  });

  it("offers the torch only when the camera reports one", async () => {
    const withTorch = fakeTrack({ torch: true });
    const scanner = createBarcodeScanner(
      environment({ mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(withTorch)) } }),
    );
    const started = await scanner.start(fakeVideo());

    if (!started.ok || started.session.torch === null) {
      throw new Error("Expected a torch");
    }

    await expect(started.session.torch.set(true)).resolves.toBe(true);
    expect(started.session.torch.isOn()).toBe(true);
    expect(withTorch.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });

    withTorch.applyConstraints.mockRejectedValueOnce(new Error("no"));
    await expect(started.session.torch.set(false)).resolves.toBe(false);
    expect(started.session.torch.isOn()).toBe(true);

    const plain = await createBarcodeScanner(environment()).start(fakeVideo());
    expect(plain.ok && plain.session.torch).toBeNull();
  });

  it("prefetches the fallback engine once, only where the native detector is not enough", async () => {
    const prefetchFallback = vi.fn();
    const scanner = createBarcodeScanner(environment({ prefetchFallback }));

    scanner.prepare();
    scanner.prepare();
    await Promise.resolve();
    await Promise.resolve();

    expect(prefetchFallback).toHaveBeenCalledTimes(1);

    const nativePrefetch = vi.fn();
    const nativeScanner = createBarcodeScanner(
      environment({
        nativeDetector: nativeWith(["ean_13", "ean_8", "upc_a", "upc_e"], detectorReturning([])),
        prefetchFallback: nativePrefetch,
      }),
    );

    nativeScanner.prepare();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(nativePrefetch).not.toHaveBeenCalled();
  });

  it("does not detect before the preview has a frame", async () => {
    const detector = detectorReturning([{ rawValue: "6414893386303" }]);
    const scanner = createBarcodeScanner(environment({ loadFallbackDetector: async () => detector }));
    const video = fakeVideo();
    Object.assign(video, { readyState: 1 });
    const started = await scanner.start(video);

    expect(started.ok && (await started.session.detect())).toEqual([]);
    expect(detector.detect).not.toHaveBeenCalled();
    expect(toReading({ rawValue: "123", format: "qr_code" })).toEqual({
      rawValue: "123",
      symbology: null,
    });
  });
});
