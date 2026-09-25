import { ShoppingAppShell } from "./app/ShoppingAppShell";
import { PwaUpdateNotice } from "./app/PwaUpdateNotice";
import {
  bootstrapBrowserShoppingAppController,
  createBrowserProductLookup,
  createBrowserScanner,
} from "./app/composition-root";

const shoppingController = bootstrapBrowserShoppingAppController();
const barcodeScanner = createBrowserScanner();
const productLookup = createBrowserProductLookup();

export function App() {
  return (
    <>
      <ShoppingAppShell
        controller={shoppingController}
        scanner={barcodeScanner}
        productLookup={productLookup}
      />
      <PwaUpdateNotice controller={shoppingController} />
    </>
  );
}
