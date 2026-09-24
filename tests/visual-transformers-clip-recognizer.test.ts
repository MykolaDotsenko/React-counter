import { describe, expect, it, vi } from "vitest";

import {
  normalizeVisualClipLabels,
  prepareTransformersClipRecognizer,
  visualClipLabelSetDigest,
} from "../src/qa/visual-transformers-clip-recognizer";

describe("Transformers.js CLIP visual recognizer", () => {
  it("normalizes and deduplicates a bounded closed candidate set", () => {
    expect(
      normalizeVisualClipLabels([
        " Brand A 200 g ",
        "brand a 200 g",
        "Brand B 500 g",
        "Brand C 1 kg",
      ]),
    ).toEqual([
      "Brand A 200 g",
      "Brand B 500 g",
      "Brand C 1 kg",
    ]);

    expect(() =>
      normalizeVisualClipLabels(["one", "two"]),
    ).toThrow(/3-30 unique/i);
  });

  it("derives a stable one-way label-set digest without exposing labels", async () => {
    const labels = [
      "Secret product alpha",
      "Secret product beta",
      "Secret product gamma",
    ];

    const first = await visualClipLabelSetDigest(labels);
    const second = await visualClipLabelSetDigest(labels);

    expect(first).toMatch(/^[0-9a-f]{16}$/);
    expect(second).toBe(first);
    expect(first).not.toContain("secret");
  });

  it("maps validated zero-shot results into benchmark candidates", async () => {
    const dispose = vi.fn(async () => undefined);
    const classifier = Object.assign(
      vi.fn(async () => [
        { label: "Product A 200 g", score: 0.72 },
        { label: "Product B 200 g", score: 0.21 },
        { label: "Product C 200 g", score: 0.07 },
      ]),
      { dispose },
    );

    const loadPipeline = vi.fn(async () => classifier);
    const prepared = await prepareTransformersClipRecognizer(
      {
        candidateLabels: [
          "Product A 200 g",
          "Product B 200 g",
          "Product C 200 g",
        ],
        device: "wasm",
      },
      undefined,
      loadPipeline,
    );

    expect(prepared.recognizer.id).toMatch(
      /^tjs:4\.3\.0:clip-b32:d15189d:wasm:[0-9a-f]{16}$/,
    );
    expect(prepared.recognizer.id).not.toContain("Product A");
    expect(prepared.recognizer.dataBoundary).toBe("local-only");

    const result = await prepared.recognizer.recognize(
      new Blob(["frame"], { type: "image/jpeg" }),
      new AbortController().signal,
    );

    expect(result).toEqual([
      { label: "Product A 200 g", confidence: 0.72 },
      { label: "Product B 200 g", confidence: 0.21 },
      { label: "Product C 200 g", confidence: 0.07 },
    ]);

    expect(classifier).toHaveBeenCalledWith(
      expect.any(Blob),
      [
        "Product A 200 g",
        "Product B 200 g",
        "Product C 200 g",
      ],
      {
        hypothesis_template: "a retail product package of {}",
      },
    );

    await prepared.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("fails closed on malformed model output", async () => {
    const classifier = vi.fn(async () => [
      { label: "Product A", score: 4 },
    ]);

    const prepared = await prepareTransformersClipRecognizer(
      {
        candidateLabels: [
          "Product A",
          "Product B",
          "Product C",
        ],
        device: "wasm",
      },
      undefined,
      async () => classifier,
    );

    await expect(
      prepared.recognizer.recognize(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/invalid candidates/i);
  });

  it("honors abort state before inference and refuses use after dispose", async () => {
    const classifier = vi.fn(async () => [
      { label: "Product A", score: 0.8 },
    ]);

    const prepared = await prepareTransformersClipRecognizer(
      {
        candidateLabels: [
          "Product A",
          "Product B",
          "Product C",
        ],
        device: "wasm",
      },
      undefined,
      async () => classifier,
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      prepared.recognizer.recognize(
        new Blob(["frame"]),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(classifier).not.toHaveBeenCalled();

    await prepared.dispose();

    await expect(
      prepared.recognizer.recognize(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/disposed/i);
  });
});
