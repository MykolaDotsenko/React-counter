import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const expectedBuildRevision = process.env.EVIDENCE_BUILD_REVISION;

test("@qa loads the isolated empirical timing surface", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "QA 0/20" }).click();

  await expect(
    page.getByRole("heading", { name: "Human timing gate" }),
  ).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);

  const registrations = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return 0;
    }

    return (await navigator.serviceWorker.getRegistrations()).length;
  });

  expect(registrations).toBe(0);
});

test("@qa downloads timing evidence stamped with the tested build", async ({
  page,
}) => {
  expect(expectedBuildRevision).toMatch(/^[0-9a-f]{40}$/);

  await page.goto("/");
  await page.getByRole("button", { name: "QA 0/20" }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {
      name: "Download JSON results",
    }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^shopping-timing-\d{8}T\d{9}Z\.json$/,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const evidence = JSON.parse(await readFile(downloadPath, "utf8"));

  expect(evidence).toMatchObject({
    schemaVersion: 3,
    kind: "shopping-timing-evidence",
    buildRevision: expectedBuildRevision,
    privacy: {
      networkTransmission: false,
      containsItemNames: false,
      containsStoreHistory: false,
      containsDeviceMetadata: true,
    },
  });
});
