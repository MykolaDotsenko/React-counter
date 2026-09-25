import { describe, expect, it } from "vitest";

import {
  SHELF_LABEL_OCR_STORAGE_KEY,
  appendShelfLabelOcrSample,
  buildShelfLabelOcrExport,
  createShelfLabelOcrSession,
  loadShelfLabelOcrSession,
  parseShelfLabelOcrExport,
  summarizeShelfLabelOcr,
} from "../src/qa/shelf-label-ocr-benchmark";

const environment = {
  userAgent: "OCR Benchmark Test",
  viewportWidth: 390,
  viewportHeight: 844,
  cameraSupported: true,
  ocrAvailable: true,
  engineId: "fixture-ocr-v1",
  dataBoundary: "local-only" as const,
};

describe("shelf-label OCR benchmark evidence", () => {
  it("summarizes ranked price decisions without storing OCR text or price values", () => {
    let session = createShelfLabelOcrSession(
      environment,
      "2026-09-24T10:00:00.000Z",
    );

    session = appendShelfLabelOcrSample(session, {
      id: "ocr-1",
      startedAt: "2026-09-24T10:00:01.000Z",
      completedAt: "2026-09-24T10:00:02.000Z",
      durationMs: 1_000,
      outcome: "top1-confirmed",
      candidateCount: 2,
      selectedRank: 1,
      ocrConfidence: 0.94,
    });
    session = appendShelfLabelOcrSample(session, {
      id: "ocr-2",
      startedAt: "2026-09-24T10:01:01.000Z",
      completedAt: "2026-09-24T10:01:03.000Z",
      durationMs: 2_000,
      outcome: "top3-confirmed",
      candidateCount: 3,
      selectedRank: 2,
      ocrConfidence: 0.82,
    });
    session = appendShelfLabelOcrSample(session, {
      id: "ocr-3",
      startedAt: "2026-09-24T10:02:01.000Z",
      completedAt: "2026-09-24T10:02:04.000Z",
      durationMs: 3_000,
      outcome: "rejected",
      candidateCount: 2,
      selectedRank: null,
      ocrConfidence: 0.51,
    });

    const summary = summarizeShelfLabelOcr(session);

    expect(summary).toMatchObject({
      attempts: 3,
      top1Confirmed: 1,
      top3Confirmed: 1,
      rejected: 1,
      medianDecisionMs: 2_000,
      p75DecisionMs: 3_000,
      p90DecisionMs: 3_000,
      medianConfirmedMs: 1_000,
      p75ConfirmedMs: 2_000,
      p90ConfirmedMs: 2_000,
      top1CorrectRate: 1 / 3,
      top3CorrectRate: 2 / 3,
      correctionRate: 1 / 3,
    });

    const exported = buildShelfLabelOcrExport(
      session,
      "2026-09-24T10:03:00.000Z",
    );
    const json = JSON.stringify(exported);

    expect(exported.privacy).toEqual({
      networkTransmission: false,
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    });
    expect(json).not.toContain("4,29");
    expect(json).not.toContain("Hinta");
  });

  it("round-trips a valid export through the authoritative parser", () => {
    let session = createShelfLabelOcrSession(
      environment,
      "2026-09-24T10:00:00.000Z",
    );
    session = appendShelfLabelOcrSample(session, {
      id: "ocr-valid",
      startedAt: "2026-09-24T10:00:01.000Z",
      completedAt: "2026-09-24T10:00:03.000Z",
      durationMs: 2_000,
      outcome: "top1-confirmed",
      candidateCount: 1,
      selectedRank: 1,
      ocrConfidence: 0.9,
    });

    const exported = buildShelfLabelOcrExport(
      session,
      "2026-09-24T10:00:04.000Z",
    );

    expect(parseShelfLabelOcrExport(exported)).toEqual(exported);
  });

  it("rejects tampered OCR summary and privacy metadata", () => {
    const session = createShelfLabelOcrSession(
      environment,
      "2026-09-24T10:00:00.000Z",
    );
    const exported = buildShelfLabelOcrExport(
      session,
      "2026-09-24T10:00:01.000Z",
    );

    expect(
      parseShelfLabelOcrExport({
        ...exported,
        summary: {
          ...exported.summary,
          attempts: 999,
        },
      }),
    ).toBeNull();

    expect(
      parseShelfLabelOcrExport({
        ...exported,
        privacy: {
          ...exported.privacy,
          containsRawOcrText: true,
        },
      }),
    ).toBeNull();
  });

  it("requires generatedAt to cover the latest retained OCR observation", () => {
    let session = createShelfLabelOcrSession(
      environment,
      "2026-09-24T10:00:00.000Z",
    );
    session = appendShelfLabelOcrSample(session, {
      id: "ocr-late",
      startedAt: "2026-09-24T10:00:04.000Z",
      completedAt: "2026-09-24T10:00:06.000Z",
      durationMs: 2_000,
      outcome: "top1-confirmed",
      candidateCount: 1,
      selectedRank: 1,
      ocrConfidence: 0.9,
    });

    expect(() =>
      buildShelfLabelOcrExport(
        session,
        "2026-09-24T10:00:05.000Z",
      ),
    ).toThrow(/export time is invalid/i);
  });

  it("reports remote-image transmission when the engine declares it", () => {
    const session = createShelfLabelOcrSession(
      {
        ...environment,
        engineId: "remote-fixture",
        dataBoundary: "remote-image",
      },
      "2026-09-24T10:00:00.000Z",
    );

    expect(
      buildShelfLabelOcrExport(
        session,
        "2026-09-24T10:00:01.000Z",
      ).privacy.networkTransmission,
    ).toBe(true);
  });

  it("fails closed on malformed retained evidence without overwriting it", () => {
    const values = new Map<string, string>([
      [SHELF_LABEL_OCR_STORAGE_KEY, "{malformed"],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    const loaded = loadShelfLabelOcrSession(
      storage,
      environment,
      "2026-09-24T10:00:00.000Z",
    );

    expect(loaded.status).toBe("corrupt");
    expect(values.get(SHELF_LABEL_OCR_STORAGE_KEY)).toBe(
      "{malformed",
    );
  });
});
