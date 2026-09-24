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
        userAgent: "Paired E2E Browser",
        viewportWidth: 390,
        viewportHeight: 844,
        screenWidth: 390,
        screenHeight: 844,
        devicePixelRatio: 1,
        colorScheme: "light",
        reducedMotion: false,
      },
      deviceLabel: "Paired E2E Phone",
      compactDeviceLabel: "Paired E2E Phone",
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

const barcodeEvidence = (buildRevision) => ({
  schemaVersion: 2,
  kind: "barcode-benchmark-evidence",
  buildRevision,
  generatedAt: "2026-09-24T10:30:00.000Z",
  privacy: {
    networkTransmission: false,
    containsRawBarcodes: false,
    containsPrices: false,
    containsItemNames: false,
    containsDeviceMetadata: true,
  },
  session: {
    version: 1,
    createdAt: "2026-09-24T10:20:00.000Z",
    deviceLabel: "Paired E2E Phone",
    environment: {
      userAgent: "Paired E2E Browser",
      viewportWidth: 390,
      viewportHeight: 844,
      detectorSupported: true,
      cameraSupported: true,
      supportedFormats: ["ean_13"],
    },
    samples: Array.from({ length: 10 }, (_, index) => ({
      id: `barcode-${index}`,
      startedAt: new Date(
        Date.parse("2026-09-24T10:20:00.000Z") + index * 2_000,
      ).toISOString(),
      completedAt: new Date(
        Date.parse("2026-09-24T10:20:01.000Z") + index * 2_000,
      ).toISOString(),
      durationMs: 1_000,
      outcome: "confirmed",
      detectedFormat: "ean_13",
    })),
    failures: [],
    preference: "scanner",
    effort: 2,
  },
  summary: {
    attempts: 10,
    confirmed: 10,
    rejected: 0,
    timeouts: 0,
    manualFallbacks: 0,
    medianConfirmedMs: 1_000,
    p75ConfirmedMs: 1_000,
    p90ConfirmedMs: 1_000,
    recognitionFailureRate: 0,
    correctionRate: 0,
    fallbackRate: 0,
    detectorUnsupported: 0,
    cameraUnsupported: 0,
    permissionDenied: 0,
    cameraErrors: 0,
    detectorErrors: 0,
    preference: "scanner",
    effort: 2,
  },
});

test("@barcode-paired loads the isolated paired evidence analyzer", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Barcode paired evidence analyzer",
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
    page.getByText(/nothing is compared until both exports are loaded/i),
  ).toBeVisible();

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));

  expect(storage).toEqual({ local: 0, session: 0 });
});

test("@barcode-paired validates full paired field evidence end to end", async ({
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

  await page.getByLabel("Select barcode JSON").setInputFiles({
    name: "barcode-private-source.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(barcodeEvidence(expectedBuildRevision)),
    ),
  });

  await expect(
    page.getByRole("heading", {
      name: "Evidence ready for human decision",
    }),
  ).toBeVisible();

  await expect(page.getByText("Build mismatch")).toHaveCount(0);
  await expect(
    page.getByText("10 confirmed", { exact: true }),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", {
        name: "Download paired aggregate",
      })
      .click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^barcode-paired-analysis-\d{8}T\d{9}Z\.json$/,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const aggregate = JSON.parse(
    await readFile(downloadPath, "utf8"),
  );

  expect(aggregate).toMatchObject({
    schemaVersion: 1,
    kind: "barcode-paired-analysis",
    sourceBuildRevision: expectedBuildRevision,
    analyzerBuildRevision: expectedBuildRevision,
    privacy: {
      containsRawManualSamples: false,
      containsRawBarcodeSamples: false,
      containsRawBarcodes: false,
      containsPrices: false,
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
        barcodeConfirmedEvidenceComplete: true,
        barcodePreferenceRecorded: true,
        barcodeEffortRecorded: true,
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
      barcode: {
        confirmed: 10,
        medianConfirmedMs: 1_000,
        p75ConfirmedMs: 1_000,
        p90ConfirmedMs: 1_000,
        preference: "scanner",
        effort: 2,
      },
      issues: [],
    },
  });

  const serialized = JSON.stringify(aggregate);
  expect(serialized).not.toContain("manual-low-0");
  expect(serialized).not.toContain("barcode-0");
  expect(serialized).not.toContain("manual-private-source");
  expect(serialized).not.toContain("barcode-private-source");
  expect(serialized).not.toContain('"unitPriceMinor"');

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(storage).toEqual({ local: 0, session: 0 });
});
