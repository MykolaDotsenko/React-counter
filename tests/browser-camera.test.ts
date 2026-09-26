import { describe, expect, it, vi } from "vitest";

import {
  cameraFailure,
  canvasFrameGrabber,
  captureOutputSize,
  coverCropRect,
  createCamera,
  type BrowserCameraEnvironment,
} from "../src/infrastructure/camera/browser-camera";
import { createBrowserCamera } from "../src/infrastructure/camera/browser-camera-environment";

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

const fakeVideo = (overrides: Record<string, unknown> = {}) =>
  ({
    muted: false,
    playsInline: false,
    srcObject: null as MediaStream | null,
    readyState: 4,
    clientWidth: 400,
    clientHeight: 300,
    videoWidth: 1280,
    videoHeight: 720,
    play: vi.fn(async () => undefined),
    ...overrides,
  }) as unknown as HTMLVideoElement & { srcObject: MediaStream | null };

const environment = (
  overrides: Partial<BrowserCameraEnvironment> = {},
): BrowserCameraEnvironment => ({
  secureContext: true,
  mediaDevices: { getUserMedia: vi.fn(async () => fakeStream()) },
  grabFrame: vi.fn(async () => new Blob(["frame"], { type: "image/png" })),
  ...overrides,
});

const domError = (name: string) => Object.assign(new Error(name), { name });

const open = async (env: BrowserCameraEnvironment, video = fakeVideo()) => {
  const opened = await createCamera(env).open(video);

  if (!opened.ok) {
    throw new Error(`Expected a camera session, got ${opened.failure}`);
  }

  return opened.session;
};

