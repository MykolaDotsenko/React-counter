import { describe, expect, it } from "vitest";

import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createPriceMemoryRecord,
  type PriceMemoryRecord,
} from "../src/domain/price-memory";
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
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";

const OBSERVED = "2026-09-21T09:00:00.000Z";
const SAVED = "2026-09-21T09:05:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const memory = (
  label = "Milk",
  price = 139,
): PriceMemoryRecord =>
  unwrap(
    createPriceMemoryRecord({
      label,
      unitPriceMinor: unwrap(mvpMinorUnits(price)),
      observedAt: OBSERVED,
      source: { kind: "manual" },
    }),
  );

const createStorage = (
  entries: Record<string, string> = {},
  options: { readonly failGet?: boolean; readonly failSet?: boolean } = {},
): StorageLike & { readonly values: Map<string, string> } => {
  const values = new Map(Object.entries(entries));

  return {
    values,
    getItem(key) {
      if (options.failGet) {
        throw new Error("read blocked");
      }

      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.failSet) {
        throw new Error("write blocked");
      }

      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
};

describe("price memory persistence", () => {
  it("round-trips a strict versioned snapshot", () => {
    const record = memory();
    const encoded = encodePriceMemorySnapshot([record], SAVED);

    expect(encoded.ok).toBe(true);

    if (!encoded.ok) {
      throw new Error("Expected encoded memory");
    }

    const parsed = JSON.parse(encoded.raw);
    expect(parsed).toMatchObject({
      schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
      savedAt: SAVED,
      data: {
        records: [
          {
            id: record.id,
            productId: record.productId,
            label: "Milk",
            currency: "EUR",
            unitPriceMinor: 139,
            observedAt: OBSERVED,
            source: { kind: "manual" },
          },
        ],
      },
    });

    const decoded = decodePriceMemorySnapshot(encoded.raw);
    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      throw new Error("Expected decoded memory");
    }

    expect(decoded.records).toEqual([record]);
    expect(decoded.invalidEntryCount).toBe(0);
  });

  it("rejects a mismatched deterministic memory id", () => {
    const record = memory();
    const raw = JSON.stringify({
      schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
      savedAt: SAVED,
      data: {
        records: [
          {
            ...record,
            id: "memory:tampered",
          },
        ],
      },
    });

    const decoded = decodePriceMemorySnapshot(raw);

    expect(decoded.ok).toBe(true);

    if (!decoded.ok) {
      throw new Error("Expected partial decode");
    }

    expect(decoded.records).toEqual([]);
    expect(decoded.invalidEntryCount).toBe(1);
  });

  it("preserves valid records while quarantining malformed entries", () => {
    const record = memory();
    const raw = JSON.stringify({
      schemaVersion: CURRENT_PRICE_MEMORY_SCHEMA_VERSION,
      savedAt: SAVED,
      data: {
        records: [
          {
            id: record.id,
            productId: record.productId,
            label: record.label,
            currency: record.currency,
            unitPriceMinor: record.unitPriceMinor,
            observedAt: record.observedAt,
            source: record.source,
          },
          {
            id: "bad",
            productId: "",
            label: "",
            currency: "EUR",
            unitPriceMinor: -1,
            observedAt: "not-a-date",
            source: { kind: "manual" },
          },
        ],
      },
    });
    const storage = createStorage({
      [PRICE_MEMORY_STORAGE_KEY]: raw,
    });

    const restored = restorePriceMemory(storage);

    expect(restored.health).toBe("degraded");
    expect(restored.records).toEqual([record]);

    if (restored.health !== "degraded") {
      throw new Error("Expected degraded restore");
    }

    expect(restored.issue.code).toBe("invalid-price-memory-entry");
    expect(storage.values.get(PRICE_MEMORY_STORAGE_KEY)).toBe(raw);
  });

  it("preserves unsupported future data instead of overwriting it", () => {
    const raw = JSON.stringify({
      schemaVersion: 99,
      savedAt: SAVED,
      data: { records: [] },
    });
    const storage = createStorage({
      [PRICE_MEMORY_STORAGE_KEY]: raw,
    });

    const restored = restorePriceMemory(storage);

    expect(restored.health).toBe("degraded");

    if (restored.health !== "degraded") {
      throw new Error("Expected degraded restore");
    }

    expect(restored.issue).toMatchObject({
      code: "unsupported-version",
      schemaVersion: 99,
    });
    expect(storage.values.get(PRICE_MEMORY_STORAGE_KEY)).toBe(raw);
  });

  it("writes a complete advisory snapshot and reports write failure independently", () => {
    const record = memory();

    const healthyStorage = createStorage();
    expect(
      writePriceMemory(healthyStorage, [record], SAVED),
    ).toMatchObject({
      health: "healthy",
      savedAt: SAVED,
    });
    expect(
      healthyStorage.values.get(PRICE_MEMORY_STORAGE_KEY),
    ).not.toBeUndefined();

    const failingStorage = createStorage({}, { failSet: true });
    expect(
      writePriceMemory(failingStorage, [record], SAVED),
    ).toMatchObject({
      health: "degraded",
      issue: {
        code: "write-failed",
        storageKey: PRICE_MEMORY_STORAGE_KEY,
      },
    });
  });

  it("treats missing memory as healthy empty advisory state", () => {
    expect(restorePriceMemory(createStorage())).toEqual({
      health: "healthy",
      records: [],
    });
  });
});
