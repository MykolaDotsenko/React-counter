import { describe, expect, it } from "vitest";

import {
  VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY,
  appendVisualProductBenchmarkSample,
  buildVisualProductBenchmarkExport,
  createVisualProductBenchmarkSession,
  loadVisualProductBenchmarkSession,
  summarizeVisualProductBenchmark,
} from "../src/qa/visual-product-benchmark";

const environment = {
  userAgent: "Visual Benchmark Test",
  viewportWidth: 390,
  viewportHeight: 844,
  cameraSupported: true,
  recognizerAvailable: true,
  recognizerId: "fixture-recognizer-v1",
  dataBoundary: "local-only" as const,
};

describe("visual product benchmark evidence", () => {
  it("summarizes ranked human decisions without retaining candidate labels", () => {
    let session = createVisualProductBenchmarkSession(
      environment,
      "2026-09-24T10:00:00.000Z",
    );

    session = appendVisualProductBenchmarkSample(session, {
      id: "visual-1",
      startedAt: "2026-09-24T10:00:01.000Z",
      completedAt: "2026-09-24T10:00:02.000Z",
      durationMs: 1_000,
      outcome: "top1-confirmed",
      candidateCount: 3,
      selectedRank: 1,
      topConfidence: 0.92,
    });
    session = appendVisualProductBenchmarkSample(session, {
      id: "visual-2",
      startedAt: "2026-09-24T10:01:01.000Z",
      completedAt: "2026-09-24T10:01:03.000Z",
      durationMs: 2_000,
      outcome: "top3-confirmed",
      candidateCount: 3,
      selectedRank: 2,
      topConfidence: 0.61,
    });
    session = appendVisualProductBenchmarkSample(session, {
      id: "visual-3",
      startedAt: "2026-09-24T10:02:01.000Z",
      completedAt: "2026-09-24T10:02:04.000Z",
      durationMs: 3_000,
      outcome: "rejected",
      candidateCount: 3,
      selectedRank: null,
      topConfidence: 0.44,
    });

    const summary = summarizeVisualProductBenchmark(session);

    expect(summary).toMatchObject({
      attempts: 3,
      top1Confirmed: 1,
      top3Confirmed: 1,
      rejected: 1,
      medianConfirmedMs: 1_000,
      p75ConfirmedMs: 2_000,
      p90ConfirmedMs: 2_000,
      top1Accuracy: 1 / 3,
      top3Accuracy: 2 / 3,
      correctionRate: 1 / 3,
    });

    const exported = buildVisualProductBenchmarkExport(
      session,
      "2026-09-24T10:03:00.000Z",
    );
    const json = JSON.stringify(exported);

    expect(exported.privacy).toEqual({
      networkTransmission: false,
      containsRawImages: false,
      containsCandidateLabels: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    });
    expect(json).not.toContain("Fazer");
    expect(json).not.toContain("image");
  });

  it("reports remote-image transmission explicitly when an adapter declares it", () => {
    const session = createVisualProductBenchmarkSession(
      {
        ...environment,
        recognizerId: "remote-fixture",
        dataBoundary: "remote-image",
      },
      "2026-09-24T10:00:00.000Z",
    );

    expect(
      buildVisualProductBenchmarkExport(
        session,
        "2026-09-24T10:00:01.000Z",
      ).privacy.networkTransmission,
    ).toBe(true);
  });

  it("fails closed on malformed retained evidence without overwriting it", () => {
    const values = new Map<string, string>([
      [VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY, "{malformed"],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    const loaded = loadVisualProductBenchmarkSession(
      storage,
      environment,
      "2026-09-24T10:00:00.000Z",
    );

    expect(loaded.status).toBe("corrupt");
    expect(values.get(VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY)).toBe(
      "{malformed",
    );
  });
});
