import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import type {
  BarcodeReading,
  BarcodeScannerPort,
  ProductLookupPort,
  ProductLookupResult,
  ScannerFailure,
} from "../src/application/barcode-ports";
import type { ShoppingAppController } from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import type { Gtin } from "../src/domain/product-code";
import { isoTimestamp, type IsoTimestamp } from "../src/domain/shopping-trip";
import BarcodeScanSurface from "../src/features/shopping/BarcodeScanSurface";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";

const must = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => must(isoTimestamp(value));
const MILK = "06414893386303" as Gtin;

const memoryStorage = (): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const boot = (): ShoppingAppController => {
  let id = 0;
  return bootstrapBrowserShoppingAppController({
    storage: memoryStorage(),
    storageScope: null,
    clock: { now: () => time("2026-09-21T09:00:00.000Z") },
    ids: {
      tripId: () => `trip-${(id += 1)}`,
      itemId: () => `item-${(id += 1)}`,
    },
  });
};

const withRememberedMilk = (): ShoppingAppController => {
  const controller = boot();
  controller.startTrip({ budgetMinor: money(5_000) });
  controller.addManualItem({ unitPriceMinor: money(129), quantity: 1, label: "Milk 1L", barcode: MILK });
  controller.completeTrip();
  controller.dismissCompletedSummary();
  controller.startTrip({ budgetMinor: money(5_000) });
  return controller;
};

const fakeScanner = ({
  readings = [],
  failure,
  torch = false,
  detectError = false,
}: {
  readonly readings?: readonly BarcodeReading[];
  readonly failure?: ScannerFailure;
  readonly torch?: boolean;
  readonly detectError?: boolean;
}) => {
  const stop = vi.fn();
  const setTorch = vi.fn(async () => true);
  let torchOn = false;
  const port: BarcodeScannerPort = {
    isAvailable: () => true,
    prepare: vi.fn(),
    start: vi.fn(async () =>
      failure === undefined
        ? {
            ok: true as const,
            session: {
              engine: "native" as const,
              torch: torch
                ? {
                    isOn: () => torchOn,
                    set: async (on: boolean) => {
                      torchOn = on;
                      return await setTorch();
                    },
                  }
                : null,
              stop,
              detect: async () => {
                if (detectError) {
                  throw new Error("engine crashed");
                }

                return readings;
              },
            },
          }
        : { ok: false as const, failure },
    ),
  };
  return { port, stop, setTorch };
};

const lookupReturning = (result: ProductLookupResult) => {
  const lookup = vi.fn(async () => result);
  const port: ProductLookupPort = { providerName: "Open Food Facts", lookup };
  return { port, lookup };
};

const renderSurface = ({
  controller = boot(),
  scanner = fakeScanner({}).port,
  productLookup = null as ProductLookupPort | null,
} = {}) => {
  const onCancel = vi.fn();
  const onEnterPrice = vi.fn();
  const onUseRemembered = vi.fn(() => true);
  const view = render(
    <BarcodeScanSurface
      controller={controller}
      scanner={scanner}
      productLookup={productLookup}
      onCancel={onCancel}
      onEnterPrice={onEnterPrice}
      onUseRemembered={onUseRemembered}
      locale="en-FI"
    />,
  );
  return { ...view, onCancel, onEnterPrice, onUseRemembered };
};

