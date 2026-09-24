import { expect, test } from "@playwright/test";

test("@barcode-benchmark loads the isolated native scanner benchmark", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(globalThis, "BarcodeDetector");
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Barcode interaction benchmark",
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

  await expect(page.getByText("Detector unavailable")).toBeVisible();

  await page.getByRole("button", { name: "Start camera" }).click();

  await expect(page.getByRole("status")).toContainText(
    "BarcodeDetector is unavailable",
  );

  const evidence = await page.evaluate(() =>
    localStorage.getItem("budget-cart:qa:barcode-benchmark-v1"),
  );

  expect(evidence).toContain("detector-unsupported");
  expect(evidence).not.toContain("rawValue");
});
