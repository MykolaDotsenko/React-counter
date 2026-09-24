import { expect, test } from "@playwright/test";

test("@ocr-tesseract loads the isolated concrete OCR setup without worker preparation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Tesseract.js shelf-label OCR benchmark",
    }),
  ).toBeVisible();
  await expect(page.getByText("Tesseract.js 7.0.0")).toBeVisible();
  await expect(page.getByText("fin + swe + eng")).toBeVisible();
  await expect(page.getByText("4.0.0_best_int")).toBeVisible();

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

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));

  expect(storage).toEqual({ local: 0, session: 0 });

  await expect(
    page.getByText(/camera image bytes stay inside browser-side OCR/i),
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Prepare pinned Tesseract OCR",
    }),
  ).toBeVisible();
});
