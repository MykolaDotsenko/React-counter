import { describe, expect, it } from "vitest";

import {
  createPriceMemoryRecord,
  findProductByLabel,
  memoryAgeDays,
  recentPriceMemories,
  upsertPriceMemory,
  type PriceMemoryRecord,
} from "../src/domain/price-memory";
import { isoTimestamp, storeId } from "../src/domain/shopping-trip";

const unwrap = <T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful Result");
  return result.value;
};

const record = (
  id: string,
  productId: string,
  label: string,
  price: number,
  observedAt: string,
  store?: { id: string; label: string },
): PriceMemoryRecord =>
  unwrap(
    createPriceMemoryRecord({
      id,
      productId,
      label,
      unitPriceMinor: price,
      observedAt,
      ...(store === undefined ? {} : { store }),
      source: { kind: "manual" },
    }),
  );

describe("price memory domain", () => {
  it("normalizes product labels and validates canonical observations", () => {
    const result = createPriceMemoryRecord({
      id: "memory-1",
      productId: "product-1",
      label: "  Milk 1L  ",
      unitPriceMinor: 139,
      observedAt: "2026-09-20T10:00:00.000Z",
      store: { id: "prisma", label: " Prisma " },
      source: { kind: "manual" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      id: "memory-1",
      product: { id: "product-1", label: "Milk 1L" },
      unitPriceMinor: 139,
      store: { id: "prisma", label: "Prisma" },
      source: { kind: "manual" },
    });
  });

  it("rejects memory-of-memory as a new observed price", () => {
    expect(
      createPriceMemoryRecord({
        id: "memory-1",
        productId: "product-1",
        label: "Milk",
        unitPriceMinor: 139,
        observedAt: "2026-09-20T10:00:00.000Z",
        source: { kind: "price-memory", memoryId: "older-memory" },
      }),
    ).toEqual({
      ok: false,
      error: { kind: "price-memory", code: "invalid-source" },
    });
  });

  it("matches a product identity by normalized human label", () => {
    const milk = record(
      "memory-1",
      "product-1",
      "Milk 1L",
      139,
      "2026-09-20T10:00:00.000Z",
    );

    expect(findProductByLabel([milk], "  MILK 1L ")).toEqual(
      milk.product,
    );
    expect(findProductByLabel([milk], "Bread")).toBeNull();
  });

  it("upserts by product and store slot without letting an older observation win", () => {
    const older = record(
      "memory-old",
      "product-1",
      "Milk",
      139,
      "2026-09-19T10:00:00.000Z",
      { id: "prisma", label: "Prisma" },
    );
    const newer = record(
      "memory-new",
      "product-1",
      "Milk",
      149,
      "2026-09-20T10:00:00.000Z",
      { id: "prisma", label: "Prisma" },
    );

    expect(upsertPriceMemory([older], newer)).toEqual([newer]);
    expect(upsertPriceMemory([newer], older)).toEqual([newer]);
  });

  it("keeps generic and store-specific memories as independent slots", () => {
    const generic = record(
      "memory-generic",
      "product-1",
      "Milk",
      139,
      "2026-09-20T10:00:00.000Z",
    );
    const prisma = record(
      "memory-prisma",
      "product-1",
      "Milk",
      149,
      "2026-09-20T11:00:00.000Z",
      { id: "prisma", label: "Prisma" },
    );

    expect(upsertPriceMemory([generic], prisma)).toEqual([
      generic,
      prisma,
    ]);
  });

  it("prefers same-store memory over a newer other-store observation", () => {
    const prisma = record(
      "memory-prisma",
      "product-1",
      "Milk",
      139,
      "2026-09-19T10:00:00.000Z",
      { id: "prisma", label: "Prisma" },
    );
    const kmarket = record(
      "memory-kmarket",
      "product-1",
      "Milk",
      169,
      "2026-09-21T10:00:00.000Z",
      { id: "kmarket", label: "K-Market" },
    );
    const bread = record(
      "memory-bread",
      "product-2",
      "Bread",
      249,
      "2026-09-20T10:00:00.000Z",
    );

    const prismaId = unwrap(storeId("prisma"));
    const recent = recentPriceMemories(
      [kmarket, bread, prisma],
      prismaId,
    );

    expect(recent[0]).toEqual(prisma);
    expect(recent).not.toContain(kmarket);
    expect(recent).toContain(bread);
  });

  it("falls back to generic memory before unrelated store-specific memory", () => {
    const generic = record(
      "memory-generic",
      "product-1",
      "Milk",
      139,
      "2026-09-18T10:00:00.000Z",
    );
    const otherStore = record(
      "memory-other",
      "product-1",
      "Milk",
      169,
      "2026-09-21T10:00:00.000Z",
      { id: "other", label: "Other Store" },
    );

    const targetStore = unwrap(storeId("prisma"));
    expect(
      recentPriceMemories([otherStore, generic], targetStore, 1),
    ).toEqual([generic]);
  });

  it("reports whole-day freshness without negative future ages", () => {
    const milk = record(
      "memory-1",
      "product-1",
      "Milk",
      139,
      "2026-09-20T10:00:00.000Z",
    );

    expect(
      memoryAgeDays(
        milk,
        unwrap(isoTimestamp("2026-09-21T12:00:00.000Z")),
      ),
    ).toBe(1);
    expect(
      memoryAgeDays(
        milk,
        unwrap(isoTimestamp("2026-09-19T12:00:00.000Z")),
      ),
    ).toBe(0);
  });
});
