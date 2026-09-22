import { expect, test } from "@playwright/test";

const ACTIVE_TRIP_KEY = "budget-cart:active-trip";
const HISTORY_KEY = "budget-cart:history";
const PRICE_MEMORY_KEY = "budget-cart:price-memory";
const RETENTION_BETA_KEY = "budget-cart:qa:retention-v1";

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
    page.getByText(/^€2\.00 kept in reserve\./),
  ).toBeVisible();

  const capacity = page.getByRole("progressbar", {
    name: "Shopping budget used",
  });

  await expect(capacity).toHaveAttribute(
    "aria-valuetext",
    /€48\.00 available before your reserve/,
  );
});

test("adjusts budget and safety buffer as one canonical mutation", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await page.getByRole("button", { name: "Adjust budget" }).click();

  const budget = page.getByRole("textbox", { name: "Budget" });
  const buffer = page.getByRole("textbox", { name: /Safety buffer/ });

  await budget.fill("4.00");
  await buffer.fill("");

  await expect(
    page.getByText("Current cart will be €0.79 over this budget."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save budget" }).click();

  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(page.getByText("€0.79", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("over your limit", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Budget updated. €0.79 over your limit.", {
      exact: true,
    }),
  ).toBeVisible();

  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );

  expect(persisted.data).toMatchObject({
    budgetMinor: 400,
    safetyBufferMinor: 0,
  });
  expect(persisted.data.items).toHaveLength(1);
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

test("edits price and quantity, removes the item, undoes removal, and restores the correction", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await expect(page.getByText("Confirmed · Manual")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit" }).click();

  const editedPrice = page.getByRole("textbox", { name: "Price" });
  await expect(editedPrice).toHaveValue("4.79");
  await editedPrice.fill("5.29");
  await page
    .getByRole("button", { name: "Increase edited quantity" })
    .click();

  await expect(
    page.getByText("After saving: €39.42 left"),
  ).toBeVisible();
  await expect(
    page.getByText("Cart would be €10.58 of €50.00."),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Save correction" })
    .click();

  await expect(
    page.getByText("€10.58 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("€5.29 × 2", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Item corrected. €39.42 remaining.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit" }),
  ).toBeFocused();

  const persistedAfterEdit = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );

  expect(persistedAfterEdit.data.items).toHaveLength(1);
  expect(persistedAfterEdit.data.items[0]).toMatchObject({
    unitPriceMinor: 529,
    quantity: 2,
    priceSource: { kind: "manual" },
  });
  expect(persistedAfterEdit.data.items[0].priceConfidence.kind).toBe(
    "confirmed",
  );

  await page.getByRole("button", { name: "Remove" }).click();

  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Item removed. €50.00 remaining.", {
      exact: true,
    }),
  ).toBeVisible();

  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(
    page.getByText("€10.58 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("€5.29 × 2", { exact: true }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByText("€10.58 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("€5.29 × 2", { exact: true }),
  ).toBeVisible();
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
  await expect(page.getByText("safe to spend", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Safety buffer reached · €1.44 remains in your nominal budget",
      { exact: true },
    ),
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
    page.getByText(
      "Safety buffer reached · €0.24 remains in your nominal budget",
    ),
  ).toBeVisible();
});

