import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const scan = async (page) =>
  new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

test("has no detectable WCAG A/AA violations on the start screen", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "axe scan runs once in Chromium");

  await page.goto("/");

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test("has no detectable WCAG A/AA violations on the active-trip screen", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "axe scan runs once in Chromium");

  await page.goto("/");
  await page.getByRole("button", { name: "€50", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Stay inside your limit" }),
  ).toBeVisible();

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test("retains visible focus across the core keyboard path", async ({
  page,
}) => {
  await page.goto("/");

  const quickBudget = page.getByRole("button", {
    name: "€50",
    exact: true,
  });

  await quickBudget.focus();
  await expect(quickBudget).toBeFocused();

  const focusOutline = await quickBudget.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );

  expect(focusOutline).not.toBe("none");

  await page.keyboard.press("Enter");

  const addPrice = page.getByRole("button", { name: "Add price" });
  await addPrice.focus();
  await expect(addPrice).toBeFocused();

  const activeOutline = await addPrice.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );

  expect(activeOutline).not.toBe("none");
});
