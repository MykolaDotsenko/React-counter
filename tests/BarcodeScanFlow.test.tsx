import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import { ShoppingAppShell } from "../src/app/ShoppingAppShell";
import type {
  BarcodeReading,
  BarcodeScannerPort,
} from "../src/application/barcode-ports";
import type { ShoppingAppController } from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import { isoTimestamp, type IsoTimestamp } from "../src/domain/shopping-trip";
import { BARCODE_LINK_STORAGE_KEY } from "../src/infrastructure/storage/barcode-link-storage";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";

const must = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => must(isoTimestamp(value));

const setup = () => {
  const values = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  let id = 0;
  const controller: ShoppingAppController = bootstrapBrowserShoppingAppController({
    storage,
    storageScope: null,
    clock: { now: () => time("2026-09-21T09:00:00.000Z") },
    ids: {
      tripId: () => `trip-${(id += 1)}`,
      itemId: () => `item-${(id += 1)}`,
    },
  });
  const current: { readings: readonly BarcodeReading[] } = { readings: [] };
  const scanner: BarcodeScannerPort = {
    isAvailable: () => true,
    prepare: vi.fn(),
    start: vi.fn(async () => ({
      ok: true as const,
      session: {
        engine: "native" as const,
        torch: null,
        stop: vi.fn(),
        detect: async () => current.readings,
      },
    })),
  };
  return { values, controller, scanner, current };
};

describe("scanning a product while shopping", () => {
  it("names a new product once, then recognises it on the next scan", async () => {
    const user = userEvent.setup();
    const { values, controller, scanner, current } = setup();
    controller.startTrip({ budgetMinor: money(5_000) });

    render(<ShoppingAppShell controller={controller} scanner={scanner} />);

    expect(scanner.prepare).toHaveBeenCalled();

    current.readings = [{ rawValue: "6414893386303", symbology: "ean-13" }];
    await user.click(screen.getByRole("button", { name: "Scan barcode" }));
    await screen.findByRole("heading", { name: "New product" });

    await user.type(screen.getByLabelText("Name for next time (optional)"), "Milk 1L");
    await user.click(screen.getByRole("button", { name: "Continue to price" }));

    const entry = await screen.findByRole("main", { name: "What does this item cost?" });
    expect(within(entry).getByText("Milk 1L")).not.toBeNull();

    await user.type(within(entry).getByLabelText("Price"), "1.29");
    await user.click(within(entry).getByRole("button", { name: /^Add/ }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Scan barcode" }),
      );
    });
    expect(controller.getSnapshot().activeTrip?.items).toMatchObject([
      { label: "Milk 1L", unitPriceMinor: 129 },
    ]);
    expect(values.get(BARCODE_LINK_STORAGE_KEY)).toContain("06414893386303");

    await user.click(screen.getByRole("button", { name: "Scan barcode" }));
    expect(await screen.findByRole("heading", { name: "Milk 1L" })).not.toBeNull();
    expect(screen.getByText(/No remembered price yet/)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Scan barcode" }),
      );
    });
  });

  it("shows no scan entry point without a usable scanner", () => {
    const { controller } = setup();
    controller.startTrip({ budgetMinor: money(5_000) });
    const unavailable: BarcodeScannerPort = {
      isAvailable: () => false,
      prepare: vi.fn(),
      start: vi.fn(),
    };

    const { unmount } = render(
      <ShoppingAppShell controller={controller} scanner={unavailable} />,
    );

    expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
    unmount();

    render(<ShoppingAppShell controller={controller} scanner={null} />);
    expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
  });
});
