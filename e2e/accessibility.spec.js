import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no detectable WCAG A/AA violations", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "axe scan runs once in Chromium");

  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
