import { describe, expect, it, vi } from "vitest";

import {
  benchmarkCameraFailureType,
  captureBenchmarkFrame,
  stopBenchmarkMediaStream,
} from "../src/qa/camera-benchmark-capture";

describe("camera benchmark capture primitives", () => {
  it("bounds large camera frames before encoding", async () => {
    const drawImage = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({
        drawImage,
      } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback) => {
        callback(new Blob(["frame"], { type: "image/jpeg" }));
      });

    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: 4_000,
    });
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: 2_000,
    });

    const blob = await captureBenchmarkFrame(video);

    expect(blob.type).toBe("image/jpeg");
    expect(drawImage).toHaveBeenCalledWith(
      video,
      0,
      0,
      1_600,
      800,
    );
  });

  it("classifies permission failures without treating generic errors as denial", () => {
    expect(
      benchmarkCameraFailureType(
        new DOMException("denied", "NotAllowedError"),
      ),
    ).toBe("permission-denied");
    expect(
      benchmarkCameraFailureType(new Error("camera unavailable")),
    ).toBe("camera-error");
  });

  it("stops every track in a benchmark stream", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stream = {
      getTracks: () => [
        { stop: first },
        { stop: second },
      ],
    } as unknown as MediaStream;

    stopBenchmarkMediaStream(stream);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
