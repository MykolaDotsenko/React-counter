import { describe, expect, it } from "vitest";

import { createPriceMemoryRecord } from "../src/domain/price-memory";
import {
  decodePriceMemorySnapshot,
  encodePriceMemorySnapshot,
  restorePriceMemory,
  writePriceMemory,
} from "../src/infrastructure/storage/price-memory-storage";
import {
  CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
  PRICE_MEMORY_STORAGE_KEY,
} from "../src/infrastructure/storage/price-memory-storage-schema";

const TIME = "2026-09-21T10:00:00.000Z";

const memory = () => {
  const result = createPriceMemoryRecord({
    id: "memory-1",
    productId: "product-1",
    label: "Milk 1L",
    unitPriceMinor: 139,
    observedAt: "2026-09-20T10:00:00.000Z",
    store: { id: "prisma", label: "Prisma" },
    source: { kind: "manual" },
  });
  if (!result.ok) throw new Error("Expected memory fixture");
  return result.value;
};

const createStorage = (
  entries: Record<string, string> = {},
  options: {
    failGet?: boolean;
    failSet?: boolean;
  } = {},
) => {
  const values = new Map(Object.entries(entries));
  const writes: Array<{ key: string; value: string }> = [];
  return {
    values,
    writes,
    getItem(key: string) {
      if (options.failGet) throw new Error("read blocked");
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.failSet) throw new Error("write blocked");
      writes.push({ key, value });
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
};

describe("price-memory persistence", () => {
  it("round-trips exact canonical memory independently of shopping state", () => {
    const encoded = encodePriceMemorySnapshot([memory()], TIME);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const parsed = JSON.parse(encoded.raw);
    expect(parsed.schemaVersion).toBe(
      CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
    );
    expect(parsed.data.records[0]).toMatchObject({
      id: "memory-1",
      product: { id: "product-1", label: "Milk 1L" },
      unitPriceMinor: 139,
      observedAt: "2026-09-20T10:00:00.000Z",
      store: { id: "prisma", label: "Prisma" },
      source: { kind: "manual" },
    });

    const decoded = decodePriceMemorySnapshot(encoded.raw);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.records).toEqual([memory()]);
    expect(decoded.invalidEntryCount).toBe(0);
  });

  it("quarantines an invalid record while preserving valid memory", () => {
    const encoded = encodePriceMemorySnapshot([memory()], TIME);
    if (!encoded.ok) throw new Error("Expected encoded memory");

    const envelope = JSON.parse(encoded.raw);
    envelope.data.records.push({
      ...structuredClone(envelope.data.records[0]),
      id: "broken-memory",
      observedAt: "not-a-time",
    });
    const raw = JSON.stringify(envelope);

    const restored = restorePriceMemory(
      createStorage({ [PRICE_MEMORY_STORAGE_KEY]: raw }),
    );

    expect(restored.health).toBe("degraded");
    expect(restored.records).toEqual([memory()]);
    if (restored.health !== "degraded") return;
    expect(restored.issue).toEqual({
      kind: "persistence",
      code: "invalid-price-memory-entry",
      storageKey: PRICE_MEMORY_STORAGE_KEY,
    });
    expect(restored.raw).toBe(raw);
  });

  it("rejects duplicate product/store slots as a conflict", () => {
    const first = memory();
    const secondResult = createPriceMemoryRecord({
      id: "memory-2",
      productId: "product-1",
      label: "Milk 1L",
      unitPriceMinor: 149,
      observedAt: TIME,
      store: { id: "prisma", label: "Prisma" },
      source: { kind: "manual" },
    });
    if (!secondResult.ok) throw new Error("Expected second memory");

    expect(
      encodePriceMemorySnapshot([first, secondResult.value], TIME),
    ).toMatchObject({
      ok: false,
      issue: {
        code: "price-memory-conflict",
        storageKey: PRICE_MEMORY_STORAGE_KEY,
      },
    });
  });

  it("preserves unsupported future memory unchanged", () => {
    const raw = JSON.stringify({
      schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION + 1,
      savedAt: TIME,
      data: { records: [] },
    });
    const storage = createStorage({
      [PRICE_MEMORY_STORAGE_KEY]: raw,
    });

    const restored = restorePriceMemory(storage);
    expect(restored.health).toBe("degraded");
    if (restored.health !== "degraded") return;
    expect(restored.issue).toMatchObject({
      code: "unsupported-version",
      storageKey: PRICE_MEMORY_STORAGE_KEY,
      schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION + 1,
    });
    expect(storage.values.get(PRICE_MEMORY_STORAGE_KEY)).toBe(raw);
    expect(storage.writes).toHaveLength(0);
  });

  it("reports memory write failure without mutating caller records", () => {
    const records = [memory()] as const;
    const before = structuredClone(records);

    expect(
      writePriceMemory(createStorage({}, { failSet: true }), records, TIME),
    ).toEqual({
      health: "degraded",
      issue: {
        kind: "persistence",
        code: "write-failed",
        storageKey: PRICE_MEMORY_STORAGE_KEY,
      },
    });
    expect(records).toEqual(before);
  });

  it("reports unavailable or unreadable memory independently", () => {
    expect(restorePriceMemory(null)).toMatchObject({
      health: "degraded",
      records: [],
      issue: {
        code: "storage-unavailable",
        storageKey: PRICE_MEMORY_STORAGE_KEY,
      },
    });
    expect(
      restorePriceMemory(createStorage({}, { failGet: true })),
    ).toMatchObject({
      health: "degraded",
      records: [],
      issue: {
        code: "read-failed",
        storageKey: PRICE_MEMORY_STORAGE_KEY,
      },
    });
  });
});
