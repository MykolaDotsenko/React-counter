import { expect, test } from "@playwright/test";

const ACTIVE_TRIP_KEY = "budget-cart:active-trip";
const HISTORY_KEY = "budget-cart:history";
const appPath =
  process.env.PLAYWRIGHT_STAGED_SITE === "1"
    ? "/shopping-budget-companion/"
    : "/";

test("is installable and restores active/history state while offline", async ({
  page,
  context,
}) => {
  await page.goto(appPath);

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");

  expect(manifestHref).not.toBeNull();

  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href);
    return response.json();
  }, manifestHref);

  expect(manifest).toMatchObject({
    name: "Shopping Budget Companion",
    short_name: "Shop Budget",
    display: "standalone",
    start_url: "./",
    scope: "./",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]),
  );

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not available in this browser.");
    }

    await navigator.serviceWorker.ready;
  });

  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await page.getByRole("button", { name: "€50", exact: true }).click();
  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  const activeBeforeOffline = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );
  expect(activeBeforeOffline).not.toBeNull();

  await context.route("**/*", async (route) => {
    await route.abort();
  });

  try {
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Know what’s left" }),
    ).toBeVisible();
    await expect(
      page.getByText("€4.79 of €50.00", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("€45.21", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Finish trip" }).click();
    await page.getByRole("button", { name: "Finish trip" }).click();

    await expect(
      page.getByRole("heading", {
        name: "Your shopping trip is complete",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Done" }).click();

    await expect(
      page.getByRole("button", { name: "View trip history · 1" }),
    ).toBeVisible();

    const durableOfflineState = await page.evaluate(
      ({ activeKey, historyKey }) => ({
        active: localStorage.getItem(activeKey),
        history: JSON.parse(localStorage.getItem(historyKey)),
      }),
      { activeKey: ACTIVE_TRIP_KEY, historyKey: HISTORY_KEY },
    );

    expect(durableOfflineState.active).toBeNull();
    expect(durableOfflineState.history.data.trips).toHaveLength(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "View trip history · 1" })
      .click();

    await expect(page.getByText("€4.79 tracked")).toBeVisible();
  } finally {
    await context.unroute("**/*");
  }
});
