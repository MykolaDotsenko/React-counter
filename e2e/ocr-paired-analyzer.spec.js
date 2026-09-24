import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const expectedBuildRevision = process.env.EVIDENCE_BUILD_REVISION;

const checklist = {
  addPriceReachable: true,
  numericKeysReachable: true,
  cancelReachable: true,
  projectionReadable: true,
  reserveWithoutColour: true,
  addPlacementStable: true,
  keypadCloses: true,
  brightSummaryReadable: true,
  softwareKeyboardClear: true,
  repeatedAddNoScroll: true,
  typoCorrectionWorks: true,
  fiveConsecutiveAddsSmooth: true,
  consistentInputMethod: true,
  compactSpotCheckRecorded: true,
};

const timingSummary = (durationMs) => ({
  count: 10,
  medianMs: durationMs,
  p75Ms: durationMs,
  maxMs: durationMs,
  status: "target-met",
});

const manualEvidence = (buildRevision) => {
  const samples = [
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `manual-low-${index}`,
      durationMs: 1_500,
      unitPriceMinor: 479,
      quantity: 1,
      lineTotalMinor: 479,
      budgetMinor: 50_000,
      safetyBufferMinor: 0,
      completedAt: new Date(
        Date.parse("2026-09-24T10:00:00.000Z") + index * 1_000,
      ).toISOString(),
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `manual-high-${index}`,
      durationMs: 1_800,
      unitPriceMinor: 1_250,
      quantity: 1,
      lineTotalMinor: 1_250,
      budgetMinor: 50_000,
      safetyBufferMinor: 0,
      completedAt: new Date(
        Date.parse("2026-09-24T10:01:00.000Z") + index * 1_000,
      ).toISOString(),
    })),
  ];

  return {
    schemaVersion: 3,
    kind: "shopping-timing-evidence",
    buildRevision,
    generatedAt: "2026-09-24T10:10:00.000Z",
    privacy: {
      networkTransmission: false,
      containsItemNames: false,
      containsStoreHistory: false,
      containsDeviceMetadata: true,
    },
    session: {
      version: 4,
      environment: {
        userAgent: "OCR Paired E2E Browser",
        viewportWidth: 390,
        viewportHeight: 844,
        screenWidth: 390,
        screenHeight: 844,
        devicePixelRatio: 1,
        colorScheme: "light",
        reducedMotion: false,
      },
      deviceLabel: "OCR Paired E2E Phone",
      compactDeviceLabel: "OCR Paired E2E Phone",
      inputMethodLabel: "numeric keyboard",
      physicalContext: {
        oneHanded: true,
        brightStoreLikeLighting: true,
        defaultTextSize: true,
      },
      spotChecks: {
        darkAppearance: "not-run",
        largeText200: "not-run",
        reducedMotion: "not-run",
      },
      notes: "",
      checklist,
      samples,
      exclusions: [],
    },
    gate: {
      eur479: timingSummary(1_500),
      eur1250: timingSummary(1_800),
      checklistComplete: true,
      deviceLabelPresent: true,
      compactDeviceLabelPresent: true,
      inputMethodPresent: true,
      physicalContextComplete: true,
      lightAppearanceRecorded: true,
      phonePortraitViewport: true,
      secondarySpotChecksRecorded: 0,
      secondarySpotCheckFailures: 0,
      documentedInterruptionCount: 0,
      nonFixtureSampleCount: 0,
      ignoredSampleCount: 0,
      status: "target-met",
      b6Eligible: true,
    },
  };
};

