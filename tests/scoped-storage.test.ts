import { describe, expect, it } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import { isoTimestamp, type IsoTimestamp } from "../src/domain/shopping-trip";
import {
  surfaceScopeFor,
  surfaceStorageScope,
} from "../src/infrastructure/runtime/deployment-surface";
import {
  scopedStorage,
  scopedStorageKey,
} from "../src/infrastructure/storage/scoped-storage";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";
import { ACTIVE_TRIP_STORAGE_KEY } from "../src/infrastructure/storage/shopping-storage-schema";

const must = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const NOW: IsoTimestamp = must(isoTimestamp("2026-09-22T10:00:00.000Z"));

const memory = () => {
  const values = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  return { values, storage };
};

describe("surface storage scopes", () => {
  it("derives a distinct scope for every deployed copy of a guarded build", () => {
    const origin = "https://example.github.io";

    expect(
      surfaceScopeFor("./", `${origin}/shopping-budget-companion/beta/`),
    ).toBe("surface:/shopping-budget-companion/beta/");
    expect(
      surfaceScopeFor(
        "./",
        `${origin}/shopping-budget-companion/study/baseline-r11/beta/index.html`,
      ),
    ).toBe("surface:/shopping-budget-companion/study/baseline-r11/beta/");
    expect(surfaceScopeFor("./", `${origin}/qa/?reset=1#top`)).toBe(
      "surface:/qa/",
    );
  });

  it("leaves the public app on its original keys", () => {
    expect(surfaceStorageScope()).toBeNull();
  });

  it("prefixes every read, write and removal", () => {
    const { values, storage } = memory();
    const scoped = scopedStorage(storage, "surface:/beta/");

    scoped.setItem("budget-cart:history", "a");
    storage.setItem("budget-cart:history", "public");

    expect(scoped.getItem("budget-cart:history")).toBe("a");
    expect(values.get(scopedStorageKey("surface:/beta/", "budget-cart:history"))).toBe("a");

    scoped.removeItem("budget-cart:history");

    expect(scoped.getItem("budget-cart:history")).toBeNull();
    expect(storage.getItem("budget-cart:history")).toBe("public");
  });

  it("keeps two surfaces' shopping trips apart on one origin", () => {
    const { values, storage } = memory();
    const clock = { now: () => NOW };
    const ids = { tripId: () => "trip", itemId: () => "item" };
    const beta = bootstrapBrowserShoppingAppController({
      storage,
      storageScope: "surface:/beta/",
      clock,
      ids,
    });
    const publicApp = bootstrapBrowserShoppingAppController({
      storage,
      storageScope: null,
      clock,
      ids,
    });

    beta.startTrip({ budgetMinor: money(2_000) });

    expect(values.has(scopedStorageKey("surface:/beta/", ACTIVE_TRIP_STORAGE_KEY))).toBe(true);
    expect(values.has(ACTIVE_TRIP_STORAGE_KEY)).toBe(false);
    expect(publicApp.getSnapshot().activeTrip).toBeNull();

    const reopenedBeta = bootstrapBrowserShoppingAppController({
      storage,
      storageScope: "surface:/beta/",
      clock,
      ids,
    });

    expect(reopenedBeta.getSnapshot().activeTrip?.budgetMinor).toBe(2_000);
  });
});
