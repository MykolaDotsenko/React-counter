export type CameraFailure =
  | "unsupported"
  | "insecure-context"
  | "permission-denied"
  | "no-camera"
  | "camera-busy"
  | "camera-error";

export interface TorchControl {
  readonly isOn: () => boolean;
  readonly set: (on: boolean) => Promise<boolean>;
}

export interface CameraFrameRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraSession {
  readonly torch: TorchControl | null;
  readonly captureStill: (region: CameraFrameRegion) => Promise<Blob | null>;
  readonly stop: () => void;
}

export type CameraOpenResult =
  | { readonly ok: true; readonly session: CameraSession }
  | { readonly ok: false; readonly failure: CameraFailure };

export interface CameraPort {
  readonly isAvailable: () => boolean;
  readonly open: (preview: HTMLVideoElement) => Promise<CameraOpenResult>;
}
