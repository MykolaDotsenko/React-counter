import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createPriceMemoryRecord,
  type PriceMemoryRecord,
} from "../src/domain/price-memory";
import {
  createActiveTrip,
  isoTimestamp,
  type ActiveTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import { RecentItemsSection } from "../src/features/shopping/RecentItemsSection";

const NOW = "2026-09-22T08:00:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => unwrap(isoTimestamp(value));

const createTrip = (budget = 5_000): ActiveTrip =>
  unwrap(
    createActiveTrip({
      id: "recent-items-trip",
      budgetMinor: money(budget),
      startedAt: "2026-09-22T07:00:00.000Z",
    }),
  );

const memory = ({
  label = "Milk 1L",
  price = 139,
  observedAt = "2026-09-20T08:00:00.000Z",
  storeId,
}: {
  label?: string;
  price?: number;
  observedAt?: string;
  storeId?: string;
} = {}): PriceMemoryRecord =>
  unwrap(
    createPriceMemoryRecord({
      label,
      unitPriceMinor: money(price),
      observedAt,
      ...(storeId === undefined ? {} : { storeId }),
      source: { kind: "manual" },
    }),
  );

describe("RecentItemsSection", () => {
  it("labels remembered prices as stale context with visible age", () => {
    render(
      <RecentItemsSection
        trip={createTrip()}
        records={[memory()]}
        now={time(NOW)}
        onUseRemembered={vi.fn()}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    expect(screen.getByRole("heading", { name: "Recent Items" })).not.toBeNull();
    expect(screen.getByText("Milk 1L")).not.toBeNull();
    expect(screen.getByText("€1.39")).not.toBeNull();
    expect(
      screen.getByText("Remembered · Seen 2 days ago"),
    ).not.toBeNull();
    expect(
      screen.getByText(/old observed prices, not live store prices/i),
    ).not.toBeNull();
  });

  it("reuses a remembered price in one action when it stays within budget", async () => {
    const user = userEvent.setup();
    const record = memory();
    const onUseRemembered = vi.fn(() => true);

    render(
      <RecentItemsSection
        trip={createTrip()}
        records={[record]}
        now={time(NOW)}
        onUseRemembered={onUseRemembered}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Use remembered price" }),
    );

    expect(onUseRemembered).toHaveBeenCalledTimes(1);
    expect(onUseRemembered).toHaveBeenCalledWith(record);
  });

  it("always offers current-price entry instead of forcing remembered value", async () => {
    const user = userEvent.setup();
    const record = memory();
    const onEnterCurrentPrice = vi.fn();

    render(
      <RecentItemsSection
        trip={createTrip()}
        records={[record]}
        now={time(NOW)}
        onUseRemembered={vi.fn()}
        onEnterCurrentPrice={onEnterCurrentPrice}
        locale="en-IE"
      />,
    );

    const currentPrice = screen.getByRole("button", {
      name: "Enter current price",
    });
    expect(currentPrice.dataset.currentPriceMemoryId).toBe(record.id);

    await user.click(currentPrice);

    expect(onEnterCurrentPrice).toHaveBeenCalledWith(record);
  });

  it("requires explicit second confirmation when a remembered price crosses the nominal budget", async () => {
    const user = userEvent.setup();
    const record = memory({ price: 600 });
    const onUseRemembered = vi.fn(() => true);

    render(
      <RecentItemsSection
        trip={createTrip(500)}
        records={[record]}
        now={time(NOW)}
        onUseRemembered={onUseRemembered}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Use remembered price" }),
    );

    expect(onUseRemembered).not.toHaveBeenCalled();

    const confirmation = screen.getByLabelText(
      "Confirm remembered price for Milk 1L",
    );
    expect(
      within(confirmation).getByText(/€1.00/),
    ).not.toBeNull();

    await user.click(
      within(confirmation).getByRole("button", { name: "Add anyway" }),
    );

    expect(onUseRemembered).toHaveBeenCalledTimes(1);
    expect(onUseRemembered).toHaveBeenCalledWith(record);
  });

  it("focuses the safe cancel action and lets Escape close remembered over-budget confirmation", async () => {
    const user = userEvent.setup();
    const record = memory({ price: 600 });
    const onUseRemembered = vi.fn(() => true);

    render(
      <RecentItemsSection
        trip={createTrip(500)}
        records={[record]}
        now={time(NOW)}
        onUseRemembered={onUseRemembered}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Use remembered price" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );

    await user.keyboard("{Escape}");

    expect(
      screen.queryByLabelText("Confirm remembered price for Milk 1L"),
    ).toBeNull();
    expect(onUseRemembered).not.toHaveBeenCalled();
  });

  it("keeps advisory persistence failure separate and explicit", () => {
    render(
      <RecentItemsSection
        trip={createTrip()}
        records={[memory()]}
        now={time(NOW)}
        persistenceDegraded
        onUseRemembered={vi.fn()}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    expect(
      screen.getByText(/price-memory changes are not safely saving/i),
    ).not.toBeNull();
    expect(
      screen.getByText(/active cart is still saved independently/i),
    ).not.toBeNull();
  });

  it("keeps only the newest four recent product identities", () => {
    const records = [
      memory({ label: "A", observedAt: "2026-09-17T08:00:00.000Z" }),
      memory({ label: "B", observedAt: "2026-09-18T08:00:00.000Z" }),
      memory({ label: "C", observedAt: "2026-09-19T08:00:00.000Z" }),
      memory({ label: "D", observedAt: "2026-09-20T08:00:00.000Z" }),
      memory({ label: "E", observedAt: "2026-09-21T08:00:00.000Z" }),
    ];

    render(
      <RecentItemsSection
        trip={createTrip()}
        records={records}
        now={time(NOW)}
        onUseRemembered={vi.fn()}
        onEnterCurrentPrice={vi.fn()}
        locale="en-IE"
      />,
    );

    expect(screen.queryByText("A")).toBeNull();
    expect(screen.getByText("B")).not.toBeNull();
    expect(screen.getByText("C")).not.toBeNull();
    expect(screen.getByText("D")).not.toBeNull();
    expect(screen.getByText("E")).not.toBeNull();
  });
});
