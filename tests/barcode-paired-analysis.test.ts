import { describe, expect, it } from "vitest";

import {
  analyzeBarcodePairedEvidence,
  buildBarcodePairedAnalysisExport,
} from "../src/qa/barcode-paired-analysis";
import {
  appendBarcodeBenchmarkSample,
  buildBarcodeBenchmarkExport,
  createBarcodeBenchmarkSession,
  updateBarcodeBenchmarkDeviceLabel,
  updateBarcodeBenchmarkSubjective,
} from "../src/qa/barcode-benchmark";
import {
  appendQaTimingSample,
  buildQaTimingExport,
  createQaTimingSession,
  updateQaChecklist,
  updateQaDeviceLabel,
  updateQaInputMethodLabel,
  updateQaPhysicalContext,
} from "../src/qa/shopping-timing";

const env = {
  userAgent: "Paired Test Browser",
  viewportWidth: 390,
  viewportHeight: 844,
  screenWidth: 390,
  screenHeight: 844,
  devicePixelRatio: 3,
  colorScheme: "light" as const,
  reducedMotion: false,
};

const barcodeEnv = {
  userAgent: env.userAgent,
  viewportWidth: env.viewportWidth,
  viewportHeight: env.viewportHeight,
  detectorSupported: true,
  cameraSupported: true,
  supportedFormats: ["ean_13"],
};

const completeManualExport = () => {
  let session = createQaTimingSession(env);
  session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");
  session = updateQaInputMethodLabel(session, "numeric keyboard");
  session = updateQaPhysicalContext(session, "oneHanded", true);
  session = updateQaPhysicalContext(
    session,
    "brightStoreLikeLighting",
    true,
  );
  session = updateQaPhysicalContext(session, "defaultTextSize", true);

  for (const key of Object.keys(session.checklist) as Array<
    keyof typeof session.checklist
  >) {
    session = updateQaChecklist(session, key, true);
  }

  for (let i = 0; i < 10; i += 1) {
    session = appendQaTimingSample(session, {
      id: `479-${i}`,
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
      id: `1250-${i}`,
      durationMs: 2_000 + i * 10,
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
    buildRevision: "a".repeat(40),
  };
};

const completeBarcodeExport = () => {
  let session = createBarcodeBenchmarkSession(
    barcodeEnv,
    "2026-09-24T10:00:00.000Z",
  );
  session = updateBarcodeBenchmarkDeviceLabel(
    session,
    "Pixel 8 · Chrome",
  );
  session = updateBarcodeBenchmarkSubjective(session, "scanner", 2);

  for (let i = 0; i < 10; i += 1) {
    session = appendBarcodeBenchmarkSample(session, {
      id: `scan-${i}`,
      startedAt: new Date(
        Date.parse("2026-09-24T10:20:00.000Z") + i * 2_000,
      ).toISOString(),
      completedAt: new Date(
        Date.parse("2026-09-24T10:20:01.500Z") + i * 2_000,
      ).toISOString(),
      durationMs: 1_500,
      outcome: "confirmed",
      detectedFormat: "ean_13",
    });
  }

  return {
    ...buildBarcodeBenchmarkExport(
      session,
      "2026-09-24T10:30:00.000Z",
    ),
    buildRevision: "a".repeat(40),
  };
};

describe("barcode paired analysis", () => {
  it("marks same-build same-device complete evidence ready", () => {
    const summary = analyzeBarcodePairedEvidence(
      completeManualExport(),
      completeBarcodeExport(),
    );

    expect(summary.readiness).toBe("ready");
    expect(summary.compatibility).toMatchObject({
      sameBuildRevision: true,
      sameUserAgent: true,
      sameViewport: true,
      sameDeviceLabel: true,
      manualFixtureEvidenceComplete: true,
      barcodeConfirmedEvidenceComplete: true,
    });
    expect(summary.manualLowFixture.count).toBe(10);
    expect(summary.manualHighFixture.count).toBe(10);
    expect(summary.barcode?.confirmed).toBe(10);
    expect(summary.versusLowFixture.medianDeltaMs).toBeLessThan(0);
    expect(summary.versusHighFixture.medianDeltaMs).toBeLessThan(0);
  });

  it("rejects mixed build revisions as incompatible", () => {
    const manual = completeManualExport();
    const barcode = {
      ...completeBarcodeExport(),
      buildRevision: "b".repeat(40),
    };

    const summary = analyzeBarcodePairedEvidence(manual, barcode);

    expect(summary.readiness).toBe("incompatible");
    expect(summary.sourceBuildRevision).toBeNull();
    expect(summary.compatibility.sameBuildRevision).toBe(false);
    expect(summary.issues.join(" ")).toMatch(/different buildRevision/i);
  });

  it("rejects tampered derived evidence", () => {
    const manual = completeManualExport();
    const barcode = completeBarcodeExport();
    const tampered = {
      ...barcode,
      summary: {
        ...barcode.summary,
        confirmed: 999,
      },
    };

    const summary = analyzeBarcodePairedEvidence(manual, tampered);

    expect(summary.readiness).toBe("invalid");
    expect(summary.barcode).toBeNull();
  });

  it("does not export an incomplete comparison", () => {
    const manual = completeManualExport();
    const barcode = completeBarcodeExport();
    const incomplete = {
      ...barcode,
      session: {
        ...barcode.session,
        preference: null,
      },
      summary: {
        ...barcode.summary,
        preference: null,
      },
    };

    const summary = analyzeBarcodePairedEvidence(manual, incomplete);

    expect(summary.readiness).toBe("incomplete");
    expect(() =>
      buildBarcodePairedAnalysisExport(
        summary,
        "2026-09-24T11:00:00.000Z",
      ),
    ).toThrow(/ready compatible evidence/i);
  });

  it("exports only aggregate privacy-safe comparison data", () => {
    const summary = analyzeBarcodePairedEvidence(
      completeManualExport(),
      completeBarcodeExport(),
    );
    const exported = buildBarcodePairedAnalysisExport(
      summary,
      "2026-09-24T11:00:00.000Z",
    );
    const json = JSON.stringify(exported);

    expect(exported.privacy).toEqual({
      containsRawManualSamples: false,
      containsRawBarcodeSamples: false,
      containsRawBarcodes: false,
      containsPrices: false,
      containsFileNames: false,
      networkTransmission: false,
    });
    expect(json).not.toContain("Pixel 8");
    expect(json).not.toContain("479-0");
    expect(json).not.toContain("scan-0");
  });
});
