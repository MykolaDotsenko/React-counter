import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { bootstrapBrowserShoppingAppController } from "../src/app/composition-root";
import { ShoppingAppShell } from "../src/app/ShoppingAppShell";
import type { ShoppingAppController } from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type MinorUnits } from "../src/domain/money";
import {
  createActiveTrip,
  isoTimestamp,
  reduceTrip,
  type ActiveTrip,
  type CompletedTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import { FinishTripSurface } from "../src/features/shopping/FinishTripSurface";
import { HistoryIntegrityNotice } from "../src/features/shopping/HistoryIntegrityNotice";
import { PersistenceHealthNotice } from "../src/features/shopping/PersistenceHealthNotice";
import { RecoveryScreen } from "../src/features/shopping/RecoveryScreen";
import {
  SET_ASIDE_STORAGE_KEY_PREFIX,
  encodeHistorySnapshot,
  type StorageLike,
} from "../src/infrastructure/storage/shopping-storage";
import {
  ACTIVE_TRIP_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
} from "../src/infrastructure/storage/shopping-storage-schema";

const START = "2026-09-21T09:00:00.000Z";
const NOW = "2026-09-22T10:00:00.000Z";

const must = <T,>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const money = (value: number): MinorUnits => must(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => must(isoTimestamp(value));

const completedTrip = (id: string): CompletedTrip => {
  const trip: ActiveTrip = must(
    createActiveTrip({ id, budgetMinor: money(3_000), startedAt: START }),
  );
  const completed = must(
    reduceTrip(trip, { type: "complete-trip", completedAt: time(START) }),
  );

  if (completed.status !== "completed") {
    throw new Error("Expected completed trip");
  }

  return completed;
};

const partlyDamagedHistory = (): string => {
  const encoded = encodeHistorySnapshot([completedTrip("trip-kept")], START);

  if (!encoded.ok) {
    throw new Error("Expected history");
  }

  const envelope = JSON.parse(encoded.raw) as {
    data: { trips: Record<string, unknown>[] };
  };
  envelope.data.trips.push({ ...envelope.data.trips[0], id: "bad", extra: 1 });
  return JSON.stringify(envelope);
};

const memoryStorage = (entries: Record<string, string>) => {
  const values = new Map(Object.entries(entries));
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  return { values, storage };
};

const boot = (storage: StorageLike | null): ShoppingAppController => {
  let id = 0;
  return bootstrapBrowserShoppingAppController({
    storage,
    clock: { now: () => time(NOW) },
    ids: {
      tripId: () => `trip-${(id += 1)}`,
      itemId: () => `item-${(id += 1)}`,
    },
  });
};

describe("RecoveryScreen exits", () => {
  it("offers continue and set-aside for an unreadable saved trip", async () => {
    const user = userEvent.setup();
    const { values, storage } = memoryStorage({
      [ACTIVE_TRIP_STORAGE_KEY]: "{broken",
    });
    const controller = boot(storage);

    render(<RecoveryScreen controller={controller} />);

    await user.click(screen.getByText("Other ways to continue"));
    expect(
      screen.getByRole("button", { name: "Continue without saving" }),
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Set aside and start fresh" }),
    );

    expect(controller.getSnapshot().lifecycle).toBe("idle");
    expect(values.has(ACTIVE_TRIP_STORAGE_KEY)).toBe(false);
    expect(
      [...values.keys()].some((key) =>
        key.startsWith(SET_ASIDE_STORAGE_KEY_PREFIX),
      ),
    ).toBe(true);
  });

  it("offers only continue without saving when storage is unavailable", async () => {
    const user = userEvent.setup();
    const controller = boot(null);

    render(<RecoveryScreen controller={controller} />);

    await user.click(screen.getByText("Other ways to continue"));

    expect(
      screen.queryByRole("button", { name: "Set aside and start fresh" }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Continue without saving" }),
    );

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "idle",
      persistence: { issue: { code: "session-only" } },
    });
  });

  it("moves focus to the next screen's heading after leaving recovery", async () => {
    const user = userEvent.setup();
    const controller = boot(null);

    render(<ShoppingAppShell controller={controller} />);

    await user.click(screen.getByText("Other ways to continue"));
    await user.click(
      screen.getByRole("button", { name: "Continue without saving" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "How much can you spend today?" }),
    );
  });
});

describe("HistoryIntegrityNotice", () => {
  it("sets damaged history aside only after a second, explicit confirmation", async () => {
    const user = userEvent.setup();
    const damaged = partlyDamagedHistory();
    const { values, storage } = memoryStorage({
      [HISTORY_STORAGE_KEY]: damaged,
    });
    const controller = boot(storage);

    render(<HistoryIntegrityNotice controller={controller} />);

    expect(
      screen.getByText("Some trip history could not be restored"),
    ).not.toBeNull();
    expect(screen.getByText(/1 completed trip is still available/)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Set aside…" }));

    expect(values.get(HISTORY_STORAGE_KEY)).toBe(damaged);
    expect(
      screen.getByText(/1 readable trip will be kept/),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Keep as is" }));

    expect(screen.queryByRole("button", { name: "Set aside now" })).toBeNull();

    // A double tap on the arming control never confirms unread.
    await user.dblClick(screen.getByRole("button", { name: "Set aside…" }));

    expect(screen.queryByRole("button", { name: "Set aside now" })).toBeNull();
    expect(values.get(HISTORY_STORAGE_KEY)).toBe(damaged);

    await user.click(screen.getByRole("button", { name: "Set aside…" }));
    await user.click(screen.getByRole("button", { name: "Set aside now" }));

    expect(controller.getSnapshot().historyIntegrity.status).toBe("healthy");
    expect(
      screen.queryByText("Some trip history could not be restored"),
    ).toBeNull();
    expect(values.get(HISTORY_STORAGE_KEY)).not.toBe(damaged);

    // The outcome is announced and focus lands on it instead of the body.
    const resolved = screen.getByRole("status");
    expect(resolved.textContent).toMatch(/set aside as a backup copy/);
    expect(document.activeElement).toBe(resolved);
  });

  it("exposes the confirmation as a disclosure without moving focus", async () => {
    const user = userEvent.setup();
    const { storage } = memoryStorage({
      [HISTORY_STORAGE_KEY]: partlyDamagedHistory(),
    });
    const controller = boot(storage);

    render(<HistoryIntegrityNotice controller={controller} />);

    const toggle = screen.getByRole("button", { name: "Set aside…" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.hasAttribute("aria-controls")).toBe(false);

    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).not.toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("waits for the summary to close before offering repair", () => {
    const { storage, values } = memoryStorage({});
    const controller = boot(storage);
    controller.startTrip({ budgetMinor: money(1_000) });
    controller.completeTrip();
    values.set(HISTORY_STORAGE_KEY, "{broken later");
    controller.setActualCheckout(money(900));

    render(<HistoryIntegrityNotice controller={controller} />);

    expect(screen.getByText(/after closing this summary/)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Set aside…" })).toBeNull();
  });

  it("renders nothing while history is readable", () => {
    const controller = boot(memoryStorage({}).storage);
    const { container } = render(
      <HistoryIntegrityNotice controller={controller} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("offers a retry instead of a set-aside when history could not be read", async () => {
    const user = userEvent.setup();
    let fail = true;
    const values = new Map([[HISTORY_STORAGE_KEY, partlyDamagedHistory()]]);
    const controller = boot({
      getItem: (key) => {
        if (key === HISTORY_STORAGE_KEY && fail) {
          throw new Error("read failed");
        }

        return values.get(key) ?? null;
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    });

    render(<HistoryIntegrityNotice controller={controller} />);

    expect(screen.queryByRole("button", { name: "Set aside…" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      screen.getByText("History still can't be read. Nothing was changed."),
    ).not.toBeNull();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(controller.getSnapshot().historyIntegrity).toMatchObject({
      status: "degraded",
      issue: { code: "invalid-history-entry" },
    });
    expect(screen.getByRole("button", { name: "Set aside…" })).not.toBeNull();
  });
});

describe("FinishTripSurface failure copy", () => {
  const trip = must(
    createActiveTrip({ id: "t", budgetMinor: money(1_000), startedAt: START }),
  );

  it.each([
    ["history-unreadable", /needs attention before this trip can be added/],
    ["not-saved", /Trip history could not be saved/],
  ] as const)("explains %s accurately", async (failure, message) => {
    const user = userEvent.setup();

    render(
      <FinishTripSurface
        trip={trip}
        onCancel={vi.fn()}
        onConfirm={() => failure}
        historyNotice={<p>history notice</p>}
        historyNeedsAttention
      />,
    );

    await user.click(screen.getByRole("button", { name: "Finish trip" }));

    expect(screen.getByRole("alert").textContent).toMatch(message);
  });

  it("drops the history failure once the history notice is resolved", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FinishTripSurface
        trip={trip}
        onCancel={vi.fn()}
        onConfirm={() => "history-unreadable"}
        historyNotice={<p>history notice</p>}
        historyNeedsAttention
      />,
    );

    await user.click(screen.getByRole("button", { name: "Finish trip" }));
    expect(screen.queryByRole("alert")).not.toBeNull();

    rerender(
      <FinishTripSurface
        trip={trip}
        onCancel={vi.fn()}
        onConfirm={() => "history-unreadable"}
        historyNotice={<p>history notice</p>}
        historyNeedsAttention={false}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("session-only mode keeps a single honest notice", () => {
  it("does not repeat a history warning the shopper cannot act on", () => {
    const controller = boot(null);
    controller.continueWithoutSaving();

    const { container } = render(
      <HistoryIntegrityNotice controller={controller} />,
    );

    expect(controller.getSnapshot().historyIntegrity.status).toBe("degraded");
    expect(container.innerHTML).toBe("");
  });
});

describe("PersistenceHealthNotice session-only copy", () => {
  it("explains session-only mode without a pointless retry", () => {
    const controller = boot(null);
    controller.continueWithoutSaving();

    render(
      <PersistenceHealthNotice
        controller={controller}
        health={controller.getSnapshot().persistence}
        context="idle"
      />,
    );

    expect(screen.getByText("Not saving on this device")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

describe("shell flow with damaged history", () => {
  it("lets the shopper set history aside from the finish surface and finish", async () => {
    const user = userEvent.setup();
    const { storage } = memoryStorage({
      [HISTORY_STORAGE_KEY]: partlyDamagedHistory(),
    });
    const controller = boot(storage);
    controller.startTrip({ budgetMinor: money(2_000) });
    controller.addManualItem({ unitPriceMinor: money(399), quantity: 1 });

    render(<ShoppingAppShell controller={controller} />);

    await user.click(screen.getByRole("button", { name: /Finish trip/ }));
    const finish = screen.getByRole("main", { name: "Ready to finish this trip?" });
    await user.click(within(finish).getByRole("button", { name: "Finish trip" }));

    expect(within(finish).getByRole("alert").textContent).toMatch(
      /needs attention/,
    );

    await user.click(within(finish).getByRole("button", { name: "Set aside…" }));
    await user.click(
      within(finish).getByRole("button", { name: "Set aside now" }),
    );

    expect(within(finish).queryByRole("alert")).toBeNull();

    await user.click(within(finish).getByRole("button", { name: "Finish trip" }));

    expect(controller.getSnapshot().lifecycle).toBe("completed-summary");
    expect(controller.getSnapshot().completedTrips).toHaveLength(2);
  });
});
