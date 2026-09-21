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
import type { StorageLike } from "../infrastructure/storage/shopping-storage";

export interface BrowserShoppingAppDependencies {
  readonly storage?: StorageLike | null;
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
  const storage =
    dependencies.storage === undefined
      ? resolveBrowserStorage()
      : dependencies.storage;

  return createShoppingAppController({
    persistence: createActiveTripPersistencePort(storage),
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
