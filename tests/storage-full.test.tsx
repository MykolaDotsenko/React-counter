import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import { ShoppingAppShell } from "../src/app/ShoppingAppShell";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import { isoTimestamp } from "../src/domain/shopping-trip";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
} from "../src/infrastructure/storage/shopping-storage-schema";

const money = (value: number): MinorUnits => {
  const result = mvpMinorUnits(value);

  if (!result.ok) {
    throw new Error("Expected valid money");
  }

  return result.value;
};

const limitedStorage = () => {
  const values = new Map<string, string>();
  const limit = { current: Number.POSITIVE_INFINITY };
  const fullKeys = new Set<string>();
  const used = (): number =>
    [...values].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      const previous = values.get(key);
      const next =
        used() - (previous === undefined ? -key.length : previous.length) + value.length;

      if (fullKeys.has(key) || next > limit.current) {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      }

      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };

  return { storage, limit, fullKeys, used };
};

const bootWithHistory = (trips: number) => {
  const { storage, limit, fullKeys, used } = limitedStorage();
  let id = 0;
  let minute = 0;
  const controller = bootstrapBrowserShoppingAppController({
    storage,
    clock: {
      now: () => {
        minute += 1;
        const at = isoTimestamp(new Date(Date.UTC(2026, 0, 1, 8, minute)).toISOString());

        if (!at.ok) {
          throw new Error("Expected a valid timestamp");
        }

        return at.value;
      },
    },
    ids: {
      tripId: () => `trip-${(id += 1)}`,
      itemId: () => `item-${(id += 1)}`,
    },
  });

  for (let trip = 0; trip < trips; trip += 1) {
    controller.startTrip({ budgetMinor: money(5_000) });
    controller.addManualItem({ unitPriceMinor: money(250), quantity: 1, label: "Oat milk" });
    controller.completeTrip();
    controller.dismissCompletedSummary();
  }

  return { controller, limit, fullKeys, used };
};

describe("when browser storage is full", () => {
  it("makes room by removing the oldest trips and saves the open trip again", async () => {
    const user = userEvent.setup();
    const { controller, limit, used } = bootWithHistory(12);
    limit.current = used() + 200;
    controller.startTrip({ budgetMinor: money(5_000) });

    render(<ShoppingAppShell controller={controller} />);

    const notice = screen.getByRole("complementary", { name: "Storage for this app is full" });
    expect(notice.textContent).toContain("This trip can’t be saved until there is room.");

    await user.click(within(notice).getByRole("button", { name: "Make room…" }));
    expect(notice.textContent).toContain(
      "Your 10 oldest trips will be removed from this device; remembered prices stay.",
    );
    await user.click(within(notice).getByRole("button", { name: "Remove 10 oldest trips" }));

    expect(screen.getByText("Saved on this device")).not.toBeNull();
    expect(controller.getSnapshot()).toMatchObject({
      persistence: { status: "healthy" },
    });
    expect(controller.getSnapshot().completedTrips.map((trip) => trip.id)).toEqual([
      "trip-21",
      "trip-23",
    ]);
  });

  it("leaves every trip in place when the shopper keeps them", async () => {
    const user = userEvent.setup();
    const { controller, limit, used } = bootWithHistory(3);
    limit.current = used() + 200;
    controller.startTrip({ budgetMinor: money(5_000) });

    render(<ShoppingAppShell controller={controller} />);

    const notice = screen.getByRole("complementary", { name: "Storage for this app is full" });
    await user.click(within(notice).getByRole("button", { name: "Make room…" }));
    await user.click(within(notice).getByRole("button", { name: "Keep all trips" }));

    expect(within(notice).queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(controller.getSnapshot().completedTrips).toHaveLength(3);
  });

  it("says when removing trips still did not make enough room", async () => {
    const user = userEvent.setup();
    const { controller, fullKeys } = bootWithHistory(2);
    fullKeys.add(ACTIVE_TRIP_STORAGE_KEY);
    controller.startTrip({ budgetMinor: money(5_000) });

    render(<ShoppingAppShell controller={controller} />);

    const notice = screen.getByRole("complementary", { name: "Storage for this app is full" });
    await user.click(within(notice).getByRole("button", { name: "Make room…" }));
    await user.click(within(notice).getByRole("button", { name: "Remove 2 oldest trips" }));

    expect(within(notice).getByRole("status").textContent).toBe(
      "There still isn’t enough room. You can remove more trips.",
    );
    expect(controller.getSnapshot().completedTrips).toHaveLength(0);
    expect(controller.getSnapshot().persistence.status).toBe("degraded");
  });

  it("changes nothing when the trips cannot be removed", async () => {
    const user = userEvent.setup();
    const { controller, fullKeys } = bootWithHistory(2);
    fullKeys.add(ACTIVE_TRIP_STORAGE_KEY);
    controller.startTrip({ budgetMinor: money(5_000) });
    fullKeys.add(HISTORY_STORAGE_KEY);

    render(<ShoppingAppShell controller={controller} />);

    const notice = screen.getByRole("complementary", { name: "Storage for this app is full" });
    await user.click(within(notice).getByRole("button", { name: "Make room…" }));
    await user.click(within(notice).getByRole("button", { name: "Remove 2 oldest trips" }));

    expect(within(notice).getByRole("status").textContent).toBe(
      "Trips could not be removed, so nothing was changed.",
    );
    expect(controller.getSnapshot().completedTrips).toHaveLength(2);
  });

  it("explains how to free space when there are no trips to remove", () => {
    const { controller, fullKeys } = bootWithHistory(0);
    fullKeys.add(ACTIVE_TRIP_STORAGE_KEY);
    controller.startTrip({ budgetMinor: money(5_000) });

    render(<ShoppingAppShell controller={controller} />);

    const notice = screen.getByRole("complementary", { name: "Storage for this app is full" });
    expect(notice.textContent).toContain(
      "Free up storage this browser keeps for this site, then retry.",
    );
    expect(within(notice).queryByRole("button", { name: "Make room…" })).toBeNull();
    expect(within(notice).getByRole("button", { name: "Retry" })).not.toBeNull();
  });

  it("explains why finishing failed and keeps the trip open", async () => {
    const user = userEvent.setup();
    const { controller, limit, used } = bootWithHistory(1);
    controller.startTrip({ budgetMinor: money(5_000) });
    controller.addManualItem({ unitPriceMinor: money(250), quantity: 1 });
    limit.current = used();

    render(<ShoppingAppShell controller={controller} />);

    await user.click(screen.getByRole("button", { name: "Finish trip" }));
    const finish = await screen.findByRole("main", { name: "Ready to finish this trip?" });
    await user.click(within(finish).getByRole("button", { name: "Finish trip" }));

    expect(within(finish).getByRole("alert").textContent).toBe(
      "Storage for this app is full, so the trip was not saved to History. It is still open: choose Keep shopping to make room, then finish again.",
    );
    expect(controller.getSnapshot().lifecycle).toBe("active");
  });
});
