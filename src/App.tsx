import { ShoppingAppShell } from "./app/ShoppingAppShell";
import { PwaUpdateNotice } from "./app/PwaUpdateNotice";
import { bootstrapBrowserShoppingAppController } from "./app/composition-root";

const shoppingController = bootstrapBrowserShoppingAppController();

export function App() {
  return (
    <>
      <ShoppingAppShell controller={shoppingController} />
      <PwaUpdateNotice controller={shoppingController} />
    </>
  );
}
