import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
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

const originalViewport = {
  width: window.innerWidth,
  height: window.innerHeight,
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: environment.viewportWidth,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: environment.viewportHeight,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "BarcodeDetector");
  Reflect.deleteProperty(navigator, "mediaDevices");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: originalViewport.width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: originalViewport.height,
  });
});

describe("BarcodeBenchmarkCamera", () => {
  it("ignores a stale detector result after manual fallback finalized the attempt", async () => {
    let resolveDetection!: (
      results: readonly {
        readonly rawValue: string;
        readonly format?: string;
      }[],
    ) => void;

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
      expect(resolveDetection).toBeTypeOf("function");
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

    await act(async () => {
      resolveDetection([
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

  it("refuses to mix a changed viewport into the retained benchmark session", async () => {
    installCamera(async () => []);
    const onSample = vi.fn<(sample: BarcodeBenchmarkSample) => void>();
    const onStatus = vi.fn();
    try {
      render(
        <BarcodeBenchmarkCamera
          environment={environment}
          onFailure={vi.fn()}
          onSample={onSample}
          onStatus={onStatus}
          onAttemptActiveChange={vi.fn()}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Start camera" }),
      );
      await screen.findByRole("button", { name: "Camera ready" });

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 844,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 390,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Start timed scan" }),
      );

      expect(onSample).not.toHaveBeenCalled();
      expect(onStatus).toHaveBeenLastCalledWith(
        expect.stringContaining("Viewport changed"),
      );
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: environment.viewportWidth,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: environment.viewportHeight,
      });
    }
  });

});
