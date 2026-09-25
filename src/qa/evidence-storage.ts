import { surfaceStorageScope } from "../infrastructure/runtime/deployment-surface";
import { scopedStorage } from "../infrastructure/storage/scoped-storage";
import type { StorageLike } from "../infrastructure/storage/shopping-storage";

/**
 * Evidence records live in the deployed surface's own storage scope, so a
 * frozen /study/<baseline>/ copy never shares a session with the moving route.
 * Throws exactly as `localStorage` access does when storage is blocked.
 */
export const evidenceStorage = (): StorageLike => {
  const scope = surfaceStorageScope();
  return scope === null ? localStorage : scopedStorage(localStorage, scope);
};
