import { expect, test } from "@playwright/test";

const ACTIVE_TRIP_KEY = "budget-cart:active-trip";

const startQuickBudget = async (page, label = "€50") => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stay inside your limit" }),
  ).toBeVisible();
};

const hasHorizontalOverflow = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

test("starts a EUR 50 trip and restores it exactly after reload", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "How much can you spend today?",
    }),
  ).toBeVisible();

  await startQuickBudget(page);

  await expect(
    page.getByText("€50.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("LEFT", { exact: true })).toBeVisible();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();

  const persistedBeforeReload = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );

  expect(persistedBeforeReload).not.toBeNull();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Stay inside your limit" }),
  ).toBeVisible();
  await expect(page.getByText("LEFT", { exact: true })).toBeVisible();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();

  const persistedAfterReload = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );

  expect(persistedAfterReload).toBe(persistedBeforeReload);
});

test("starts with a safety buffer and makes safe remaining unambiguous", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByText("Add a safety buffer", { exact: true })
    .click();
  await page.getByLabel("Safety buffer").fill("2");

  await startQuickBudget(page);

  await expect(
    page.getByText("€48.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("SAFE TO SPEND", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/€2.00 kept in reserve/),
  ).toBeVisible();

  const capacity = page.getByRole("progressbar", {
    name: "Safe spending capacity remaining",
  });

  await expect(capacity).toHaveAttribute(
    "aria-valuetext",
    "€48.00 available before your reserve",
  );
});

test("surfaces a failed write without losing the in-memory trip", async ({
  page,
}) => {
  await page.addInitScript((storageKey) => {
    const original = Storage.prototype.setItem;

    Storage.prototype.setItem = function setItem(key, value) {
      if (key === storageKey) {
        throw new DOMException("Simulated quota failure", "QuotaExceededError");
      }

      return original.call(this, key, value);
    };
  }, ACTIVE_TRIP_KEY);

  await page.goto("/");
  await startQuickBudget(page);

  await expect(
    page.getByText("This trip is not being saved right now"),
  ).toBeVisible();
  await expect(
    page.getByText(/Keep this page open until checkout/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry" }),
  ).toBeVisible();

  await expect(page.getByText("LEFT", { exact: true })).toBeVisible();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();
});

test("enters recovery mode for malformed saved data without overwriting it", async ({
  page,
}) => {
  const malformed = "{broken";

  await page.addInitScript(
    ({ key, raw }) => {
      localStorage.setItem(key, raw);
    },
    { key: ACTIVE_TRIP_KEY, raw: malformed },
  );

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Saved trip needs recovery" }),
  ).toBeVisible();

  const preserved = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );

  expect(preserved).toBe(malformed);

  await page
    .getByRole("button", { name: "Try reading again" })
    .click();

  await expect(
    page.getByText(
      "The saved trip still cannot be restored safely. Nothing was overwritten.",
    ),
  ).toBeVisible();

  const afterRetry = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );

  expect(afterRetry).toBe(malformed);
});

test("preserves future-version data and explains the compatibility problem", async ({
  page,
}) => {
  const future = JSON.stringify({
    schemaVersion: 99,
    futurePayload: true,
  });

  await page.addInitScript(
    ({ key, raw }) => {
      localStorage.setItem(key, raw);
    },
    { key: ACTIVE_TRIP_KEY, raw: future },
  );

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Saved trip needs a newer app version",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/preserved unchanged and will not be overwritten/),
  ).toBeVisible();

  const preserved = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );

  expect(preserved).toBe(future);
});

test("keeps the core active-trip controls inside compact phone viewports", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await startQuickBudget(page);

    expect(await hasHorizontalOverflow(page)).toBe(false);

    const hero = page.getByLabel("Current spending status");
    const capacity = page.getByRole("progressbar", {
      name: "Budget capacity remaining",
    });
    const addPrice = page.getByRole("button", { name: "Add price" });

    await expect(hero).toBeVisible();
    await expect(capacity).toBeVisible();
    await expect(addPrice).toBeVisible();

    const addBox = await addPrice.boundingBox();
    expect(addBox).not.toBeNull();

    if (addBox !== null) {
      expect(addBox.y + addBox.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});

test("supports keyboard activation for the primary start and add actions", async ({
  page,
}) => {
  await page.goto("/");

  const fifty = page.getByRole("button", {
    name: "€50",
    exact: true,
  });

  await fifty.focus();
  await expect(fifty).toBeFocused();
  await page.keyboard.press("Enter");

  const addPrice = page.getByRole("button", { name: "Add price" });
  await expect(addPrice).toBeVisible();
  await addPrice.focus();
  await expect(addPrice).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Price entry is the next migration step."),
  ).toBeVisible();

  const dismiss = page.getByRole("button", { name: "Dismiss" });
  await dismiss.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Price entry is the next migration step."),
  ).toHaveCount(0);
});

test("remains usable at 200 percent text sizing without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });

  expect(await hasHorizontalOverflow(page)).toBe(false);
  await expect(
    page.getByRole("heading", {
      name: "How much can you spend today?",
    }),
  ).toBeVisible();

  await startQuickBudget(page);

  expect(await hasHorizontalOverflow(page)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Add price" }),
  ).toBeVisible();
});

test("reduced motion keeps the shopping flow functional and removes capacity transition", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await startQuickBudget(page);

  const capacityFill = page
    .getByRole("progressbar", {
      name: "Budget capacity remaining",
    })
    .locator("span");

  const duration = await capacityFill.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );

  expect(duration).toBe("0s");
  await expect(
    page.getByRole("button", { name: "Add price" }),
  ).toBeVisible();
});
