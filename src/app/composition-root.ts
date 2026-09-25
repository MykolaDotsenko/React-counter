import {
  createShoppingAppController,
  type Clock,
  type IdGenerator,
  type ShoppingAppController,
} from "../application/shopping-app-controller";
import {
  cryptoIdGenerator,
  systemClock,
} from "../infrastructure/runtime/browser-boundaries";
import { createActiveTripPersistencePort } from "../infrastructure/storage/active-trip-persistence-port";
import { surfaceStorageScope } from "../infrastructure/runtime/deployment-surface";
import { createPriceMemoryPersistencePort } from "../infrastructure/storage/price-memory-persistence-port";
import { scopedStorage } from "../infrastructure/storage/scoped-storage";
import type { StorageLike } from "../infrastructure/storage/shopping-storage";

export interface BrowserShoppingAppDependencies {
  readonly storage?: StorageLike | null;
  readonly storageScope?: string | null;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}

const resolveBrowserStorage = (): StorageLike | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const createBrowserShoppingAppController = (
  dependencies: BrowserShoppingAppDependencies = {},
): ShoppingAppController => {
  const baseStorage =
    dependencies.storage === undefined
      ? resolveBrowserStorage()
      : dependencies.storage;
  const scope =
    dependencies.storageScope === undefined
      ? surfaceStorageScope()
      : dependencies.storageScope;
  const storage =
    baseStorage === null || scope === null
      ? baseStorage
      : scopedStorage(baseStorage, scope);

  return createShoppingAppController({
    persistence: createActiveTripPersistencePort(storage),
    priceMemoryPersistence: createPriceMemoryPersistencePort(storage),
    clock: dependencies.clock ?? systemClock,
    ids: dependencies.ids ?? cryptoIdGenerator,
  });
};

export const bootstrapBrowserShoppingAppController = (
  dependencies: BrowserShoppingAppDependencies = {},
): ShoppingAppController => {
  const controller = createBrowserShoppingAppController(dependencies);
  controller.bootstrap();
  return controller;
};