test("finishes a trip loss-safely, reconciles checkout, persists history, and restores history after reload", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await page.getByRole("button", { name: "Finish trip" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Ready to finish this trip?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep shopping" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Finish trip" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Your shopping trip is complete",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No checkout total added. Your completed trip is still valid.",
    ),
  ).toBeVisible();

  const persistedAfterFinish = await page.evaluate(
    ({ activeKey, historyKey }) => ({
      active: localStorage.getItem(activeKey),
      history: JSON.parse(localStorage.getItem(historyKey)),
    }),
    { activeKey: ACTIVE_TRIP_KEY, historyKey: HISTORY_KEY },
  );

  expect(persistedAfterFinish.active).toBeNull();
  expect(persistedAfterFinish.history.schemaVersion).toBe(1);
  expect(persistedAfterFinish.history.data.trips).toHaveLength(1);
  expect(persistedAfterFinish.history.data.trips[0]).toMatchObject({
    status: "completed",
    budgetMinor: 5000,
  });
  expect(persistedAfterFinish.history.data.trips[0].items).toHaveLength(1);
  expect(persistedAfterFinish.history.data.trips[0].items[0]).toMatchObject({
    unitPriceMinor: 479,
    quantity: 1,
  });

  await page
    .getByRole("textbox", { name: "Actual checkout total" })
    .fill("5.00");
  await page
    .getByRole("button", { name: "Save checkout total" })
    .click();

  await expect(
    page.getByText("€0.21 more than the tracked cart."),
  ).toBeVisible();

  const persistedAfterCheckout = await page.evaluate(
    (historyKey) => JSON.parse(localStorage.getItem(historyKey)),
    HISTORY_KEY,
  );
  expect(
    persistedAfterCheckout.data.trips[0].actualCheckoutMinor,
  ).toBe(500);

  await page
    .getByRole("button", { name: "View trip history" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Past shopping trips" }),
  ).toBeVisible();
  await expect(page.getByText("€4.79 tracked")).toBeVisible();
  await expect(page.getByText("€5.00")).toBeVisible();
  await expect(
    page.getByText("€0.21 more at checkout"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(
    page.getByRole("heading", {
      name: "How much can you spend today?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View trip history · 1" }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: "View trip history · 1" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View trip history · 1" })
    .click();
  await expect(page.getByText("€4.79 tracked")).toBeVisible();
  await expect(
    page.getByText("€0.21 more at checkout"),
  ).toBeVisible();
});

test("repeats the last spending plan immediately and after a later reload", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByText("Add a safety buffer", { exact: true }).click();
  await page.getByLabel("Safety buffer").fill("2");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Finish trip" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Your shopping trip is complete",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Shop again" }).click();

  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(
    page.getByText("€48.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing in your cart yet.", { exact: true }),
  ).toBeVisible();

  const repeated = await page.evaluate(
    ({ activeKey, historyKey }) => ({
      active: JSON.parse(localStorage.getItem(activeKey)),
      history: JSON.parse(localStorage.getItem(historyKey)),
    }),
    { activeKey: ACTIVE_TRIP_KEY, historyKey: HISTORY_KEY },
  );

  expect(repeated.active.data).toMatchObject({
    budgetMinor: 5000,
    safetyBufferMinor: 200,
    items: [],
  });
  expect(repeated.history.data.trips).toHaveLength(1);

  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await page.reload();

  const repeatShortcut = page.getByRole("button", { name: /Shop again/i });
  await expect(repeatShortcut).toContainText("€50.00 budget");
  await expect(repeatShortcut).toContainText("€2.00 reserve");

  await repeatShortcut.click();

  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(
    page.getByText("€48.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();

  const laterRepeat = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    ACTIVE_TRIP_KEY,
  );

  expect(laterRepeat.data).toMatchObject({
    budgetMinor: 5000,
    safetyBufferMinor: 200,
    items: [],
  });
});

test("learns named completed items, reuses remembered prices, and keeps current-price override explicit", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("1.39");
  await page.getByText("Name for next time", { exact: false }).click();
  await page.getByRole("textbox", { name: "Item name" }).fill("Milk 1L");
  await page.getByRole("button", { name: "Add · €1.39" }).click();

  await expect(
    page.getByText("€1.39 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Milk 1L", { exact: true })).toBeVisible();

  const memoryBeforeCompletion = await page.evaluate(
    (key) => localStorage.getItem(key),
    PRICE_MEMORY_KEY,
  );
  expect(memoryBeforeCompletion).toBeNull();

  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Finish trip" }).click();

  const learnedMemory = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    PRICE_MEMORY_KEY,
  );

  expect(learnedMemory).toMatchObject({
    schemaVersion: 1,
    data: {
      records: [
        {
          label: "Milk 1L",
          productId: "label:milk 1l",
          currency: "EUR",
          unitPriceMinor: 139,
          source: { kind: "manual" },
        },
      ],
    },
  });

  await page.getByRole("button", { name: "Shop again" }).click();

  await expect(
    page.getByRole("heading", { name: "Recent Items" }),
  ).toBeVisible();
  await expect(page.getByText("Milk 1L", { exact: true })).toBeVisible();
  await expect(page.getByText(/Remembered · Seen/)).toBeVisible();

  await page
    .getByRole("button", { name: "Use remembered price for Milk 1L" })
    .click();

  await expect(
    page.getByText("€1.39 of €50.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Remembered · Price memory", { exact: true }),
  ).toBeVisible();

  const memoryAfterReuse = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    PRICE_MEMORY_KEY,
  );
  expect(memoryAfterReuse.data.records[0].observedAt).toBe(
    learnedMemory.data.records[0].observedAt,
  );

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(
    page.getByText("€0.00 of €50.00", { exact: true }),
  ).toBeVisible();

  const currentPriceTrigger = page.getByRole("button", {
    name: "Enter current price for Milk 1L",
  });
  await currentPriceTrigger.click();

  await expect(
    page.getByText("Current price for", { exact: false }),
  ).toContainText("Milk 1L");

  const priceInput = page.getByRole("textbox", { name: "Price" });
  await expect(priceInput).toHaveValue("");

  await priceInput.fill("1.49");
  await page.getByRole("button", { name: "Add · €1.49" }).click();

  await expect(
    page.getByText("€1.49 of €50.00", { exact: true }),
  ).toBeVisible();
  const cartRegion = page.getByRole("region", {
    name: "What you have added",
  });
  await expect(
    cartRegion.getByText("Milk 1L", { exact: true }),
  ).toBeVisible();
  await expect(
    cartRegion.getByText("Remembered · Price memory", { exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Finish trip" }).click();

  const updatedMemory = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    PRICE_MEMORY_KEY,
  );

  expect(updatedMemory.data.records).toHaveLength(1);
  expect(updatedMemory.data.records[0]).toMatchObject({
    label: "Milk 1L",
    productId: "label:milk 1l",
    unitPriceMinor: 149,
    source: { kind: "manual" },
  });
  expect(updatedMemory.data.records[0].observedAt).not.toBe(
    learnedMemory.data.records[0].observedAt,
  );
});

test("records privacy-safe retention evidence across a repeated trip", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("1.39");
  await page.getByText("Name for next time", { exact: false }).click();
  await page.getByRole("textbox", { name: "Item name" }).fill("Milk 1L");
  await page.getByRole("button", { name: "Add · €1.39" }).click();

  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Shop again" }).click();

  await page
    .getByRole("button", { name: "Use remembered price for Milk 1L" })
    .click();

  const evidence = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const forbiddenKeys = new Set([
      "budgetMinor",
      "safetyBufferMinor",
      "unitPriceMinor",
      "lineTotalMinor",
      "label",
      "productId",
      "memoryId",
      "storeId",
      "actualCheckoutMinor",
    ]);
    const foundForbidden = [];

    const visit = (value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (value === null || typeof value !== "object") {
        return;
      }

      for (const [entryKey, entryValue] of Object.entries(value)) {
        if (forbiddenKeys.has(entryKey)) {
          foundForbidden.push(entryKey);
        }
        visit(entryValue);
      }
    };

    visit(parsed);

    return {
      parsed,
      foundForbidden,
    };
  }, RETENTION_BETA_KEY);

  expect(evidence).not.toBeNull();
  expect(evidence.foundForbidden).toEqual([]);
  expect(evidence.parsed).toMatchObject({
    version: 1,
    variant: "repeat-acceleration",
  });

  expect(evidence.parsed.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
      expect.objectContaining({
        type: "manual_entry_completed",
        tripOrdinal: 1,
      }),
      expect.objectContaining({
        type: "item_milestone",
        tripOrdinal: 1,
        itemCount: 1,
      }),
      expect.objectContaining({
        type: "trip_finished",
        tripOrdinal: 1,
      }),
      expect.objectContaining({
        type: "trip_started",
        tripOrdinal: 2,
        source: "repeat",
      }),
      expect.objectContaining({
        type: "remembered_item_used",
        tripOrdinal: 2,
      }),
      expect.objectContaining({
        type: "item_milestone",
        tripOrdinal: 2,
        itemCount: 1,
      }),
    ]),
  );
});

