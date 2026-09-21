import { expect, test } from "@playwright/test";

const ACTIVE_TRIP_KEY = "budget-cart:active-trip";

const startQuickBudget = async (page, label = "€50") => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
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
  await expect(page.getByText("left", { exact: true })).toBeVisible();
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
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(page.getByText("left", { exact: true })).toBeVisible();
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
    page.getByText("safe to spend", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/€2.00 kept in reserve/),
  ).toBeVisible();

  const capacity = page.getByRole("progressbar", {
    name: "Shopping budget used",
  });

  await expect(capacity).toHaveAttribute(
    "aria-valuetext",
    /€48\.00 available before your reserve/,
  );
});

test("keeps an added item in memory when its persistence write fails", async ({
  page,
}) => {
  await page.addInitScript((storageKey) => {
    const original = Storage.prototype.setItem;
    let activeTripWrites = 0;

    Storage.prototype.setItem = function setItem(key, value) {
      if (key === storageKey) {
        activeTripWrites += 1;

        if (activeTripWrites === 2) {
          throw new DOMException(
            "Simulated add persistence failure",
            "QuotaExceededError",
          );
        }
      }

      return original.call(this, key, value);
    };
  }, ACTIVE_TRIP_KEY);

  await page.goto("/");
  await startQuickBudget(page);

  await expect(
    page.getByText("This trip is not being saved right now"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(
    page.getByText("€4.79 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("€45.21", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("This trip is not being saved right now"),
  ).toBeVisible();
  await expect(
    page.getByText(/Keep this page open until checkout/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry" }),
  ).toBeVisible();

  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );

  expect(persisted.data.items).toHaveLength(0);
});

test("commits exact price and quantity, persists them, and restores the same cart", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("1.29");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();

  await expect(page.getByText("€1.29 × 3 = €3.87")).toBeVisible();
  await expect(
    page.getByText("After adding: €46.13 left"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add · €3.87" }).click();

  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(page.getByText("3 items", { exact: true })).toBeVisible();
  await expect(
    page.getByText("€3.87 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("€46.13", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("€1.29 × 3", { exact: true })).toBeVisible();
  await expect(page.getByText("€3.87 added. €46.13 remaining.", { exact: true })).toBeVisible();

  const persistedBeforeReload = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );

  expect(persistedBeforeReload.data.items).toHaveLength(1);
  expect(persistedBeforeReload.data.items[0]).toMatchObject({
    unitPriceMinor: 129,
    quantity: 3,
    priceSource: { kind: "manual" },
  });
  expect(persistedBeforeReload.data.items[0].priceConfidence.kind).toBe(
    "confirmed",
  );

  await page.reload();

  await expect(
    page.getByText("€3.87 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("€1.29 × 3", { exact: true })).toBeVisible();
  await expect(page.getByText("3 items", { exact: true })).toBeVisible();
});

test("offers one-action Undo, persists the restored cart, and survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await expect(
    page.getByText("€4.79 added. €45.21 remaining.", { exact: true }),
  ).toBeVisible();

  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(
    page.getByText("Last change undone. €50.00 remaining.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );
  expect(persisted.data.items).toHaveLength(0);

  await page.reload();

  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

test("keeps the complete price-entry fast path inside compact phone viewports", async ({
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

    await page.getByRole("button", { name: "Add price" }).click();
    await page.getByRole("textbox", { name: "Price" }).fill("4.79");

    expect(await hasHorizontalOverflow(page)).toBe(false);

    const add = page.getByRole("button", { name: "Add · €4.79" });
    const addBox = await add.boundingBox();
    expect(addBox).not.toBeNull();

    if (addBox !== null) {
      expect(addBox.y + addBox.height).toBeLessThanOrEqual(viewport.height);
    }

    const sheetFitsWithoutInternalScroll = await page
      .getByRole("main")
      .evaluate((main) => {
        const sheet = main.firstElementChild;

        if (!(sheet instanceof HTMLElement)) {
          return false;
        }

        return sheet.scrollHeight <= sheet.clientHeight + 1;
      });

    expect(sheetFitsWithoutInternalScroll).toBe(true);
  }
});

test("keeps price entry and over-budget correction usable at 200 percent text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });

  await startQuickBudget(page);
  await page.getByRole("button", { name: "Add price" }).click();

  const input = page.getByRole("textbox", { name: "Price" });
  await input.fill("53.41");

  expect(await hasHorizontalOverflow(page)).toBe(false);
  await expect(
    page.getByText("This puts you €3.41 over your limit."),
  ).toBeVisible();

  const add = page.getByRole("button", { name: "Add · €53.41" });
  await add.scrollIntoViewIfNeeded();
  await add.click();

  await expect(
    page.getByRole("heading", { name: "Add this price anyway?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" }).last()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add anyway · €53.41" }),
  ).toBeVisible();
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

test("reduced motion preserves a complete add and undo path", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await expect(
    page.getByText("€4.79 of €50.00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();
});

test("core manual shopping remains functional after the page goes offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await context.setOffline(true);

  try {
    await startQuickBudget(page);
    await page.getByRole("button", { name: "Add price" }).click();
    await page.getByRole("textbox", { name: "Price" }).fill("1.29");
    await page.getByRole("button", { name: "Add · €1.29" }).click();

    await expect(
      page.getByText("€1.29 of €50.00", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("€48.71", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("completes the Sprint B flagship exact-money shopping journey", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Add a safety buffer", { exact: true }).click();
  await page.getByLabel("Safety buffer").fill("2");
  await startQuickBudget(page);

  const addPrice = async (price, expectedButton) => {
    await page.getByRole("button", { name: "Add price" }).click();
    await page.getByRole("textbox", { name: "Price" }).fill(price);
    await page.getByRole("button", { name: expectedButton }).click();
  };

  await addPrice("3.79", "Add · €3.79");
  await addPrice("12.50", "Add · €12.50");

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("1.29");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByText("€1.29 × 3 = €3.87")).toBeVisible();
  await page.getByRole("button", { name: "Add · €3.87" }).click();

  await expect(
    page.getByText("€20.16 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("€27.84", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add price" }).click();
  const typoInput = page.getByRole("textbox", { name: "Price" });
  await typoInput.fill("89.00");
  await expect(
    page.getByText("This puts you €59.16 over your limit."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await typoInput.fill("8.90");
  await expect(
    page.getByText("After adding: €18.94 safe to spend"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add · €8.90" }).click();

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("19.50");
  await expect(
    page.getByText("This item uses €0.56 of your safety buffer."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add · €19.50" }).click();

  await expect(
    page.getByText("€48.56 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("left in budget", { exact: true })).toBeVisible();
  await expect(
    page.getByText("€0.56 of your €2.00 reserve is being used", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("2.00");
  await expect(
    page.getByText("This puts you €0.56 over your limit."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add · €2.00" }).click();

  await expect(
    page.getByRole("heading", { name: "Add this price anyway?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).last().click();

  await expect(page.getByRole("textbox", { name: "Price" })).toHaveValue("2.00");
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("1.00");
  await page.getByRole("button", { name: "Add · €1.00" }).click();

  await expect(
    page.getByText("€49.56 of €50.00", { exact: true }),
  ).toBeVisible();

  const beforeReload = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );
  expect(beforeReload.data.items).toHaveLength(6);

  await page.reload();

  await expect(
    page.getByText("€49.56 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("8 items", { exact: true })).toBeVisible();

  await addPrice("0.20", "Add · €0.20");

  await expect(
    page.getByText("€49.76 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("€0.24 of your €2.00 reserve is being used"),
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
      name: "Shopping budget used",
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

test("supports keyboard add and returns focus to the canonical Add price action", async ({
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
  await addPrice.focus();
  await expect(addPrice).toBeFocused();
  await page.keyboard.press("Enter");

  const price = page.getByRole("textbox", { name: "Price" });
  await expect(price).toBeFocused();
  await price.fill("4.79");
  await page.keyboard.press("Enter");

  const returnedAddPrice = page.getByRole("button", { name: "Add price" });
  await expect(returnedAddPrice).toBeFocused();
  await expect(page.getByText("€4.79 added")).toBeVisible();
  await expect(
    page.getByText("€4.79 of €50.00", { exact: true }),
  ).toBeVisible();
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
      name: "Shopping budget used",
    })
    .locator("span");

  const durationMs = await capacityFill.evaluate((element) => {
    const duration = getComputedStyle(element).transitionDuration;
    const numeric = Number.parseFloat(duration);

    return duration.endsWith("ms") ? numeric : numeric * 1000;
  });

  expect(durationMs).toBeLessThan(1);
  await expect(
    page.getByRole("button", { name: "Add price" }),
  ).toBeVisible();
});