describe("BarcodeScanSurface", () => {
  it("offers the remembered product and price after a stable read, then stops the camera", async () => {
    const user = userEvent.setup();
    const scanner = fakeScanner({ readings: [{ rawValue: "6414893386303", symbology: "ean-13" }] });
    const { onEnterPrice, onUseRemembered } = renderSurface({
      controller: withRememberedMilk(),
      scanner: scanner.port,
    });

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Find the product" }),
    );

    const heading = await screen.findByRole("heading", { name: "Milk 1L" });

    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(scanner.stop).toHaveBeenCalled();
    expect(screen.getByText(/Last time €1\.29\. Prices change/)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Enter current price" }));
    expect(onEnterPrice).toHaveBeenCalledWith({ label: "Milk 1L", barcode: MILK });

    await user.click(screen.getByRole("button", { name: "Use €1.29 again" }));
    expect(onUseRemembered).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Milk 1L", unitPriceMinor: 129 }),
      MILK,
    );
  });

  it("looks a new product up online only when asked, and lets the shopper edit the suggestion", async () => {
    const user = userEvent.setup();
    const lookup = lookupReturning({ status: "found", product: { name: "Maito 1 l" } });
    const { onEnterPrice } = renderSurface({
      scanner: fakeScanner({ readings: [{ rawValue: "6414893386303", symbology: null }] }).port,
      productLookup: lookup.port,
    });

    await screen.findByRole("heading", { name: "New product" });
    expect(screen.getByText("Barcode 6414893386303")).not.toBeNull();
    expect(screen.getByText(/Sends only this barcode number to Open Food Facts/)).not.toBeNull();
    expect(lookup.lookup).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Find name online" }));

    const name = screen.getByLabelText("Name for next time (optional)");
    await waitFor(() => {
      expect((name as HTMLInputElement).value).toBe("Maito 1 l");
    });
    expect(lookup.lookup).toHaveBeenCalledWith(MILK, expect.any(AbortSignal));
    expect(screen.getByText(/Suggested by Open Food Facts/)).not.toBeNull();

    await user.clear(name);
    await user.type(name, "  Kevytmaito ");
    await user.click(screen.getByRole("button", { name: "Continue to price" }));

    expect(onEnterPrice).toHaveBeenCalledWith({ label: "Kevytmaito", barcode: MILK });
  });

  it("explains a missing or failed lookup and still continues without a name", async () => {
    const user = userEvent.setup();
    const notFound = lookupReturning({ status: "not-found" });
    const first = renderSurface({
      scanner: fakeScanner({ readings: [{ rawValue: "6414893386303", symbology: null }] }).port,
      productLookup: notFound.port,
    });

    await screen.findByRole("heading", { name: "New product" });
    await user.click(screen.getByRole("button", { name: "Find name online" }));
    expect(await screen.findByText(/doesn't know this barcode/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Continue to price" }));
    expect(first.onEnterPrice).toHaveBeenCalledWith({ barcode: MILK });
    first.unmount();

    const offline = lookupReturning({ status: "failed", reason: "offline" });
    renderSurface({
      scanner: fakeScanner({ readings: [{ rawValue: "6414893386303", symbology: null }] }).port,
      productLookup: offline.port,
    });

    await screen.findByRole("heading", { name: "New product" });
    await user.click(screen.getByRole("button", { name: "Find name online" }));
    expect(await screen.findByText(/You're offline/)).not.toBeNull();
  });

  it("hides online lookup entirely when it is switched off", async () => {
    renderSurface({
      scanner: fakeScanner({ readings: [{ rawValue: "6414893386303", symbology: null }] }).port,
      productLookup: null,
    });

    await screen.findByRole("heading", { name: "New product" });
    expect(screen.queryByRole("button", { name: "Find name online" })).toBeNull();
    expect(screen.queryByText(/Open Food Facts/)).toBeNull();
  });

  it("sends store label codes straight to manual price entry", async () => {
    const user = userEvent.setup();
    const { onEnterPrice } = renderSurface({
      scanner: fakeScanner({ readings: [{ rawValue: "2012345678903", symbology: "ean-13" }] }).port,
    });

    await screen.findByRole("heading", { name: "Store label code" });
    await user.click(screen.getByRole("button", { name: "Enter price" }));
    expect(onEnterPrice).toHaveBeenCalledWith({});
  });

  it("recovers from a blocked camera by typing the barcode, with check-digit feedback", async () => {
    const user = userEvent.setup();
    const scanner = fakeScanner({ failure: "permission-denied" });
    const { onEnterPrice } = renderSurface({
      controller: withRememberedMilk(),
      scanner: scanner.port,
    });

    await screen.findByRole("heading", { name: "Camera unavailable" });
    expect(screen.getByText(/Camera access is blocked/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Type barcode" }));
    const input = screen.getByLabelText("Barcode digits");
    expect(document.activeElement).toBe(input);

    await user.type(input, "6414893386304{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/don't form a valid barcode/);

    await user.clear(input);
    await user.type(input, "641 4893 386303");
    await user.click(screen.getByRole("button", { name: "Look up barcode" }));

    expect(await screen.findByRole("heading", { name: "Milk 1L" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Enter current price" }));
    expect(onEnterPrice).toHaveBeenCalledWith({ label: "Milk 1L", barcode: MILK });
  });

  it("does not offer a retry that cannot help", async () => {
    renderSurface({ scanner: fakeScanner({ failure: "no-camera" }).port });

    await screen.findByText(/No camera was found/);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Enter price without scanning" })).not.toBeNull();
  });

  it("reports a barcode engine that keeps failing", async () => {
    renderSurface({ scanner: fakeScanner({ detectError: true }).port });

    expect(
      await screen.findByText(/barcode reader couldn't load/, {}, { timeout: 2_000 }),
    ).not.toBeNull();
  });

  it("toggles the light, pauses in the background and cancels with Escape", async () => {
    const user = userEvent.setup();
    const scanner = fakeScanner({ torch: true });
    const { onCancel, unmount } = renderSurface({ scanner: scanner.port });
    const light = await screen.findByRole("button", { name: "Light" });

    expect(light.getAttribute("aria-pressed")).toBe("false");
    await user.click(light);
    await waitFor(() => {
      expect(light.getAttribute("aria-pressed")).toBe("true");
    });

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByRole("button", { name: "Resume camera" })).not.toBeNull();
    expect(scanner.stop).toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await user.click(screen.getByRole("button", { name: "Resume camera" }));
    expect(await screen.findByRole("button", { name: "Light" })).not.toBeNull();
    expect(scanner.port.start).toHaveBeenCalledTimes(2);

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();

    const stopsBefore = scanner.stop.mock.calls.length;
    unmount();
    expect(scanner.stop.mock.calls.length).toBeGreaterThan(stopsBefore);
  });
});
