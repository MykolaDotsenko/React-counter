import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearVisualProductRecognizer,
  installVisualProductRecognizer,
  visualProductRecognizer,
} from "../src/qa/visual-product-benchmark-adapter";
import {
  createVisualClipRecognizer,
  normalizeVisualClipCandidates,
  parseVisualClipCatalog,
  visualClipCatalogFingerprint,
  type VisualClipClassifierLoader,
} from "../src/qa/visual-product-clip-recognizer";

afterEach(() => {
  clearVisualProductRecognizer();
});

describe("visual CLIP recognizer experiment", () => {
  it("accepts a bounded unique SKU-specific candidate catalog", () => {
    expect(
      parseVisualClipCatalog({
        schemaVersion: 1,
        labels: [
          "Valio kevytmaito 1 l",
          "Valio kevytmaito 1.5 l",
          "Valio laktoositon kevytmaito 1 l",
        ],
      }),
    ).toEqual({
      schemaVersion: 1,
      labels: [
        "Valio kevytmaito 1 l",
        "Valio kevytmaito 1.5 l",
        "Valio laktoositon kevytmaito 1 l",
      ],
    });
  });

  it("rejects duplicate, undersized and extra-field catalogs", () => {
    expect(
      parseVisualClipCatalog({
        schemaVersion: 1,
        labels: ["Milk", " milk ", "Juice"],
      }),
    ).toBeNull();

    expect(
      parseVisualClipCatalog({
        schemaVersion: 1,
        labels: ["A", "B"],
      }),
    ).toBeNull();

    expect(
      parseVisualClipCatalog({
        schemaVersion: 1,
        labels: ["Milk 1 l", "Milk 1.5 l", "Milk lactose-free 1 l"],
        store: "private",
      }),
    ).toBeNull();
  });

  it("creates the same catalog fingerprint regardless of input label order", async () => {
    const first = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product C", "Product A", "Product B"],
    });
    const second = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product B", "Product C", "Product A"],
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    await expect(
      visualClipCatalogFingerprint(first!),
    ).resolves.toBe(
      await visualClipCatalogFingerprint(second!),
    );
  });

  it("sorts validated candidates and removes duplicate labels", () => {
    const catalog = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product A", "Product B", "Product C"],
    });

    expect(catalog).not.toBeNull();

    expect(
      normalizeVisualClipCandidates(
        [
          { label: "Product B", score: 0.41 },
          { label: "Product A", score: 0.87 },
          { label: "Product B", score: 0.35 },
          { label: "Product C", score: 0.12 },
        ],
        catalog!,
      ),
    ).toEqual([
      { label: "Product A", confidence: 0.87 },
      { label: "Product B", confidence: 0.41 },
      { label: "Product C", confidence: 0.12 },
    ]);
  });

  it("rejects candidates outside the supplied closed set", () => {
    const catalog = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product A", "Product B", "Product C"],
    });

    expect(catalog).not.toBeNull();

    expect(() =>
      normalizeVisualClipCandidates(
        [{ label: "Unknown Product", score: 0.9 }],
        catalog!,
      ),
    ).toThrow(/invalid candidates/i);
  });

  it("keeps captured image inference local to the injected classifier boundary", async () => {
    const classifier = vi.fn(async () => [
      { label: "Product A", score: 0.8 },
      { label: "Product B", score: 0.15 },
      { label: "Product C", score: 0.05 },
    ]);
    const loader: VisualClipClassifierLoader = vi.fn(async () => ({
      classifier,
      device: "wasm" as const,
    }));
    const catalog = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product A", "Product B", "Product C"],
    });

    expect(catalog).not.toBeNull();

    const recognizer = await createVisualClipRecognizer(
      catalog!,
      loader,
    );
    const image = new Blob(["camera-frame"], {
      type: "image/jpeg",
    });
    const signal = new AbortController().signal;

    await expect(
      recognizer.recognize(image, signal),
    ).resolves.toEqual([
      { label: "Product A", confidence: 0.8 },
      { label: "Product B", confidence: 0.15 },
      { label: "Product C", confidence: 0.05 },
    ]);

    expect(recognizer.dataBoundary).toBe("local-only");
    expect(recognizer.id).toMatch(
      /^hf-clip32:tjs-4\.3\.0:model-[0-9a-f]{12}:wasm:catalog-[0-9a-f]{16}:retail-package-v1$/,
    );
    expect(classifier).toHaveBeenCalledWith(
      image,
      catalog!.labels,
      {
        hypothesis_template: "a photo of the retail product {}",
      },
    );
  });

  it("honors AbortSignal even when an inference promise resolves later", async () => {
    let resolveInference:
      | ((value: unknown) => void)
      | undefined;

    const classifier = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveInference = resolve;
        }),
    );
    const loader: VisualClipClassifierLoader = vi.fn(async () => ({
      classifier,
      device: "wasm" as const,
    }));
    const catalog = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product A", "Product B", "Product C"],
    });

    const recognizer = await createVisualClipRecognizer(
      catalog!,
      loader,
    );
    const controller = new AbortController();
    const pending = recognizer.recognize(
      new Blob(["frame"]),
      controller.signal,
    );

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });

    resolveInference?.([
      { label: "Product A", score: 1 },
    ]);
  });

  it("disposes CLIP resources exactly once and refuses inference afterwards", async () => {
    const dispose = vi.fn(async () => undefined);
    const catalog = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product A", "Product B", "Product C"],
    });
    const loader: VisualClipClassifierLoader = vi.fn(async () => ({
      classifier: vi.fn(async () => []),
      device: "wasm" as const,
      dispose,
    }));

    const recognizer = await createVisualClipRecognizer(catalog!, loader);

    await recognizer.dispose?.();
    await recognizer.dispose?.();

    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(
      recognizer.recognize(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/disposed/i);
  });

  it("disposes an installed recognizer when it is replaced or cleared", () => {
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    const first = {
      id: "first",
      dataBoundary: "local-only" as const,
      recognize: vi.fn(async () => []),
      dispose: firstDispose,
    };
    const second = {
      id: "second",
      dataBoundary: "local-only" as const,
      recognize: vi.fn(async () => []),
      dispose: secondDispose,
    };

    installVisualProductRecognizer(first);
    installVisualProductRecognizer(second);

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(visualProductRecognizer()).toBe(second);

    clearVisualProductRecognizer();

    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(visualProductRecognizer()).toBeNull();
  });

  it("does not install a recognizer merely by creating one", async () => {
    const catalog = parseVisualClipCatalog({
      schemaVersion: 1,
      labels: ["Product A", "Product B", "Product C"],
    });
    const loader: VisualClipClassifierLoader = vi.fn(async () => ({
      classifier: vi.fn(async () => []),
      device: "wasm" as const,
    }));

    await createVisualClipRecognizer(catalog!, loader);

    expect(visualProductRecognizer()).toBeNull();
  });
});
