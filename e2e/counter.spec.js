import { expect, test } from "@playwright/test";

test("completes the primary interaction flow", async ({ page }) => {
  await page.goto("/");

  const value = page.getByLabel(/Current count/);
  await expect(value).toHaveAttribute("aria-label", "Current count 0");

  await page.getByRole("button", { name: "Increase by 1" }).click();
  await expect(page.getByLabel("Current count 1")).toBeVisible();

  await page.getByRole("button", { name: "Set step to 10" }).click();
  await page.getByRole("button", { name: "Increase by 10" }).click();
  await expect(page.getByLabel("Current count 11")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Current count 11")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Set step to 10" }),
  ).toHaveAttribute("aria-pressed", "true");

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
  await expect(
    page.getByRole("button", { name: "Increase by 25" }),
  ).toBeDisabled();
});

test("stays usable without horizontal overflow on a compact mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByRole("heading", { name: "Pulse Counter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Increase by 1" })).toBeVisible();

  await page.getByRole("button", { name: "Set step to 25" }).click();
  await page.getByRole("button", { name: "Increase by 25" }).click();
  await expect(page.getByLabel("Current count 25")).toBeVisible();
});

test("reduced motion keeps the interaction functional and collapses ambient animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const animationDurationMs = await page.locator(".orbit-track--outer").evaluate((element) => {
    const duration = getComputedStyle(element).animationDuration;
    const numeric = Number.parseFloat(duration);
    return duration.endsWith("ms") ? numeric : numeric * 1000;
  });

  expect(animationDurationMs).toBeLessThan(1);

  await page.getByRole("button", { name: "Increase by 1" }).click();
  await expect(page.getByLabel("Current count 1")).toBeVisible();
});
