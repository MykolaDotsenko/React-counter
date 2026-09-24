import { describe, expect, it, vi } from "vitest";

import {
  prepareTesseractOcrEngine,
  TESSERACT_OCR_DATASET,
  TESSERACT_OCR_LANGUAGES,
  TESSERACT_OCR_RUNTIME_VERSION,
} from "../src/qa/tesseract-shelf-label-ocr";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const worker = (
  recognizeImpl: (image: Blob) => Promise<{
    readonly text: string;
    readonly confidence: number;
  }>,
) => {
  const terminate = vi.fn(async () => undefined);
  const recognize = vi.fn(recognizeImpl);

  return {
    api: {
      recognize,
      terminate,
    },
    recognize,
    terminate,
  };
};

describe("Tesseract shelf-label OCR adapter", () => {
  it("exposes a stable local-only engine identity", async () => {
    const fake = worker(async () => ({
      text: "Hinta 4,29 €",
      confidence: 91,
    }));

    const prepared = await prepareTesseractOcrEngine(
      undefined,
      async () => fake.api,
    );

    expect(prepared.engine.id).toBe(
      [
        "tesseractjs",
        TESSERACT_OCR_RUNTIME_VERSION,
        "lstm",
        TESSERACT_OCR_LANGUAGES.join("+"),
        TESSERACT_OCR_DATASET,
      ].join(":"),
    );
    expect(prepared.engine.dataBoundary).toBe("local-only");

    await prepared.dispose();
  });

  it("normalizes OCR confidence and returns transient text", async () => {
    const fake = worker(async () => ({
      text: "Norm. 4,99 €\nJäsen 3,79 €",
      confidence: 87.5,
    }));
    const prepared = await prepareTesseractOcrEngine(
      undefined,
      async () => fake.api,
    );

    await expect(
      prepared.engine.recognize(
        new Blob(["frame"], { type: "image/jpeg" }),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      text: "Norm. 4,99 €\nJäsen 3,79 €",
      confidence: 0.875,
    });

    expect(fake.recognize).toHaveBeenCalledTimes(1);
    await prepared.dispose();
  });

  it("does not invoke OCR when already aborted", async () => {
    const fake = worker(async () => ({
      text: "Hinta 4,29 €",
      confidence: 90,
    }));
    const prepared = await prepareTesseractOcrEngine(
      undefined,
      async () => fake.api,
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      prepared.engine.recognize(
        new Blob(["frame"]),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fake.recognize).not.toHaveBeenCalled();
    await prepared.dispose();
  });

  it("terminates an in-flight worker on abort and recreates it for a later attempt", async () => {
    const firstResult = deferred<{
      readonly text: string;
      readonly confidence: number;
    }>();
    const first = worker(() => firstResult.promise);
    const second = worker(async () => ({
      text: "Hinta 5,49 €",
      confidence: 93,
    }));
    const factory = vi
      .fn()
      .mockResolvedValueOnce(first.api)
      .mockResolvedValueOnce(second.api);

    const prepared = await prepareTesseractOcrEngine(
      undefined,
      factory,
    );
    const controller = new AbortController();

    const attempt = prepared.engine.recognize(
      new Blob(["frame"]),
      controller.signal,
    );

    await vi.waitFor(() => {
      expect(first.recognize).toHaveBeenCalledTimes(1);
    });

    controller.abort();

    await expect(attempt).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.waitFor(() => {
      expect(first.terminate).toHaveBeenCalledTimes(1);
    });

    await expect(
      prepared.engine.recognize(
        new Blob(["retry"]),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      text: "Hinta 5,49 €",
      confidence: 0.93,
    });

    expect(factory).toHaveBeenCalledTimes(2);
    await prepared.dispose();
    expect(second.terminate).toHaveBeenCalledTimes(1);
  });

  it("invalidates a failed worker before a retry", async () => {
    const first = worker(async () => {
      throw new Error("wasm failure");
    });
    const second = worker(async () => ({
      text: "Hinta 2,99 €",
      confidence: 80,
    }));
    const factory = vi
      .fn()
      .mockResolvedValueOnce(first.api)
      .mockResolvedValueOnce(second.api);

    const prepared = await prepareTesseractOcrEngine(
      undefined,
      factory,
    );

    await expect(
      prepared.engine.recognize(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).rejects.toThrow("wasm failure");

    expect(first.terminate).toHaveBeenCalledTimes(1);

    await expect(
      prepared.engine.recognize(
        new Blob(["retry"]),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      text: "Hinta 2,99 €",
      confidence: 0.8,
    });

    await prepared.dispose();
  });

  it("disposes idempotently and prevents post-dispose inference", async () => {
    const fake = worker(async () => ({
      text: "Hinta 1,99 €",
      confidence: 99,
    }));
    const prepared = await prepareTesseractOcrEngine(
      undefined,
      async () => fake.api,
    );

    await prepared.dispose();
    await prepared.dispose();

    expect(fake.terminate).toHaveBeenCalledTimes(1);
    await expect(
      prepared.engine.recognize(
        new Blob(["frame"]),
        new AbortController().signal,
      ),
    ).rejects.toThrow(/disposed/i);
  });
});