describe("browser camera adapter", () => {
  it("is available only in a secure context with camera access", () => {
    expect(createCamera(environment()).isAvailable()).toBe(true);
    expect(createCamera(environment({ secureContext: false })).isAvailable()).toBe(false);
    expect(createCamera(environment({ mediaDevices: null })).isAvailable()).toBe(false);
  });

  it("refuses to open without a secure context or camera API", async () => {
    await expect(
      createCamera(environment({ secureContext: false })).open(fakeVideo()),
    ).resolves.toEqual({ ok: false, failure: "insecure-context" });
    await expect(
      createCamera(environment({ mediaDevices: null })).open(fakeVideo()),
    ).resolves.toEqual({ ok: false, failure: "unsupported" });
  });

  it("asks for the rear camera, plays muted inline and releases the camera on stop", async () => {
    const track = fakeTrack();
    const getUserMedia = vi.fn(async () => fakeStream(track));
    const video = fakeVideo();
    const session = await open(environment({ mediaDevices: { getUserMedia } }), video);

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);

    session.stop();

    expect(track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    await expect(session.captureStill({ x: 0, y: 0, width: 1, height: 1 })).resolves.toBeNull();
  });

  it("maps camera errors and retries without constraints when the camera cannot meet them", async () => {
    await expect(
      createCamera(
        environment({
          mediaDevices: {
            getUserMedia: vi.fn(async () => {
              throw domError("NotAllowedError");
            }),
          },
        }),
      ).open(fakeVideo()),
    ).resolves.toEqual({ ok: false, failure: "permission-denied" });

    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(domError("OverconstrainedError"))
      .mockResolvedValueOnce(fakeStream());

    await expect(
      createCamera(environment({ mediaDevices: { getUserMedia } })).open(fakeVideo()),
    ).resolves.toMatchObject({ ok: true });
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: true });

    const track = fakeTrack();
    const video = fakeVideo({ play: vi.fn(async () => Promise.reject(domError("AbortError"))) });

    await expect(
      createCamera(
        environment({ mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(track)) } }),
      ).open(video),
    ).resolves.toEqual({ ok: false, failure: "camera-busy" });
    expect(track.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();

    expect(cameraFailure(domError("NotReadableError"))).toBe("camera-busy");
    expect(cameraFailure(domError("NotFoundError"))).toBe("no-camera");
    expect(cameraFailure(domError("SecurityError"))).toBe("insecure-context");
    expect(cameraFailure(new Error("other"))).toBe("camera-error");
    expect(cameraFailure("nope")).toBe("camera-error");
  });

  it("offers the torch only when the camera reports one", async () => {
    const withTorch = fakeTrack({ torch: true });
    const session = await open(
      environment({ mediaDevices: { getUserMedia: vi.fn(async () => fakeStream(withTorch)) } }),
    );

    if (session.torch === null) {
      throw new Error("Expected a torch");
    }

    await expect(session.torch.set(true)).resolves.toBe(true);
    expect(session.torch.isOn()).toBe(true);
    expect(withTorch.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });

    withTorch.applyConstraints.mockRejectedValueOnce(new Error("no"));
    await expect(session.torch.set(false)).resolves.toBe(false);
    expect(session.torch.isOn()).toBe(true);

    expect((await open(environment())).torch).toBeNull();
  });

  it("captures exactly the framed part of a cover-fitted preview", async () => {
    const grabFrame = vi.fn(async () => new Blob(["frame"]));
    const video = fakeVideo();
    const session = await open(environment({ grabFrame }), video);

    await session.captureStill({ x: 0.1, y: 0.2, width: 0.8, height: 0.6 });

    expect(grabFrame).toHaveBeenCalledWith(
      video,
      { x: 256, y: 144, width: 768, height: 432 },
      { width: 768, height: 432 },
    );
  });

  it("does not capture before the preview has a frame or when grabbing fails", async () => {
    const grabFrame = vi.fn(async () => {
      throw new Error("tainted");
    });
    const notReady = await open(environment({ grabFrame }), fakeVideo({ readyState: 1 }));

    await expect(notReady.captureStill({ x: 0, y: 0, width: 1, height: 1 })).resolves.toBeNull();
    expect(grabFrame).not.toHaveBeenCalled();

    const failing = await open(environment({ grabFrame }));
    await expect(failing.captureStill({ x: 0, y: 0, width: 1, height: 1 })).resolves.toBeNull();

    const unsized = await open(environment({ grabFrame }), fakeVideo({ videoWidth: 0 }));
    await expect(unsized.captureStill({ x: 0, y: 0, width: 1, height: 1 })).resolves.toBeNull();
  });

  it("maps cover-fitted regions and bounds the captured size", () => {
    expect(
      coverCropRect({ width: 300, height: 300 }, { width: 1280, height: 720 }, {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toEqual({ x: 280, y: 0, width: 720, height: 720 });
    expect(
      coverCropRect({ width: 400, height: 300 }, { width: 1280, height: 720 }, {
        x: -1,
        y: -1,
        width: 5,
        height: 5,
      }),
    ).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(
      coverCropRect({ width: 400, height: 300 }, { width: 1280, height: 720 }, {
        x: 0.5,
        y: 0.5,
        width: 0,
        height: 0,
      }),
    ).toBeNull();
    expect(
      coverCropRect({ width: 0, height: 300 }, { width: 1280, height: 720 }, {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBeNull();
    expect(captureOutputSize({ x: 0, y: 0, width: 3200, height: 1600 })).toEqual({
      width: 1600,
      height: 800,
    });
    expect(captureOutputSize({ x: 0, y: 0, width: 640, height: 480 })).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("returns no frame when the browser cannot draw one", async () => {
    await expect(
      canvasFrameGrabber(fakeVideo(), { x: 0, y: 0, width: 10, height: 10 }, { width: 10, height: 10 }),
    ).resolves.toBeNull();
  });

  it("loads the camera implementation only when the camera is opened", async () => {
    const getUserMedia = vi.fn(async () => fakeStream());
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });

    try {
      const camera = createBrowserCamera();

      expect(camera?.isAvailable()).toBe(true);
      expect(getUserMedia).not.toHaveBeenCalled();
      await expect(camera?.open(fakeVideo())).resolves.toMatchObject({ ok: true });
      expect(getUserMedia).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }

    vi.stubGlobal("isSecureContext", false);

    try {
      expect(createBrowserCamera()?.isAvailable()).toBe(false);
      await expect(createBrowserCamera()?.open(fakeVideo())).resolves.toEqual({
        ok: false,
        failure: "insecure-context",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
