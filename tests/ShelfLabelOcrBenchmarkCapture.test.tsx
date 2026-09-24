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

import { ShelfLabelOcrBenchmarkCapture } from "../src/qa/ShelfLabelOcrBenchmarkCapture";
import type {
  ShelfLabelOcrEnvironment,
  ShelfLabelOcrSample,
} from "../src/qa/shelf-label-ocr-benchmark";
import type {
  ShelfLabelOcrEngine,
} from "../src/qa/shelf-label-ocr-adapter";

const environment: ShelfLabelOcrEnvironment = {
  userAgent: "OCR Camera Test",
  viewportWidth: 390,
  viewportHeight: 844,
  cameraSupported: true,
  ocrAvailable: true,
  engineId: "fixture-ocr-v1",
  dataBoundary: "local-only",
};

const ocrGlobal = globalThis as typeof globalThis & {
  __SBC_SHELF_LABEL_OCR_ENGINE__?: ShelfLabelOcrEngine;
};

const installCamera = () => {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => stream),
    },
  });

  vi.spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);

  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) => {
      callback(new Blob(["frame"], { type: "image/jpeg" }));
    });

  return { stop };
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
  Reflect.deleteProperty(
    globalThis,
    "__SBC_SHELF_LABEL_OCR_ENGINE__",
  );
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

describe("ShelfLabelOcrBenchmarkCapture", () => {
  it("parses OCR text into ranked exact-money candidates while retaining only rank metadata", async () => {
    installCamera();

    ocrGlobal.__SBC_SHELF_LABEL_OCR_ENGINE__ = {
      id: "fixture-ocr-v1",
      dataBoundary: "local-only",
      recognize: vi.fn(async () => ({
        text: "Hinta 4,29 €\nYksikköhinta 12,48 €/kg",
        confidence: 0.91,
      })),
    };

    const onSample =
      vi.fn<(sample: ShelfLabelOcrSample) => void>();

    render(
      <ShelfLabelOcrBenchmarkCapture
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
    await screen.findByText("Camera ready");

    fireEvent.click(
      screen.getByRole("button", { name: "Start timed OCR" }),
    );

    await screen.findByRole("button", {
      name: "Candidate 1 is correct",
    });

    expect(screen.getByText(/4,29/)).toBeTruthy();
    expect(screen.getByText(/12,48/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Candidate 1 is correct",
      }),
    );

    expect(onSample).toHaveBeenCalledTimes(1);

    const sample = onSample.mock.calls[0]?.[0];

    expect(sample).toMatchObject({
      outcome: "top1-confirmed",
      candidateCount: 2,
      selectedRank: 1,
      ocrConfidence: 0.91,
    });
    expect(JSON.stringify(sample)).not.toContain("4,29");
    expect(JSON.stringify(sample)).not.toContain("Hinta");
  });

  it("ignores a stale OCR result after manual fallback", async () => {
    installCamera();

    let resolveOcr!: (value: {
      readonly text: string;
      readonly confidence: number | null;
    }) => void;

    ocrGlobal.__SBC_SHELF_LABEL_OCR_ENGINE__ = {
      id: "fixture-ocr-v1",
      dataBoundary: "local-only",
      recognize: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveOcr = resolve;
          }),
      ),
    };

    const onSample =
      vi.fn<(sample: ShelfLabelOcrSample) => void>();
    const onAttemptActiveChange = vi.fn();

    render(
      <ShelfLabelOcrBenchmarkCapture
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
    await screen.findByText("Camera ready");

    fireEvent.click(
      screen.getByRole("button", { name: "Start timed OCR" }),
    );

    await waitFor(() => {
      expect(resolveOcr).toBeTypeOf("function");
      expect(onAttemptActiveChange).toHaveBeenCalledWith(true);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Manual fallback" }),
    );

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(onSample.mock.calls[0]?.[0]).toMatchObject({
      outcome: "manual-fallback",
      selectedRank: null,
    });

    await act(async () => {
      resolveOcr({
        text: "Hinta 9,99 €",
        confidence: 0.99,
      });
      await Promise.resolve();
    });

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/9,99/)).toBeNull();
  });
});
