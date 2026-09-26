import { describe, expect, it } from "vitest";

import { createScanStabilizer } from "../src/application/barcode-scan";
import {
  MAX_BARCODE_LINKS,
  createBarcodeLink,
  findBarcodeLink,
  rememberedPriceForLabel,
  upsertBarcodeLink,
  type BarcodeLink,
} from "../src/domain/barcode-link";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import { createPriceMemoryRecord } from "../src/domain/price-memory";
import { gs1CheckDigit, type Gtin } from "../src/domain/product-code";
import {
  BARCODE_LINK_STORAGE_KEY,
  createBarcodeLinkPersistencePort,
  decodeBarcodeLinks,
  encodeBarcodeLinks,
} from "../src/infrastructure/storage/barcode-link-storage";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";

const must = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const gtin = (body12: string): Gtin =>
  `0${body12}${gs1CheckDigit(body12)}` as Gtin;
const link = (code: Gtin, label: string, linkedAt: string): BarcodeLink =>
  must(createBarcodeLink({ gtin: code, label, linkedAt }));

const MILK = gtin("641489338630");
const BREAD = gtin("641234567890");

const memoryStorage = (
  initial: Record<string, string> = {},
  failWrites = false,
) => {
  const values = new Map(Object.entries(initial));
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (failWrites) {
        throw new Error("quota");
      }

      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  return { values, storage };
};

describe("barcode links", () => {
  it("normalizes labels and refuses invalid identities", () => {
    expect(link(MILK, "  Milk   1L ", "2026-09-21T09:00:00.000Z").label).toBe("Milk 1L");
    expect(createBarcodeLink({ gtin: "06414893386304", label: "Milk", linkedAt: "2026-09-21T09:00:00.000Z" })).toMatchObject({
      ok: false,
      error: { code: "invalid-gtin" },
    });
    expect(createBarcodeLink({ gtin: MILK, label: "   ", linkedAt: "2026-09-21T09:00:00.000Z" })).toMatchObject({
      ok: false,
      error: { code: "invalid-label" },
    });
    expect(createBarcodeLink({ gtin: MILK, label: "Milk", linkedAt: "yesterday" })).toMatchObject({
      ok: false,
      error: { code: "invalid-timestamp" },
    });
  });

  it("keeps the newest name per barcode, most recent first, within a bound", () => {
    const first = upsertBarcodeLink([], link(MILK, "Milk", "2026-09-21T09:00:00.000Z"));
    const same = upsertBarcodeLink(first, link(MILK, "Milk", "2026-09-22T09:00:00.000Z"));
    const renamed = upsertBarcodeLink(first, link(MILK, "Oat milk", "2026-09-22T09:00:00.000Z"));
    const stale = upsertBarcodeLink(renamed, link(MILK, "Old name", "2026-09-20T09:00:00.000Z"));
    const both = upsertBarcodeLink(renamed, link(BREAD, "Bread", "2026-09-23T09:00:00.000Z"));

    expect(same).toBe(first);
    expect(findBarcodeLink(renamed, MILK)?.label).toBe("Oat milk");
    expect(stale).toBe(renamed);
    expect(both.map((entry) => entry.label)).toEqual(["Bread", "Oat milk"]);

    let many: readonly BarcodeLink[] = [];

    for (let index = 0; index <= MAX_BARCODE_LINKS; index += 1) {
      const body = String(100_000_000_000 + index);
      many = upsertBarcodeLink(
        many,
        link(gtin(body), `Item ${index}`, new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()),
      );
    }

    expect(many).toHaveLength(MAX_BARCODE_LINKS);
    expect(many.some((entry) => entry.label === "Item 0")).toBe(false);
  });

  it("finds the most recent remembered price for a linked name", () => {
    const older = must(createPriceMemoryRecord({
      label: "Milk 1L",
      unitPriceMinor: money(129),
      observedAt: "2026-09-10T09:00:00.000Z",
      storeId: "prisma",
      source: { kind: "manual" },
    }));
    const newer = must(createPriceMemoryRecord({
      label: "milk 1l",
      unitPriceMinor: money(135),
      observedAt: "2026-09-20T09:00:00.000Z",
      source: { kind: "manual" },
    }));

    expect(rememberedPriceForLabel([older, newer], "Milk 1L")).toBe(newer);
    expect(rememberedPriceForLabel([older], "Bread")).toBeNull();
    expect(rememberedPriceForLabel([older], "   ")).toBeNull();
  });
});

