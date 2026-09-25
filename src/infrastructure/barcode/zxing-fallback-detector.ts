import {
  BarcodeDetector,
  prepareZXingModule,
} from "barcode-detector/ponyfill";
import zxingReaderWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

import {
  RETAIL_BARCODE_FORMATS,
  type FrameBarcodeDetector,
} from "./browser-barcode-scanner";

export const ZXING_READER_WASM_URL = zxingReaderWasmUrl;

export const createZxingFallbackDetector =
  async (): Promise<FrameBarcodeDetector> => {
    await prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? zxingReaderWasmUrl : `${prefix}${path}`,
      },
      fireImmediately: true,
    });

    return new BarcodeDetector({ formats: [...RETAIL_BARCODE_FORMATS] });
  };
