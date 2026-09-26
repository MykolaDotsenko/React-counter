import { ShoppingAppShell } from "./app/ShoppingAppShell";
import { PwaUpdateNotice } from "./app/PwaUpdateNotice";
import {
  bootstrapBrowserShoppingAppController,
  createBrowserBarcodeReaderPort,
  createBrowserCameraPort,
  createBrowserPriceTagReader,
  createBrowserProductLookup,
  followStorageChangesFromOtherTabs,
  keepHistoryFromEviction,
} from "./app/composition-root";

const shoppingController = bootstrapBrowserShoppingAppController();
followStorageChangesFromOtherTabs(shoppingController);
keepHistoryFromEviction(shoppingController);
const camera = createBrowserCameraPort();
const barcodeReader = createBrowserBarcodeReaderPort();
const priceReader = createBrowserPriceTagReader();
const productLookup = createBrowserProductLookup();

export function App() {
  return (
    <>
      <ShoppingAppShell
        controller={shoppingController}
        camera={camera}
        barcodeReader={barcodeReader}
        priceReader={priceReader}
        productLookup={productLookup}
      />
      <PwaUpdateNotice controller={shoppingController} />
    </>
  );
}
