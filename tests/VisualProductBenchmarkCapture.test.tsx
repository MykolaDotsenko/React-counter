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

import { VisualProductBenchmarkCapture } from "../src/qa/VisualProductBenchmarkCapture";
import type {
  VisualProductBenchmarkEnvironment,
  VisualProductBenchmarkSample,
} from "../src/qa/visual-product-benchmark";
import type {
  VisualProductCandidate,
  VisualProductRecognizer,
} from "../src/qa/visual-product-benchmark-adapter";

const environment: VisualProductBenchmarkEnvironment = {
  userAgent: "Visual Camera Test",
  viewportWidth: 390,
  viewportHeight: 844,
  cameraSupported: true,
  recognizerAvailable: true,
  recognizerId: "fixture-recognizer-v1",
  dataBoundary: "local-only",
};

const recognizerGlobal = globalThis as typeof globalThis & {
  __SBC_VISUAL_PRODUCT_RECOGNIZER__?: VisualProductRecognizer;
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

  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);

  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) => {
      callback(new Blob(["frame"], { type: "image/jpeg" }));
    });

  return { stop, play };
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
    "__SBC_VISUAL_PRODUCT_RECOGNIZER__",
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

describe("VisualProductBenchmarkCapture", () => {
  it("records candidate rank and timing without persisting the candidate label", async () => {
    installCamera();

    recognizerGlobal.__SBC_VISUAL_PRODUCT_RECOGNIZER__ = {
      id: "fixture-recognizer-v1",
      dataBoundary: "local-only",
      recognize: vi.fn(async () => [
        { label: "Wrong milk 1 L", confidence: 0.9 },
        { label: "Correct milk 1 L", confidence: 0.81 },
        { label: "Another milk", confidence: 0.42 },
      ]),
    };

    const onSample =
      vi.fn<(sample: VisualProductBenchmarkSample) => void>();

    render(
      <VisualProductBenchmarkCapture
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
      screen.getByRole("button", {
        name: "Start timed recognition",
      }),
    );

    await screen.findByRole("button", {
      name: "Candidate 2 is correct",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Candidate 2 is correct",
      }),
    );

    expect(onSample).toHaveBeenCalledTimes(1);

    const sample = onSample.mock.calls[0]?.[0];

    expect(sample).toMatchObject({
      outcome: "top3-confirmed",
      candidateCount: 3,
      selectedRank: 2,
      topConfidence: 0.9,
    });
    expect(JSON.stringify(sample)).not.toContain("Correct milk");
  });

  it("ignores a stale recognizer result after manual fallback", async () => {
    installCamera();

    let resolveRecognition!: (
      candidates: readonly {
        readonly label: string;
        readonly confidence: number | null;
      }[],
    ) => void;

    recognizerGlobal.__SBC_VISUAL_PRODUCT_RECOGNIZER__ = {
      id: "fixture-recognizer-v1",
      dataBoundary: "local-only",
      recognize: vi.fn(
        () =>
          new Promise<readonly VisualProductCandidate[]>((resolve) => {
            resolveRecognition = resolve;
          }),
      ),
    };

    const onSample =
      vi.fn<(sample: VisualProductBenchmarkSample) => void>();
    const onAttemptActiveChange = vi.fn();

    render(
      <VisualProductBenchmarkCapture
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
      screen.getByRole("button", {
        name: "Start timed recognition",
      }),
    );

    await waitFor(() => {
      expect(resolveRecognition).toBeTypeOf("function");
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
      resolveRecognition([
        {
          label: "Stale product candidate",
          confidence: 0.99,
        },
      ]);
      await Promise.resolve();
    });

    expect(onSample).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Stale product candidate"),
    ).toBeNull();
  });
});
