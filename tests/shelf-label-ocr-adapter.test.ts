import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureShelfLabelOcrEnvironment,
  runShelfLabelOcr,
  type ShelfLabelOcrEngine,
} from "../src/qa/shelf-label-ocr-adapter";

const ocrGlobal = globalThis as typeof globalThis & {
  __SBC_SHELF_LABEL_OCR_ENGINE__?: ShelfLabelOcrEngine;
};

afterEach(() => {
  Reflect.deleteProperty(
    globalThis,
    "__SBC_SHELF_LABEL_OCR_ENGINE__",
  );
});

describe("shelf-label OCR adapter boundary", () => {
  it("declares engine identity and image boundary in the benchmark environment", () => {
    ocrGlobal.__SBC_SHELF_LABEL_OCR_ENGINE__ = {
      id: "fixture-ocr-v1",
      dataBoundary: "remote-image",
      recognize: vi.fn(),
    };

    expect(captureShelfLabelOcrEnvironment()).toMatchObject({
      ocrAvailable: true,
      engineId: "fixture-ocr-v1",
      dataBoundary: "remote-image",
    });
  });

  it("rejects malformed engine output before it reaches the parser", async () => {
    ocrGlobal.__SBC_SHELF_LABEL_OCR_ENGINE__ = {
      id: "fixture-ocr-v1",
      dataBoundary: "local-only",
      recognize: vi.fn(async () => ({
        text: "Hinta 4,29 €",
        confidence: 2,
      })),
    };

    await expect(
      runShelfLabelOcr(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/invalid output/i);
  });

  it("passes validated bounded OCR output through unchanged", async () => {
    ocrGlobal.__SBC_SHELF_LABEL_OCR_ENGINE__ = {
      id: "fixture-ocr-v1",
      dataBoundary: "local-only",
      recognize: vi.fn(async () => ({
        text: "Hinta 4,29 €",
        confidence: 0.87,
      })),
    };

    await expect(
      runShelfLabelOcr(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      text: "Hinta 4,29 €",
      confidence: 0.87,
    });
  });
});
