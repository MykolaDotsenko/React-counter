import { expect, test } from "@playwright/test";

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
