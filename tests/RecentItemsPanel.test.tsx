import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createPriceMemoryRecord,
  type PriceMemoryRecord,
} from "../src/domain/price-memory";
import {
  createActiveTrip,
  type ActiveTrip,
} from "../src/domain/shopping-trip";
import { RecentItemsPanel } from "../src/features/shopping/RecentItemsPanel";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful Result");
  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));

const trip = (budget = 5_000): ActiveTrip =>
  unwrap(
    createActiveTrip({
      id: "recent-items-trip",
      budgetMinor: money(budget),
      startedAt: "2026-09-22T08:00:00.000Z",
    }),
  );

const memory = (
  label: string,
  price: number,
  observedAt = "2026-09-20T08:00:00.000Z",
): PriceMemoryRecord =>
  unwrap(
    createPriceMemoryRecord({
      label,
      unitPriceMinor: money(price),
      observedAt,
      source: { kind: "manual" },
    }),
  );

describe("RecentItemsPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows remembered price age and keeps current-price override explicit", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const milk = memory("Milk 1L", 139);
    const onUse = vi.fn(() => true);
    const onCurrent = vi.fn();

    render(
      <RecentItemsPanel
        trip={trip()}
        records={[milk]}
        persistenceHealth={{ status: "healthy" }}
        onUseRemembered={onUse}
        onEnterCurrentPrice={onCurrent}
        locale="en-IE"
      />,
    );

    expect(screen.getByText("Milk 1L")).not.toBeNull();
    expect(
      screen.getByText("Remembered €1.39 · 2 days ago"),
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Enter current price" }),
    );

    expect(onCurrent).toHaveBeenCalledWith(milk);
    expect(onUse).not.toHaveBeenCalled();
  });

  it("reuses a remembered price in one action when it stays within budget", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const milk = memory("Milk 1L", 139);
    const onUse = vi.fn(() => true);

    render(
      <RecentItemsPanel
        trip={trip()}
        records={[milk]}
        persistenceHealth={{ status: "healthy" }}
        onUseRemembered={onUse}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Use €1.39" }),
    );

    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledWith(milk);
  });

  it("requires explicit confirmation when a remembered price would exceed the nominal budget", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const milk = memory("Milk 1L", 139);
    const onUse = vi.fn(() => true);

    render(
      <RecentItemsPanel
        trip={trip(100)}
        records={[milk]}
        persistenceHealth={{ status: "healthy" }}
        onUseRemembered={onUse}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Use €1.39" }),
    );

    expect(onUse).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: "Use the remembered price anyway?",
      }),
    ).not.toBeNull();
    expect(
      screen.getByText(/€0.39/),
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add remembered price" }),
    );

    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it("surfaces advisory persistence degradation without blocking reuse", () => {
    const milk = memory("Milk 1L", 139);

    render(
      <RecentItemsPanel
        trip={trip()}
        records={[milk]}
        persistenceHealth={{
          status: "degraded",
          issue: {
            code: "write-failed",
            storageKey: "budget-cart:price-memory",
          },
          since: "2026-09-22T08:00:00.000Z" as never,
        }}
        onUseRemembered={vi.fn()}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    expect(
      screen.getByText(
        "Recent Items are available now, but new memories may not survive a reload.",
      ),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Use €1.39" }),
    ).not.toBeNull();
  });
});
