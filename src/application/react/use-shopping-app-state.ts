import { useSyncExternalStore } from "react";

import type {
  ShoppingAppController,
  ShoppingAppState,
} from "../shopping-app-controller";

export const useShoppingAppState = (
  controller: ShoppingAppController,
): ShoppingAppState =>
  useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
