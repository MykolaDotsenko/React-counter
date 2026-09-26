import { afterEach, describe, expect, it, vi } from "vitest";

const loadRoot = async () => {
  vi.resetModules();
  return await import("../src/app/composition-root");
};

describe("camera release switches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds the camera, barcode reader, price reader and tap-only lookup by default", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    const root = await loadRoot();

    expect(root.createBrowserCameraPort()?.isAvailable()).toBe(true);
    expect(root.createBrowserBarcodeReaderPort()).not.toBeNull();
    expect(root.createBrowserPriceTagReader()).not.toBeNull();
    expect(root.createBrowserProductLookup()?.providerName).toBe("Open Food Facts");
  });

  it("removes barcode reading and lookup but keeps the camera for price tags when the scanner switch is off", async () => {
    vi.stubEnv("VITE_SHOPPING_BARCODE_SCANNER", "0");
    const root = await loadRoot();

    expect(root.createBrowserBarcodeReaderPort()).toBeNull();
    expect(root.createBrowserProductLookup()).toBeNull();
    expect(root.createBrowserPriceTagReader()).not.toBeNull();
    expect(root.createBrowserCameraPort()).not.toBeNull();
  });

  it("keeps scanning but removes the online lookup when only lookup is off", async () => {
    vi.stubEnv("VITE_SHOPPING_PRODUCT_LOOKUP", "0");
    const root = await loadRoot();

    expect(root.createBrowserBarcodeReaderPort()).not.toBeNull();
    expect(root.createBrowserProductLookup()).toBeNull();
  });

  it("removes price tag reading when its switch is off, and the camera when both are off", async () => {
    vi.stubEnv("VITE_SHOPPING_PRICE_OCR", "0");
    const priceOff = await loadRoot();

    expect(priceOff.createBrowserPriceTagReader()).toBeNull();
    expect(priceOff.createBrowserCameraPort()).not.toBeNull();

    vi.stubEnv("VITE_SHOPPING_BARCODE_SCANNER", "0");
    const bothOff = await loadRoot();

    expect(bothOff.createBrowserCameraPort()).toBeNull();
    expect(bothOff.createBrowserBarcodeReaderPort()).toBeNull();
    expect(bothOff.createBrowserPriceTagReader()).toBeNull();
  });
});
