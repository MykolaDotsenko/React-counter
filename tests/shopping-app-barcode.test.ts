import { describe, expect, it } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import type { ShoppingAppController } from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import { isoTimestamp, type IsoTimestamp } from "../src/domain/shopping-trip";
import { BARCODE_LINK_STORAGE_KEY } from "../src/infrastructure/storage/barcode-link-storage";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";
import type { Gtin } from "../src/domain/product-code";

const must = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => must(isoTimestamp(value));

const MILK_EAN = "6414893386303";
const MILK = "06414893386303" as Gtin;

const createStorage = (
  initial: Record<string, string> = {},
  failKeys: readonly string[] = [],
) => {
  const values = new Map(Object.entries(initial));
  const control = { failKeys: [...failKeys] };
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (control.failKeys.includes(key)) {
        throw new Error("quota");
      }

      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  return { values, storage, control };
};

const boot = (
  storage: StorageLike | null,
  now: { current: string } = { current: "2026-09-21T09:00:00.000Z" },
): ShoppingAppController => {
  let id = 0;
  return bootstrapBrowserShoppingAppController({
    storage,
    storageScope: null,
    clock: { now: () => time(now.current) },
    ids: {
      tripId: () => `trip-${(id += 1)}`,
      itemId: () => `item-${(id += 1)}`,
    },
  });
};

const storedLinks = (values: Map<string, string>) =>
  (JSON.parse(values.get(BARCODE_LINK_STORAGE_KEY) ?? '{"data":{"links":[]}}') as {
    data: { links: { gtin: string; label: string }[] };
  }).data.links;

