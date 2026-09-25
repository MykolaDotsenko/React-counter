import { afterEach, describe, expect, it, vi } from "vitest";

const loadRoot = async () => {
  vi.resetModules();
  return await import("../src/app/composition-root");
};

describe("barcode release switches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds a scanner and a tap-only lookup by default where the camera is usable", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: true,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    const root = await loadRoot();

    expect(root.createBrowserScanner()?.isAvailable()).toBe(true);
    expect(root.createBrowserProductLookup()?.providerName).toBe("Open Food Facts");
  });

  it("removes scanning and lookup when the scanner switch is off", async () => {
    vi.stubEnv("VITE_SHOPPING_BARCODE_SCANNER", "0");
    const root = await loadRoot();

    expect(root.createBrowserScanner()).toBeNull();
    expect(root.createBrowserProductLookup()).toBeNull();
  });

  it("keeps scanning but removes the online lookup when only lookup is off", async () => {
    vi.stubEnv("VITE_SHOPPING_PRODUCT_LOOKUP", "0");
    const root = await loadRoot();

    expect(root.createBrowserScanner()).not.toBeNull();
    expect(root.createBrowserProductLookup()).toBeNull();
  });
});
