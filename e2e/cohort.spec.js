import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

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

  const participant = {
    schemaVersion: 1,
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
    schemaVersion: 1,
    kind: "retention-cohort-summary",
    sourceReportCount: 1,
    privacy: {
      containsRawParticipantEvents: false,
      containsParticipantFileNames: false,
      networkTransmission: false,
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

