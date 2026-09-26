import type {
  CameraFailure,
  CameraFrameRegion,
  CameraPort,
  TorchControl,
} from "../../application/camera-ports";

export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

export interface SourceRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type FrameGrabber = (
  video: HTMLVideoElement,
  source: SourceRect,
  output: FrameSize,
) => Promise<Blob | null>;

export interface BrowserCameraEnvironment {
  readonly secureContext: boolean;
  readonly mediaDevices: Pick<MediaDevices, "getUserMedia"> | null;
  readonly grabFrame: FrameGrabber;
}

export const MAX_CAPTURE_EDGE = 1600;

export const cameraFailure = (error: unknown): CameraFailure => {
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

const isPositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export const coverCropRect = (
  element: FrameSize,
  video: FrameSize,
  region: CameraFrameRegion,
): SourceRect | null => {
  if (
    !isPositive(element.width) ||
    !isPositive(element.height) ||
    !isPositive(video.width) ||
    !isPositive(video.height)
  ) {
    return null;
  }

  const scale = Math.max(
    element.width / video.width,
    element.height / video.height,
  );
  const offsetX = (element.width - video.width * scale) / 2;
  const offsetY = (element.height - video.height * scale) / 2;
  const toVideoX = (value: number): number =>
    Math.min(
      Math.max((value * element.width - offsetX) / scale, 0),
      video.width,
    );
  const toVideoY = (value: number): number =>
    Math.min(
      Math.max((value * element.height - offsetY) / scale, 0),
      video.height,
    );
  const left = toVideoX(region.x);
  const top = toVideoY(region.y);
  const width = toVideoX(region.x + region.width) - left;
  const height = toVideoY(region.y + region.height) - top;

  if (width < 1 || height < 1) {
    return null;
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
};

export const captureOutputSize = (
  source: SourceRect,
  maxEdge: number = MAX_CAPTURE_EDGE,
): FrameSize => {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));

  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
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

export const createCamera = (
  environment: BrowserCameraEnvironment,
): CameraPort => ({
  isAvailable: () =>
    environment.secureContext && environment.mediaDevices !== null,

  async open(preview) {
    if (!environment.secureContext) {
      return { ok: false, failure: "insecure-context" };
    }

    if (environment.mediaDevices === null) {
      return { ok: false, failure: "unsupported" };
    }

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

    const activeStream = stream;
    let stopped = false;

    return {
      ok: true,
      session: {
        torch: torchFor(activeStream.getVideoTracks()[0]),
        async captureStill(region) {
          if (stopped || preview.readyState < 2) {
            return null;
          }

          const source = coverCropRect(
            { width: preview.clientWidth, height: preview.clientHeight },
            { width: preview.videoWidth, height: preview.videoHeight },
            region,
          );

          if (source === null) {
            return null;
          }

          try {
            return await environment.grabFrame(
              preview,
              source,
              captureOutputSize(source),
            );
          } catch {
            return null;
          }
        },
        stop() {
          stopped = true;
          stopStream(activeStream);
          preview.srcObject = null;
        },
      },
    };
  },
});

export const canvasFrameGrabber: FrameGrabber = async (
  video,
  source,
  output,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");

  if (context === null) {
    return null;
  }

  context.drawImage(
    video,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    output.width,
    output.height,
  );

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
};
