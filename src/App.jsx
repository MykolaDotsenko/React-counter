import { ShoppingAppShell } from "./app/ShoppingAppShell";
import { bootstrapBrowserShoppingAppController } from "./app/composition-root";

const shoppingController = bootstrapBrowserShoppingAppController();

export function App() {
  return <ShoppingAppShell controller={shoppingController} />;
}
