import { describe, expect, it } from "vitest";

import {
  analyzeOcrPairedEvidence,
  buildOcrPairedAnalysisExport,
} from "../src/qa/ocr-paired-analysis";
import {
  appendQaTimingSample,
  buildQaTimingExport,
  createQaTimingSession,
  updateQaChecklist,
  updateQaDeviceLabel,
  updateQaInputMethodLabel,
  updateQaPhysicalContext,
} from "../src/qa/shopping-timing";
import {
  appendShelfLabelOcrSample,
  buildShelfLabelOcrExport,
  createShelfLabelOcrSession,
  updateShelfLabelOcrDeviceLabel,
  updateShelfLabelOcrSubjective,
} from "../src/qa/shelf-label-ocr-benchmark";

const SHA = "a".repeat(40);
const ANALYZER_SHA = "b".repeat(40);

const manualEnvironment = {
  userAgent: "OCR Paired Test Browser",
  viewportWidth: 390,
  viewportHeight: 844,
  screenWidth: 390,
  screenHeight: 844,
  devicePixelRatio: 3,
  colorScheme: "light" as const,
  reducedMotion: false,
};

const ocrEnvironment = {
  userAgent: manualEnvironment.userAgent,
  viewportWidth: manualEnvironment.viewportWidth,
  viewportHeight: manualEnvironment.viewportHeight,
  cameraSupported: true,
  ocrAvailable: true,
  engineId:
    "tesseractjs:7.0.0:lstm:fin+swe+eng:4.0.0_best_int",
  dataBoundary: "local-only" as const,
};

const completeManualExport = () => {
  let session = createQaTimingSession(manualEnvironment);
  session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");
  session = updateQaInputMethodLabel(session, "numeric keyboard");
  session = updateQaPhysicalContext(session, "oneHanded", true);
  session = updateQaPhysicalContext(
    session,
    "brightStoreLikeLighting",
    true,
  );
  session = updateQaPhysicalContext(
    session,
    "defaultTextSize",
    true,
  );

  for (const key of Object.keys(session.checklist) as Array<
    keyof typeof session.checklist
  >) {
    session = updateQaChecklist(session, key, true);
  }

  for (let i = 0; i < 10; i += 1) {
    session = appendQaTimingSample(session, {
      id: `manual-low-${i}`,
      durationMs: 1_800 + i * 10,
      unitPriceMinor: 479,
      quantity: 1,
      lineTotalMinor: 479,
      budgetMinor: 50_000,
      safetyBufferMinor: 0,
      completedAt: new Date(
        Date.parse("2026-09-24T10:00:00.000Z") + i * 1_000,
      ).toISOString(),
    });
    session = appendQaTimingSample(session, {
      id: `manual-high-${i}`,
      durationMs: 2_050 + i * 10,
      unitPriceMinor: 1_250,
      quantity: 1,
      lineTotalMinor: 1_250,
      budgetMinor: 50_000,
      safetyBufferMinor: 0,
      completedAt: new Date(
        Date.parse("2026-09-24T10:01:00.000Z") + i * 1_000,
      ).toISOString(),
    });
  }

  return {
    ...buildQaTimingExport(
      session,
      "2026-09-24T10:10:00.000Z",
    ),
    buildRevision: SHA,
  };
};

const completeOcrExport = () => {
  let session = createShelfLabelOcrSession(
    ocrEnvironment,
    "2026-09-24T10:20:00.000Z",
  );
  session = updateShelfLabelOcrDeviceLabel(
    session,
    "Pixel 8 · Chrome",
  );
  session = updateShelfLabelOcrSubjective(session, "ocr", 2);

  for (let i = 0; i < 10; i += 1) {
    session = appendShelfLabelOcrSample(session, {
      id: `ocr-${i}`,
      startedAt: new Date(
        Date.parse("2026-09-24T10:20:01.000Z") + i * 3_000,
      ).toISOString(),
      completedAt: new Date(
        Date.parse("2026-09-24T10:20:02.500Z") + i * 3_000,
      ).toISOString(),
      durationMs: 1_500,
      outcome: "top1-confirmed",
      candidateCount: 2,
      selectedRank: 1,
      ocrConfidence: 0.9,
    });
  }

  return {
    ...buildShelfLabelOcrExport(
      session,
      "2026-09-24T10:30:00.000Z",
    ),
    buildRevision: SHA,
  };
};

