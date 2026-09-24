import { expect, test } from "@playwright/test";

test("@cohort loads the isolated local-only retention analyzer", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Retention cohort analyzer" }),
  ).toBeVisible();
  await expect(
    page.getByText("Target cohort 20–50 real shoppers"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Cohort interpretation readiness",
    }),
  ).toBeVisible();

  const cohortSize = page
    .getByText("Cohort size")
    .locator("..");
  await expect(cohortSize).toContainText("0 / 20");
  await expect(cohortSize).toContainText("Collect more");

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

  await page.getByLabel("Select JSON exports").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":999}'),
  });

  await expect(page.getByText("Invalid 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("invalid 1");
});
