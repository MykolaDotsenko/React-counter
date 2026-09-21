import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createShoppingAppController,
  type Clock,
  type IdGenerator,
} from "../src/application/shopping-app-controller";
import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createActiveTrip,
  createCartItem,
  isoTimestamp,
  reduceTrip,
  type ActiveTrip,
  type CartItem,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import { ActiveTripScreen } from "../src/features/shopping/ActiveTripScreen";

const START = "2026-09-21T09:00:00.000Z";
const NEXT = "2026-09-21T09:05:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));
const time = (value: string): IsoTimestamp => unwrap(isoTimestamp(value));

const clock: Clock = {
  now: () => time(NEXT),
};

const ids: IdGenerator = {
  tripId: () => "trip-active-screen",
  itemId: () => "item-active-screen",
};

const createItem = ({
  id,
  price,
  quantity = 1,
  label,
  estimated = false,
}: {
  readonly id: string;
  readonly price: number;
  readonly quantity?: number;
  readonly label?: string;
  readonly estimated?: boolean;
}): CartItem =>
  unwrap(
    createCartItem({
      id,
      unitPriceMinor: money(price),
      quantity,
      ...(label === undefined ? {} : { label }),
      priceSource: { kind: "manual" },
      priceConfidence: estimated
        ? { kind: "estimated", reason: "other" }
        : { kind: "confirmed", confirmedAt: time(START) },
      createdAt: START,
    }),
  );

const createTrip = ({
  budget = 5_000,
  buffer = 0,
  items = [],
}: {
  readonly budget?: number;
  readonly buffer?: number;
  readonly items?: readonly CartItem[];
} = {}): ActiveTrip => {
  let trip: ActiveTrip = unwrap(
    createActiveTrip({
      id: "trip-active-screen",
      budgetMinor: money(budget),
      safetyBufferMinor: money(buffer),
      startedAt: START,
    }),
  );

  for (const item of items) {
    const result = reduceTrip(trip, {
      type: "add-item",
      item,
    });

    expect(result.ok).toBe(true);

    if (!result.ok || result.value.status !== "active") {
      throw new Error("Expected active trip after adding fixture item");
    }

    trip = result.value;
  }

  return trip;
};

const createController = (trip: ActiveTrip) => {
  const controller = createShoppingAppController({
    persistence: {
      bootstrap: () => ({
        ok: true,
        activeTrip: trip,
      }),
      save: () => ({ ok: true }),
    },
    clock,
    ids,
  });

  controller.bootstrap();
  return controller;
};

const renderScreen = (
  trip: ActiveTrip,
  onAddPrice = vi.fn(),
) => {
  render(
    <ActiveTripScreen
      controller={createController(trip)}
      onAddPrice={onAddPrice}
      locale="en-IE"
    />,
  );

  return { onAddPrice };
};