describe("OCR paired analysis", () => {
  it("marks complete same-device evidence ready", () => {
    const summary = analyzeOcrPairedEvidence(
      completeManualExport(),
      completeOcrExport(),
    );

    expect(summary.readiness).toBe("ready");
    expect(summary.compatibility).toMatchObject({
      fullGitBuildRevision: true,
      sameBuildRevision: true,
      sameUserAgent: true,
      sameViewport: true,
      sameDeviceLabel: true,
      manualFixtureEvidenceComplete: true,
      ocrEnginePresent: true,
      ocrAttemptEvidenceComplete: true,
      ocrDecisionEvidenceComplete: true,
      ocrPreferenceRecorded: true,
      ocrEffortRecorded: true,
    });
    expect(summary.ocrEngineId).toContain("tesseractjs:7.0.0");
    expect(summary.ocrDataBoundary).toBe("local-only");
    expect(summary.ocr?.attempts).toBe(10);
    expect(summary.versusLowFixture.medianDeltaMs).toBeLessThan(0);
    expect(summary.versusHighFixture.medianDeltaMs).toBeLessThan(0);
  });

  it("rejects mixed build revisions as incompatible", () => {
    const ocr = {
      ...completeOcrExport(),
      buildRevision: "c".repeat(40),
    };
    const summary = analyzeOcrPairedEvidence(
      completeManualExport(),
      ocr,
    );

    expect(summary.readiness).toBe("incompatible");
    expect(summary.sourceBuildRevision).toBeNull();
    expect(summary.compatibility.sameBuildRevision).toBe(false);
  });

  it("rejects tampered OCR derived evidence", () => {
    const ocr = completeOcrExport();
    const tampered = {
      ...ocr,
      summary: {
        ...ocr.summary,
        attempts: 999,
      },
    };

    const summary = analyzeOcrPairedEvidence(
      completeManualExport(),
      tampered,
    );

    expect(summary.readiness).toBe("invalid");
    expect(summary.ocr).toBeNull();
  });

  it("keeps structurally valid but insufficient OCR evidence incomplete", () => {
    const ocr = completeOcrExport();
    const shortenedSession = {
      ...ocr.session,
      samples: ocr.session.samples.slice(0, 5),
    };
    const shortened = {
      ...buildShelfLabelOcrExport(
        shortenedSession,
        "2026-09-24T10:30:00.000Z",
      ),
      buildRevision: SHA,
    };

    const summary = analyzeOcrPairedEvidence(
      completeManualExport(),
      shortened,
    );

    expect(summary.readiness).toBe("incomplete");
    expect(summary.compatibility.ocrAttemptEvidenceComplete).toBe(false);
    expect(summary.compatibility.ocrDecisionEvidenceComplete).toBe(false);
  });

  it("exports only aggregate privacy-safe data on an immutable analyzer build", () => {
    const summary = analyzeOcrPairedEvidence(
      completeManualExport(),
      completeOcrExport(),
    );
    const exported = buildOcrPairedAnalysisExport(
      summary,
      "2026-09-24T11:00:00.000Z",
      ANALYZER_SHA,
    );
    const json = JSON.stringify(exported);

    expect(exported.privacy).toEqual({
      containsRawManualSamples: false,
      containsRawOcrSamples: false,
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsDeviceLabels: false,
      containsFileNames: false,
      networkTransmission: false,
    });
    expect(json).not.toContain("Pixel 8");
    expect(json).not.toContain("manual-low-0");
    expect(json).not.toContain("ocr-0");
    expect(json).not.toContain('"unitPriceMinor"');
  });

  it("does not export from local-dev analyzer builds", () => {
    const summary = analyzeOcrPairedEvidence(
      completeManualExport(),
      completeOcrExport(),
    );

    expect(() =>
      buildOcrPairedAnalysisExport(
        summary,
        "2026-09-24T11:00:00.000Z",
        "local-dev",
      ),
    ).toThrow(/ready immutable evidence/i);
  });
});
