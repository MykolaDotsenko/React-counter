import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { BarcodeBenchmarkCamera } from "../src/qa/BarcodeBenchmarkCamera";
import type {
  BarcodeBenchmarkEnvironment,
  BarcodeBenchmarkSample,
} from "../src/qa/barcode-benchmark";

const environment: BarcodeBenchmarkEnvironment = {
  userAgent: "Camera Test Browser",
  viewportWidth: 390,
  viewportHeight: 844,
  detectorSupported: true,
  cameraSupported: true,
  supportedFormats: ["ean_13"],
};

const installCamera = (
  detect: () => Promise<
    readonly {
      readonly rawValue: string;
      readonly format?: string;
    }[]
  >,
) => {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);

  class FakeBarcodeDetector {
    static async getSupportedFormats() {
      return ["ean_13"];
    }

    detect() {
      return detect();
    }
  }

  Object.defineProperty(globalThis, "BarcodeDetector", {
    configurable: true,
    value: FakeBarcodeDetector,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);

  return {
    stop,
    getUserMedia,
    play,
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "BarcodeDetector");
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("BarcodeBenchmarkCamera", () => {
  it("ignores a stale detector result after manual fallback finalized the attempt", async () => {
    let resolveDetection:
      | ((
          results: readonly {
            readonly rawValue: string;
            readonly format?: string;
          }[],
        ) => void)
      | null = null;

    const camera = installCamera(
      () =>
        new Promise((resolve) => {
          resolveDetection = resolve;
        }),
    );
    const onSample = vi.fn<(sample: BarcodeBenchmarkSample) => void>();
    const onAttemptActiveChange = vi.fn();

    render(
      <BarcodeBenchmarkCamera
        environment={environment}
        onFailure={vi.fn()}
        onSample={onSample}
        onStatus={vi.fn()}
        onAttemptActiveChange={onAttemptActiveChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start camera" }),
    );

    await screen.findByRole("button", { name: "Camera ready" });

    fireEvent.click(
      screen.getByRole("button", { name: "Start timed scan" }),
    );

    await waitFor(() => {
      expect(resolveDetection).not.toBeNull();
      expect(onAttemptActiveChange).toHaveBeenCalledWith(true);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Manual fallback" }),
    );

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(onSample.mock.calls[0]?.[0]).toMatchObject({
      outcome: "manual-fallback",
      detectedFormat: null,
    });
    expect(onAttemptActiveChange).toHaveBeenCalledWith(false);

    const resolve = resolveDetection;

    if (resolve === null) {
      throw new Error("Expected a pending detector request");
    }

    await act(async () => {
      resolve([
        {
          rawValue: "6412345678901",
          format: "ean_13",
        },
      ]);
      await Promise.resolve();
    });

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("6412345678901")).toBeNull();

    camera.play.mockRestore();
  });

  it("enforces the eight-second timeout even when detector.detect never resolves", async () => {
    installCamera(
      () =>
        new Promise(() => {
          // Deliberately unresolved: the benchmark timeout must own the wall clock.
        }),
    );
    const onSample = vi.fn<(sample: BarcodeBenchmarkSample) => void>();

    render(
      <BarcodeBenchmarkCamera
        environment={environment}
        onFailure={vi.fn()}
        onSample={onSample}
        onStatus={vi.fn()}
        onAttemptActiveChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start camera" }),
    );
    await screen.findByRole("button", { name: "Camera ready" });

    vi.useFakeTimers();

    fireEvent.click(
      screen.getByRole("button", { name: "Start timed scan" }),
    );

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(onSample.mock.calls[0]?.[0]).toMatchObject({
      outcome: "timeout",
      detectedFormat: null,
    });
  });
});
