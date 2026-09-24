import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const expectedBuildRevision = process.env.EVIDENCE_BUILD_REVISION;

test("@cohort loads the isolated local-only retention analyzer", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Retention cohort analyzer" }),
  ).toBeVisible();
  await expect(
    page.getByText("Target cohort 20–50 real shoppers"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Cohort interpretation readiness",
    }),
  ).toBeVisible();

  const cohortSize = page.getByText("Cohort size").locator("..");
  await expect(cohortSize).toContainText("0 / 20");
  await expect(cohortSize).toContainText("Collect more");

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

  await page.getByLabel("Select JSON exports").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });

  await expect(page.getByText("Invalid 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("invalid 1");
});

test("@cohort downloads a privacy-safe aggregate report", async ({ page }) => {
  await page.goto("/");

  expect(expectedBuildRevision).toMatch(/^[0-9a-f]{40}$/);

  const participant = {
    schemaVersion: 2,
    buildRevision: expectedBuildRevision,
    generatedAt: "2026-09-10T08:00:00.000Z",
    privacy: {
      networkTransmission: false,
      containsMoney: false,
      containsItemNames: false,
      containsStoreHistory: false,
    },
    session: {
      version: 1,
      variant: "repeat-acceleration",
      createdAt: "2026-09-01T08:00:00.000Z",
      events: [],
    },
    summary: {
      tripsStarted: 0,
      tripsFinished: 0,
      secondTripStarted: false,
      thirdTripStarted: false,
      secondTripWithin7Days: false,
      secondTripWithin14Days: false,
      secondTripWithin30Days: false,
      daysToSecondTrip: null,
      repeatTripStarts: 0,
      tripRestores: 0,
      firstItemTrips: 0,
      fifthItemTrips: 0,
      tenthItemTrips: 0,
      manualEntriesCompleted: 0,
      manualEntriesAbandoned: 0,
      medianManualEntryMs: null,
      rememberedItemUses: 0,
      currentPriceOverrides: 0,
    },
  };

  await page.getByLabel("Select JSON exports").setInputFiles({
    name: "P001-private-name.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(participant)),
  });

  await expect(
    page.getByRole("heading", { name: "1 participant" }),
  ).toBeVisible();
  await expect(
    page.getByText("Field export ready", { exact: true }),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {
      name: "Download aggregate summary",
    }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^retention-cohort-summary-\d{8}T\d{9}Z\.json$/,
  );

  const path = await download.path();
  expect(path).not.toBeNull();

  const aggregate = JSON.parse(await readFile(path, "utf8"));

  expect(aggregate).toMatchObject({
    schemaVersion: 3,
    kind: "retention-cohort-summary",
    sourceBuildRevision: expectedBuildRevision,
    analyzerBuildRevision: expectedBuildRevision,
    sourceReportCount: 1,
    privacy: {
      containsRawParticipantEvents: false,
      containsParticipantFileNames: false,
      containsParticipantIdentifiers: false,
      networkTransmission: false,
    },
    readiness: {
      participantCount: 1,
      minimumParticipants: 20,
      sevenDay: {
        minimumRequired: 20,
        ready: false,
      },
    },
    summary: {
      participantCount: 1,
      activatedParticipants: 0,
    },
  });

  const serialized = JSON.stringify(aggregate);
  expect(serialized).not.toContain("P001-private-name");
  expect(serialized).not.toContain('"events"');
});