describe("barcode identification in the shopping app", () => {
  it("remembers the name a shopper gives a scanned product and its price after the trip", () => {
    const { values, storage } = createStorage();
    const controller = boot(storage);

    expect(controller.identifyBarcode(MILK_EAN, "ean-13")).toEqual({
      ok: true,
      code: { kind: "trade-item", gtin: MILK, symbology: "ean-13" },
      label: null,
      remembered: null,
    });

    controller.startTrip({ budgetMinor: money(5_000) });
    expect(
      controller.addManualItem({
        unitPriceMinor: money(129),
        quantity: 1,
        label: "Milk 1L",
        barcode: MILK,
      }).ok,
    ).toBe(true);

    expect(storedLinks(values)).toEqual([
      { gtin: MILK, label: "Milk 1L", linkedAt: "2026-09-21T09:00:00.000Z" },
    ]);
    expect(controller.identifyBarcode(MILK_EAN, null)).toMatchObject({
      ok: true,
      label: "Milk 1L",
      remembered: null,
    });

    expect(controller.completeTrip().ok).toBe(true);
    controller.dismissCompletedSummary();

    expect(controller.identifyBarcode(MILK_EAN, null)).toMatchObject({
      ok: true,
      label: "Milk 1L",
      remembered: { label: "Milk 1L", unitPriceMinor: 129 },
    });

    const reopened = boot(storage);
    expect(reopened.getSnapshot().barcodeLinks).toHaveLength(1);
  });

  it("links a barcode when a remembered price is reused and keeps a renamed product current", () => {
    const { values, storage } = createStorage();
    const now = { current: "2026-09-21T09:00:00.000Z" };
    const controller = boot(storage, now);

    controller.startTrip({ budgetMinor: money(5_000) });
    controller.addManualItem({ unitPriceMinor: money(129), quantity: 1, label: "Milk 1L" });
    controller.completeTrip();
    controller.dismissCompletedSummary();
    controller.startTrip({ budgetMinor: money(5_000) });

    const memory = controller.getSnapshot().priceMemories[0];

    if (memory === undefined) {
      throw new Error("Expected a remembered price");
    }

    expect(controller.addRememberedItem({ memoryId: memory.id, barcode: MILK }).ok).toBe(true);
    expect(storedLinks(values).map((entry) => entry.label)).toEqual(["Milk 1L"]);

    now.current = "2026-09-20T09:00:00.000Z";
    controller.addManualItem({
      unitPriceMinor: money(149),
      quantity: 1,
      label: "Oat milk 1L",
      barcode: MILK,
    });

    expect(storedLinks(values)).toEqual([
      { gtin: MILK, label: "Oat milk 1L", linkedAt: "2026-09-21T09:00:00.000Z" },
    ]);
  });

  it("does not link a barcode to an item without a name", () => {
    const { values, storage } = createStorage();
    const controller = boot(storage);

    controller.startTrip({ budgetMinor: money(5_000) });
    controller.addManualItem({ unitPriceMinor: money(129), quantity: 1, barcode: MILK });

    expect(values.has(BARCODE_LINK_STORAGE_KEY)).toBe(false);
    expect(controller.getSnapshot().barcodeLinks).toEqual([]);
  });

  it("identifies store codes and coupons without looking anything up", () => {
    const controller = boot(createStorage().storage);

    expect(controller.identifyBarcode("2012345678903", null)).toEqual({
      ok: true,
      code: { kind: "in-store", symbology: "ean-13" },
      label: null,
      remembered: null,
    });
    expect(controller.identifyBarcode("9900000000011", null)).toMatchObject({
      ok: true,
      code: { kind: "coupon" },
    });
    expect(controller.identifyBarcode("6414893386304", null)).toEqual({
      ok: false,
      error: { kind: "product-code", code: "invalid-check-digit" },
    });
  });

  it("reports a failed barcode save, keeps the link in memory and retries on the next add", () => {
    const { values, storage, control } = createStorage({}, [BARCODE_LINK_STORAGE_KEY]);
    const controller = boot(storage);

    controller.startTrip({ budgetMinor: money(5_000) });
    const added = controller.addManualItem({
      unitPriceMinor: money(129),
      quantity: 1,
      label: "Milk 1L",
      barcode: MILK,
    });

    expect(added).toMatchObject({ ok: true, durability: "persisted" });
    expect(controller.getSnapshot()).toMatchObject({
      barcodeLinks: [{ gtin: MILK, label: "Milk 1L" }],
      barcodeLinkPersistence: { status: "degraded", issue: { code: "write-failed" } },
      persistence: { status: "healthy" },
    });

    control.failKeys = [];
    controller.addManualItem({
      unitPriceMinor: money(99),
      quantity: 1,
      label: "Bread",
      barcode: "04006381333931" as Gtin,
    });

    expect(controller.getSnapshot().barcodeLinkPersistence).toEqual({ status: "healthy" });
    expect(storedLinks(values)).toHaveLength(2);
  });

  it("never writes over an unreadable barcode record, and clearing remembered prices resets it", () => {
    const { values, storage } = createStorage({ [BARCODE_LINK_STORAGE_KEY]: "{broken" });
    const controller = boot(storage);

    expect(controller.getSnapshot().barcodeLinkPersistence).toMatchObject({
      status: "degraded",
      issue: { code: "malformed-json" },
    });

    controller.startTrip({ budgetMinor: money(5_000) });
    controller.addManualItem({ unitPriceMinor: money(129), quantity: 1, label: "Milk 1L", barcode: MILK });

    expect(values.get(BARCODE_LINK_STORAGE_KEY)).toBe("{broken");
    expect(controller.identifyBarcode(MILK_EAN, null)).toMatchObject({ label: "Milk 1L" });

    controller.completeTrip();
    controller.dismissCompletedSummary();

    expect(controller.clearPriceMemory().ok).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      barcodeLinks: [],
      barcodeLinkPersistence: { status: "healthy" },
      priceMemories: [],
    });
    expect(storedLinks(values)).toEqual([]);
  });

  it("keeps barcode names in memory only when continuing without saving", () => {
    const controller = boot(null);

    controller.continueWithoutSaving();
    controller.startTrip({ budgetMinor: money(5_000) });
    controller.addManualItem({ unitPriceMinor: money(129), quantity: 1, label: "Milk 1L", barcode: MILK });

    expect(controller.getSnapshot()).toMatchObject({
      barcodeLinks: [{ gtin: MILK, label: "Milk 1L" }],
      barcodeLinkPersistence: { status: "degraded", issue: { code: "session-only" } },
    });
    expect(controller.identifyBarcode(MILK_EAN, null)).toMatchObject({ label: "Milk 1L" });
  });
});
