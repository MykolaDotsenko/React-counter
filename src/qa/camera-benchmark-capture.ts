export const benchmarkCameraFailureType = (
  error: unknown,
): "permission-denied" | "camera-error" =>
  error instanceof DOMException &&
  (error.name === "NotAllowedError" ||
    error.name === "SecurityError")
    ? "permission-denied"
    : "camera-error";

export interface BenchmarkFrameOptions {
  readonly maxLongEdge: number;
  readonly quality: number;
}

const DEFAULT_FRAME_OPTIONS: BenchmarkFrameOptions = {
  maxLongEdge: 1_600,
  quality: 0.86,
};

const boundedDimensions = (
  width: number,
  height: number,
  maxLongEdge: number,
): { readonly width: number; readonly height: number } => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const longEdge = Math.max(safeWidth, safeHeight);

  if (longEdge <= maxLongEdge) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = maxLongEdge / longEdge;

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
};

export const captureBenchmarkFrame = async (
  video: HTMLVideoElement,
  options: BenchmarkFrameOptions = DEFAULT_FRAME_OPTIONS,
): Promise<Blob> => {
  if (
    !Number.isFinite(options.maxLongEdge) ||
    options.maxLongEdge < 320 ||
    options.maxLongEdge > 4_096 ||
    !Number.isFinite(options.quality) ||
    options.quality <= 0 ||
    options.quality > 1
  ) {
    throw new RangeError("Invalid benchmark frame capture options");
  }

  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  const dimensions = boundedDimensions(
    sourceWidth,
    sourceHeight,
    options.maxLongEdge,
  );
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("Canvas capture is unavailable");
  }

  context.drawImage(
    video,
    0,
    0,
    dimensions.width,
    dimensions.height,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("Camera frame capture failed"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      options.quality,
    );
  });
};

export const stopBenchmarkMediaStream = (
  stream: MediaStream | null,
): void => {
  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
};