const ocrEvidence = (buildRevision) => ({
  schemaVersion: 1,
  kind: "shelf-label-ocr-benchmark-evidence",
  buildRevision,
  generatedAt: "2026-09-24T10:30:00.000Z",
  privacy: {
    networkTransmission: false,
    containsRawImages: false,
    containsRawOcrText: false,
    containsPrices: false,
    containsItemNames: false,
    containsDeviceMetadata: true,
  },
  session: {
    version: 1,
    createdAt: "2026-09-24T10:20:00.000Z",
    deviceLabel: "OCR Paired E2E Phone",
    environment: {
      userAgent: "OCR Paired E2E Browser",
      viewportWidth: 390,
      viewportHeight: 844,
      cameraSupported: true,
      ocrAvailable: true,
      engineId:
        "tesseractjs:7.0.0:lstm:fin+swe+eng:4.0.0_best_int",
      dataBoundary: "local-only",
    },
    samples: Array.from({ length: 10 }, (_, index) => ({
      id: `ocr-${index}`,
      startedAt: new Date(
        Date.parse("2026-09-24T10:20:01.000Z") + index * 2_000,
      ).toISOString(),
      completedAt: new Date(
        Date.parse("2026-09-24T10:20:02.000Z") + index * 2_000,
      ).toISOString(),
      durationMs: 1_000,
      outcome: "top1-confirmed",
      candidateCount: 2,
      selectedRank: 1,
      ocrConfidence: 0.9,
    })),
    failures: [],
    preference: "ocr",
    effort: 2,
  },
  summary: {
    attempts: 10,
    top1Confirmed: 10,
    top3Confirmed: 0,
    rejected: 0,
    noCandidates: 0,
    timeouts: 0,
    manualFallbacks: 0,
    ocrErrors: 0,
    parserErrors: 0,
    captureErrors: 0,
    medianConfirmedMs: 1_000,
    p75ConfirmedMs: 1_000,
    p90ConfirmedMs: 1_000,
    top1CorrectRate: 1,
    top3CorrectRate: 1,
    failureRate: 0,
    correctionRate: 0,
    fallbackRate: 0,
    ocrUnavailable: 0,
    cameraUnsupported: 0,
    permissionDenied: 0,
    cameraErrors: 0,
    preference: "ocr",
    effort: 2,
  },
});

test("@ocr-paired loads the isolated OCR paired analyzer", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "OCR paired evidence analyzer",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add price" }),
  ).toHaveCount(0);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);

  const registrations = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return 0;
    }

    return (await navigator.serviceWorker.getRegistrations()).length;
  });
  expect(registrations).toBe(0);

  await expect(
    page.getByText(/nothing is compared until both authoritative exports are loaded/i),
  ).toBeVisible();

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(storage).toEqual({ local: 0, session: 0 });
});

test("@ocr-paired validates full paired OCR field evidence end to end", async ({
  page,
}) => {
  expect(expectedBuildRevision).toMatch(/^[0-9a-f]{40}$/);

  await page.goto("/");

  await page.getByLabel("Select manual JSON").setInputFiles({
    name: "manual-private-source.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(manualEvidence(expectedBuildRevision)),
    ),
  });

  await page.getByLabel("Select OCR JSON").setInputFiles({
    name: "ocr-private-source.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(ocrEvidence(expectedBuildRevision)),
    ),
  });

  await expect(
    page.getByRole("heading", {
      name: "Evidence structurally ready",
    }),
  ).toBeVisible();
  await expect(page.getByText("Build mismatch")).toHaveCount(0);
  await expect(
    page.getByText("10 timed attempts", { exact: true }),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", {
        name: "Download OCR paired aggregate",
      })
      .click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^ocr-paired-analysis-\d{8}T\d{9}Z\.json$/,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const aggregate = JSON.parse(
    await readFile(downloadPath, "utf8"),
  );

  expect(aggregate).toMatchObject({
    schemaVersion: 1,
    kind: "ocr-paired-analysis",
    sourceBuildRevision: expectedBuildRevision,
    analyzerBuildRevision: expectedBuildRevision,
    privacy: {
      containsRawManualSamples: false,
      containsRawOcrSamples: false,
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsDeviceLabels: false,
      containsFileNames: false,
      networkTransmission: false,
    },
    summary: {
      readiness: "ready",
      sourceBuildRevision: expectedBuildRevision,
      compatibility: {
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
      },
      manualLowFixture: {
        count: 10,
        medianMs: 1_500,
        p75Ms: 1_500,
        p90Ms: 1_500,
        maxMs: 1_500,
      },
      manualHighFixture: {
        count: 10,
        medianMs: 1_800,
        p75Ms: 1_800,
        p90Ms: 1_800,
        maxMs: 1_800,
      },
      ocr: {
        attempts: 10,
        top1Confirmed: 10,
        medianConfirmedMs: 1_000,
        p75ConfirmedMs: 1_000,
        p90ConfirmedMs: 1_000,
        top1CorrectRate: 1,
        top3CorrectRate: 1,
        preference: "ocr",
        effort: 2,
      },
      ocrEngineId:
        "tesseractjs:7.0.0:lstm:fin+swe+eng:4.0.0_best_int",
      ocrDataBoundary: "local-only",
      issues: [],
    },
  });

  const serialized = JSON.stringify(aggregate);
  expect(serialized).not.toContain("manual-low-0");
  expect(serialized).not.toContain("ocr-0");
  expect(serialized).not.toContain("manual-private-source");
  expect(serialized).not.toContain("ocr-private-source");
  expect(serialized).not.toContain('"unitPriceMinor"');

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(storage).toEqual({ local: 0, session: 0 });
});
