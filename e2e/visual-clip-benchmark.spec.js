import { expect, test } from "@playwright/test";

test("@visual-clip loads the isolated concrete CLIP setup without model inference", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Transformers.js CLIP retail benchmark",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Xenova/clip-vit-base-patch32"),
  ).toBeVisible();
  await expect(page.getByText("d15189d")).toBeVisible();

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
    page.getByText(/camera frames and candidate labels are not uploaded/i),
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Prepare pinned recognizer",
    }),
  ).toBeVisible();
});
