import { ShoppingAppShell } from "./app/ShoppingAppShell";
import { PwaUpdateNotice } from "./app/PwaUpdateNotice";
import {
  bootstrapBrowserShoppingAppController,
  createBrowserBarcodeReaderPort,
  createBrowserCameraPort,
  createBrowserPriceTagReader,
  createBrowserProductLookup,
  followStorageChangesFromOtherTabs,
} from "./app/composition-root";

const shoppingController = bootstrapBrowserShoppingAppController();
followStorageChangesFromOtherTabs(shoppingController);
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