describe("barcode link storage", () => {
  const links = [
    link(MILK, "Milk 1L", "2026-09-21T09:00:00.000Z"),
    link(BREAD, "Bread", "2026-09-20T09:00:00.000Z"),
  ];

  it("round-trips a versioned envelope under its own key", () => {
    const { values, storage } = memoryStorage();
    const port = createBarcodeLinkPersistencePort(storage);

    expect(port.save(links, "2026-09-21T10:00:00.000Z" as never)).toEqual({ ok: true });
    expect(JSON.parse(values.get(BARCODE_LINK_STORAGE_KEY) ?? "")).toMatchObject({
      schemaVersion: 1,
      savedAt: "2026-09-21T10:00:00.000Z",
    });
    expect(port.bootstrap()).toEqual({ ok: true, links });
  });

  it("starts empty when nothing was stored", () => {
    expect(createBarcodeLinkPersistencePort(memoryStorage().storage).bootstrap()).toEqual({
      ok: true,
      links: [],
    });
  });

  it("reports damaged, newer and conflicting records instead of guessing", () => {
    expect(decodeBarcodeLinks("{nope")).toMatchObject({ ok: false, issue: { code: "malformed-json" } });
    expect(decodeBarcodeLinks(JSON.stringify({ schemaVersion: 2, savedAt: "x", data: {} }))).toMatchObject({
      ok: false,
      issue: { code: "unsupported-version", schemaVersion: 2 },
    });
    expect(decodeBarcodeLinks(JSON.stringify({ schemaVersion: 1 }))).toMatchObject({
      ok: false,
      issue: { code: "invalid-envelope" },
    });

    const encoded = encodeBarcodeLinks(links, "2026-09-21T10:00:00.000Z");

    if (!encoded.ok) {
      throw new Error("Expected encoding");
    }

    const envelope = JSON.parse(encoded.raw) as { data: { links: unknown[] } };
    envelope.data.links.push({ gtin: "06414893386304", label: "Bad", linkedAt: "2026-09-21T09:00:00.000Z" });
    const partly = decodeBarcodeLinks(JSON.stringify(envelope));

    expect(partly).toMatchObject({ ok: true, invalidEntryCount: 1 });

    envelope.data.links = [envelope.data.links[0], envelope.data.links[0]];
    expect(decodeBarcodeLinks(JSON.stringify(envelope))).toMatchObject({
      ok: false,
      issue: { code: "barcode-link-conflict" },
    });

    const { storage } = memoryStorage({ [BARCODE_LINK_STORAGE_KEY]: "{nope" });
    expect(createBarcodeLinkPersistencePort(storage).bootstrap()).toMatchObject({
      ok: false,
      links: [],
      issue: { code: "malformed-json", storageKey: BARCODE_LINK_STORAGE_KEY },
    });
  });

  it("reports write and availability failures", () => {
    expect(createBarcodeLinkPersistencePort(memoryStorage({}, true).storage).save(links, "2026-09-21T10:00:00.000Z" as never)).toMatchObject({
      ok: false,
      issue: { code: "write-failed" },
    });
    expect(createBarcodeLinkPersistencePort(null).bootstrap()).toMatchObject({
      ok: false,
      issue: { code: "storage-unavailable" },
    });
    expect(createBarcodeLinkPersistencePort(null).save(links, "2026-09-21T10:00:00.000Z" as never)).toMatchObject({
      ok: false,
      issue: { code: "storage-unavailable" },
    });
    expect(encodeBarcodeLinks([links[0] as BarcodeLink, links[0] as BarcodeLink], "2026-09-21T10:00:00.000Z")).toMatchObject({
      ok: false,
      issue: { code: "barcode-link-conflict" },
    });
    expect(encodeBarcodeLinks(links, "not a time")).toMatchObject({
      ok: false,
      issue: { code: "serialization-failed" },
    });

    const throwingRead: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {},
      removeItem() {},
    };
    expect(createBarcodeLinkPersistencePort(throwingRead).bootstrap()).toMatchObject({
      ok: false,
      issue: { code: "read-failed" },
    });
  });
});

describe("scan stabilizer", () => {
  const reading = (rawValue: string) => ({ rawValue, symbology: null });

  it("accepts a code only after it is read twice in a short window", () => {
    const stabilizer = createScanStabilizer();

    expect(stabilizer.accept([reading("6414893386303")], 0)).toBeNull();
    expect(stabilizer.accept([reading("6414893386303")], 100)).toMatchObject({
      reading: { rawValue: "6414893386303" },
      code: { kind: "trade-item", gtin: "06414893386303" },
    });
    expect(stabilizer.accept([reading("6414893386303")], 200)).toBeNull();
  });

  it("ignores misreads and restarts on a different or late code", () => {
    const stabilizer = createScanStabilizer({ requiredMatches: 2, windowMs: 500 });

    expect(stabilizer.accept([reading("6414893386304"), reading("")], 0)).toBeNull();
    expect(stabilizer.accept([reading("6414893386303")], 10)).toBeNull();
    expect(stabilizer.accept([reading("4006381333931")], 20)).toBeNull();
    expect(stabilizer.accept([reading("6414893386303")], 30)).toBeNull();
    expect(stabilizer.accept([reading("6414893386303")], 900)).toBeNull();
    expect(stabilizer.accept([reading("6414893386303")], 950)).not.toBeNull();

    stabilizer.accept([reading("6414893386303")], 1_000);
    stabilizer.reset();
    expect(stabilizer.accept([reading("6414893386303")], 1_050)).toBeNull();
  });

  it("stabilizes store codes by their exact digits", () => {
    const stabilizer = createScanStabilizer();
    const storeCode = `201234567890${gs1CheckDigit("201234567890")}`;

    stabilizer.accept([reading(storeCode)], 0);
    expect(stabilizer.accept([reading(storeCode)], 50)).toMatchObject({
      code: { kind: "in-store" },
    });
  });
});
