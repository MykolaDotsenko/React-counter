import type { StorageLike } from "./shopping-storage";

export const scopedStorageKey = (scope: string, key: string): string =>
  `${scope}|${key}`;

export const scopedStorage = (
  storage: StorageLike,
  scope: string,
): StorageLike => ({
  getItem: (key) => storage.getItem(scopedStorageKey(scope, key)),
  setItem: (key, value) => {
    storage.setItem(scopedStorageKey(scope, key), value);
  },
  removeItem: (key) => {
    storage.removeItem(scopedStorageKey(scope, key));
  },
});
