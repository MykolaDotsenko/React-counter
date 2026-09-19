import { expect, test } from "@playwright/test";

test("completes the primary interaction flow", async ({ page }) => {
  await page.goto("/");

  const value = page.getByLabel(/Current count/);
  await expect(value).toHaveAttribute("aria-label", "Current count 0");

  await page.getByRole("button", { name: "Increase by 1" }).click();
  await expect(page.getByLabel("Current count 1")).toBeVisible();

  await page.getByRole("button", { name: "10" }).click();
  await page.getByRole("button", { name: "Increase by 10" }).click();
  await expect(page.getByLabel("Current count 11")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Current count 11")).toBeVisible();
  await expect(page.getByRole("button", { name: "10" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Reset to zero" }).click();
  await expect(page.getByLabel("Current count 0")).toBeVisible();
});

test("keeps keyboard shortcuts scoped to the counter region", async ({ page }) => {
  await page.goto("/");

  const region = page.getByRole("region", { name: "Counter controls" });
  await region.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByLabel("Current count 1")).toBeVisible();

  await page.getByRole("button", { name: "Increase by 1" }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByLabel("Current count 1")).toBeVisible();

  await region.focus();
  await page.keyboard.press("R");
  await expect(page.getByLabel("Current count 1")).toBeVisible();
});

test("enforces the supported maximum at the UI boundary", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "pulse-counter:state",
      JSON.stringify({ version: 1, value: 999999, step: 25 }),
    );
  });

  await page.goto("/");

  await expect(page.getByLabel("Current count 999999")).toBeVisible();
  await expect(page.getByRole("button", { name: "Increase by 25" })).toBeDisabled();
});
