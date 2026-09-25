import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const expectedBuildRevision = process.env.EVIDENCE_BUILD_REVISION;

test("@ocr-benchmark loads the isolated shelf-label OCR harness", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Shelf-label OCR benchmark",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Experimental evidence tool"),
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

  await expect(page.getByText("OCR not configured")).toBeVisible();
  await expect(
    page.getByText(/no OCR engine is bundled deliberately/i),
  ).toBeVisible();

  const evidence = await page.evaluate(() =>
    localStorage.getItem(
      "surface:/|budget-cart:qa:shelf-label-ocr-benchmark-v1",
    ),
  );

  expect(evidence).not.toBeNull();
  expect(evidence).not.toContain("rawText");
  expect(evidence).not.toContain("minorUnits");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {
      name: "Download OCR benchmark JSON",
    }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^shelf-label-ocr-benchmark-\d{8}T\d{9}Z\.json$/,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const exported = JSON.parse(
    await readFile(downloadPath, "utf8"),
  );

  expect(expectedBuildRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(exported).toMatchObject({
    schemaVersion: 2,
    kind: "shelf-label-ocr-benchmark-evidence",
    buildRevision: expectedBuildRevision,
    privacy: {
      networkTransmission: false,
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    },
  });

  const exportedText = JSON.stringify(exported);
  expect(exportedText).not.toContain("rawText");
  expect(exportedText).not.toContain("minorUnits");
});
