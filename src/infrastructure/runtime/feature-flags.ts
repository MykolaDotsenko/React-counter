export const barcodeScannerEnabled =
  import.meta.env.VITE_SHOPPING_BARCODE_SCANNER !== "0";

export const productLookupEnabled =
  barcodeScannerEnabled &&
  import.meta.env.VITE_SHOPPING_PRODUCT_LOOKUP !== "0";
