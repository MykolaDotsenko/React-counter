import type { CameraPort } from "../../application/camera-ports";

export const createBrowserCamera = (): CameraPort | null => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  const secureContext = window.isSecureContext === true;
  const mediaDevices =
    typeof navigator.mediaDevices?.getUserMedia === "function"
      ? navigator.mediaDevices
      : null;

  return {
    isAvailable: () => secureContext && mediaDevices !== null,
    async open(preview) {
      const { canvasFrameGrabber, createCamera } = await import(
        "./browser-camera"
      );

      return await createCamera({
        secureContext,
        mediaDevices,
        grabFrame: canvasFrameGrabber,
      }).open(preview);
    },
  };
};
