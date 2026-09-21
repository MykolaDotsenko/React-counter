import { ShoppingAppShell } from "./app/ShoppingAppShell";
import { bootstrapBrowserShoppingAppController } from "./app/composition-root";
import { CounterExperience } from "./features/counter/CounterExperience.jsx";

const shoppingShellEnabled =
  import.meta.env.VITE_SHOPPING_SHELL === "1";

const shoppingController = shoppingShellEnabled
  ? bootstrapBrowserShoppingAppController()
  : null;

export function App() {
  if (shoppingShellEnabled && shoppingController !== null) {
    return <ShoppingAppShell controller={shoppingController} />;
  }

  return <CounterExperience />;
}