describe("ActiveTripScreen", () => {
  it("makes remaining money and Add price dominant for an empty trip", async () => {
    const user = userEvent.setup();
    const { onAddPrice } = renderScreen(createTrip());

    expect(screen.getByText("€50.00")).not.toBeNull();
    expect(screen.getByText("left")).not.toBeNull();
    expect(
      screen.getByText("€0.00 of €50.00"),
    ).not.toBeNull();
    expect(
      screen.getByText("Nothing in your cart yet."),
    ).not.toBeNull();

    const addPrice = screen.getByRole("button", { name: "Add price" });
    expect(addPrice).not.toBeNull();

    await user.click(addPrice);
    expect(onAddPrice).toHaveBeenCalledTimes(1);
  });

  it("uses safe remaining as the hero when a safety buffer is active", () => {
    const trip = createTrip({
      buffer: 200,
      items: [
        createItem({
          id: "basket",
          price: 3_142,
          label: "Current basket",
        }),
      ],
    });

    renderScreen(trip);

    expect(screen.getByText("€16.58")).not.toBeNull();
    expect(screen.getByText("safe to spend")).not.toBeNull();
    expect(
      screen.getByText("€31.42 of €50.00"),
    ).not.toBeNull();
    expect(
      screen.getByText(/€2.00 kept in reserve/),
    ).not.toBeNull();

    const progress = screen.getByRole("progressbar", {
      name: "Shopping budget used",
    });

    expect(progress.getAttribute("aria-valuetext")).toContain(
      "€31.42 in cart",
    );
    expect(progress.getAttribute("aria-valuetext")).toContain(
      "€18.58 total remains · €2.00 kept in reserve",
    );
    expect(
      screen.getByText("Safe limit €48.00 · Reserve €2.00"),
    ).not.toBeNull();
  });

  it("distinguishes using the reserve from exceeding the nominal budget", () => {
    const trip = createTrip({
      buffer: 200,
      items: [
        createItem({
          id: "near-limit",
          price: 4_900,
        }),
      ],
    });

    renderScreen(trip);

    expect(screen.getByText("€0.00")).not.toBeNull();
    expect(screen.getByText("safe to spend")).not.toBeNull();
    expect(
      screen.getByText(
        "Safety buffer reached · €1.00 remains in your nominal budget",
      ),
    ).not.toBeNull();
  });

  it("shows exact nominal overage instead of a misleading negative remaining label", () => {
    const trip = createTrip({
      buffer: 200,
      items: [
        createItem({
          id: "over-budget",
          price: 5_341,
        }),
      ],
    });

    renderScreen(trip);

    expect(screen.getByText("€3.41")).not.toBeNull();
    expect(screen.getByText("over your limit")).not.toBeNull();
    expect(
      screen.getByText("€3.41 over your limit"),
    ).not.toBeNull();
  });

  it("renders cart lines from canonical item data without requiring labels", () => {
    const trip = createTrip({
      items: [
        createItem({
          id: "milk",
          price: 129,
          quantity: 3,
          label: "Milk",
        }),
        createItem({
          id: "unlabelled",
          price: 450,
          estimated: true,
        }),
      ],
    });

    renderScreen(trip);

    expect(screen.getByText("Milk")).not.toBeNull();
    expect(screen.getByText("€1.29 × 3")).not.toBeNull();
    expect(screen.getByText("€3.87")).not.toBeNull();
    expect(screen.getByText("Item 2")).not.toBeNull();
    expect(screen.getByText("Estimated price")).not.toBeNull();
    expect(screen.getByText("4 items")).not.toBeNull();
  });

  it("keeps one-action Undo beside committed feedback", async () => {
    const user = userEvent.setup();
    const controller = createController(createTrip());
    const added = controller.addManualItem({
      unitPriceMinor: money(479),
      quantity: 1,
    });

    expect(added.ok).toBe(true);

    const onUndo = vi.fn();

    render(
      <ActiveTripScreen
        controller={controller}
        onAddPrice={vi.fn()}
        onUndo={onUndo}
        feedbackMessage="€4.79 added. €45.21 remaining."
        locale="en-IE"
      />,
    );

    expect(
      screen.getByText("€4.79 added. €45.21 remaining."),
    ).not.toBeNull();

    const undo = screen.getByRole("button", { name: "Undo" });
    await user.click(undo);

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("reacts to controller state changes through the canonical external-store bridge", async () => {
    const controller = createController(createTrip());
    const onAddPrice = vi.fn();

    render(
      <ActiveTripScreen
        controller={controller}
        onAddPrice={onAddPrice}
        locale="en-IE"
      />,
    );

    expect(screen.getByText("€50.00")).not.toBeNull();

    const result = controller.dispatch({
      type: "set-buffer",
      safetyBufferMinor: money(500),
    });

    expect(result.ok).toBe(true);

    await waitFor(() => {
      expect(screen.getByText("€45.00")).not.toBeNull();
      expect(screen.getByText("safe to spend")).not.toBeNull();
    });
  });
});
