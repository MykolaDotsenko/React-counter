import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const expectedBuildRevision = process.env.EVIDENCE_BUILD_REVISION;

test("@visual-benchmark loads the isolated visual recognition harness", async ({
  page,
}) => {
  const modelRequests = [];
  page.on("request", (request) => {
    if (
      request.url().includes("huggingface.co") ||
      request.url().includes("hf.co")
    ) {
      modelRequests.push(request.url());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Visual product recognition benchmark",
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

  await expect(
    page.getByText("Recognizer not configured"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Local CLIP closed-set recognizer",
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Candidate product catalog JSON"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Load local CLIP recognizer",
    }),
  ).toBeDisabled();
  expect(modelRequests).toEqual([]);

  const evidence = await page.evaluate(() =>
    localStorage.getItem(
      "surface:/|budget-cart:qa:visual-product-benchmark-v1",
    ),
  );

  expect(evidence).not.toBeNull();
  expect(evidence).not.toContain("candidateLabel");
  expect(evidence).not.toContain("imageData");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {
      name: "Download visual benchmark JSON",
    }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^visual-product-benchmark-\d{8}T\d{9}Z\.json$/,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const exported = JSON.parse(
    await readFile(downloadPath, "utf8"),
  );

  expect(expectedBuildRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(exported).toMatchObject({
    schemaVersion: 1,
    kind: "visual-product-benchmark-evidence",
    buildRevision: expectedBuildRevision,
    privacy: {
      networkTransmission: false,
      containsRawImages: false,
      containsCandidateLabels: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    },
  });

  const exportedText = JSON.stringify(exported);
  expect(exportedText).not.toContain("candidateLabel");
  expect(exportedText).not.toContain("imageData");
});