test("records an active-trip restore without placing beta UI over the trip", async ({
  page,
}) => {
  await page.goto("/");
  await startQuickBudget(page);

  await expect(
    page.getByRole("button", { name: "Beta evidence" }),
  ).toHaveCount(0);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beta evidence" }),
  ).toHaveCount(0);

  const evidence = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, RETENTION_BETA_KEY);

  expect(evidence).not.toBeNull();
  expect(evidence.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
      expect.objectContaining({
        type: "trip_restored",
        tripOrdinal: 1,
      }),
    ]),
  );
});

test("never clears the active trip when completed-history persistence fails", async ({
  page,
}) => {
  await page.addInitScript((historyKey) => {
    const original = Storage.prototype.setItem;

    Storage.prototype.setItem = function setItem(key, value) {
      if (key === historyKey) {
        throw new DOMException(
          "Simulated history write failure",
          "QuotaExceededError",
        );
      }

      return original.call(this, key, value);
    };
  }, HISTORY_KEY);

  await page.goto("/");
  await startQuickBudget(page);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByRole("textbox", { name: "Price" }).fill("4.79");
  await page.getByRole("button", { name: "Add · €4.79" }).click();

  const activeBeforeFinish = await page.evaluate(
    (key) => localStorage.getItem(key),
    ACTIVE_TRIP_KEY,
  );
  expect(activeBeforeFinish).not.toBeNull();

  await page.getByRole("button", { name: "Finish trip" }).click();
  await page.getByRole("button", { name: "Finish trip" }).click();

  await expect(
    page.getByRole("alert"),
  ).toContainText("active trip is still intact");

  const persistedAfterFailure = await page.evaluate(
    ({ activeKey, historyKey }) => ({
      active: localStorage.getItem(activeKey),
      history: localStorage.getItem(historyKey),
    }),
    { activeKey: ACTIVE_TRIP_KEY, historyKey: HISTORY_KEY },
  );

  expect(persistedAfterFailure.active).toBe(activeBeforeFinish);
  expect(persistedAfterFailure.history).toBeNull();

  await page.getByRole("button", { name: "Keep shopping" }).click();
  await expect(
    page.getByRole("heading", { name: "Know what’s left" }),
  ).toBeVisible();
  await expect(
    page.getByText("€4.79 of €50.00", { exact: true }),
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
