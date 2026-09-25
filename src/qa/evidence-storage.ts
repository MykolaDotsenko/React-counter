import { surfaceStorageScope } from "../infrastructure/runtime/deployment-surface";
import { scopedStorage } from "../infrastructure/storage/scoped-storage";
import type { StorageLike } from "../infrastructure/storage/shopping-storage";

export const evidenceStorage = (): StorageLike => {
  const scope = surfaceStorageScope();
  return scope === null ? localStorage : scopedStorage(localStorage, scope);
};

export const evidenceSessionStorage = (): StorageLike => {
  const scope = surfaceStorageScope();
  return scope === null ? sessionStorage : scopedStorage(sessionStorage, scope);
};
