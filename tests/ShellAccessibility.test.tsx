import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import { ShoppingAppShell } from "../src/app/ShoppingAppShell";
import type { ShoppingAppController } from "../src/application/shopping-app-controller";
import { isoTimestamp } from "../src/domain/shopping-trip";
import type { StorageLike } from "../src/infrastructure/storage/shopping-storage";

const boot = (): ShoppingAppController => {
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
  const now = isoTimestamp("2026-09-26T10:00:00.000Z");

  if (!now.ok) {
    throw new Error("Expected a valid timestamp");
  }

  return bootstrapBrowserShoppingAppController({
    storage,
    clock: { now: () => now.value },
    ids: {
      tripId: () => `trip-${(id += 1)}`,
      itemId: () => `item-${(id += 1)}`,
    },
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shopping shell accessibility", () => {
  it("moves focus to each new screen's heading and back to the top of the page", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    render(<ShoppingAppShell controller={boot()} />);

    await user.click(screen.getByRole("button", { name: "€50" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Know what’s left" }),
      );
    });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    await user.click(screen.getByRole("button", { name: "Finish trip" }));
    const finish = screen.getByRole("main", { name: "Ready to finish this trip?" });
    await user.click(within(finish).getByRole("button", { name: "Finish trip" }));
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Your shopping trip is complete" }),
      );
    });

    await user.click(screen.getByRole("button", { name: "View trip history" }));
    const history = await screen.findByRole("heading", { name: "Past shopping trips" });
    await waitFor(() => {
      expect(document.activeElement).toBe(history);
    });
  });

  it("announces a change through one live region that outlives the screens", async () => {
    const user = userEvent.setup();

    render(<ShoppingAppShell controller={boot()} />);

    await user.click(screen.getByRole("button", { name: "€50" }));
    await user.click(screen.getByRole("button", { name: "Add price" }));
    await user.type(screen.getByRole("textbox", { name: "Price" }), "4.79");
    await user.click(screen.getByRole("button", { name: "Add · €4.79" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "€4.79 added. €45.21 left.",
      );
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
