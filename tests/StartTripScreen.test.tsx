import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  createShoppingAppController,
  type Clock,
  type IdGenerator,
} from "../src/application/shopping-app-controller";
import {
  isoTimestamp,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import { StartTripScreen } from "../src/features/shopping/StartTripScreen";

const START = "2026-09-21T09:00:00.000Z";

const clock: Clock = {
  now(): IsoTimestamp {
    const result = isoTimestamp(START);

    if (!result.ok) {
      throw new Error("Invalid test timestamp");
    }

    return result.value;
  },
};

const ids: IdGenerator = {
  tripId: () => "trip-start-screen",
  itemId: () => "item-start-screen",
};

const createController = () => {
  const controller = createShoppingAppController({
    persistence: {
      bootstrap: () => ({
        ok: true,
        activeTrip: null,
        completedTrips: [],
        completionCleanupPending: false,
      }),
      save: () => ({ ok: true }),
      complete: () => ({ ok: true }),
      saveCompleted: () => ({ ok: true }),
      clearCompletedActive: () => ({ ok: true }),
    },
    clock,
    ids,
  });

  controller.bootstrap();
  return controller;
};

describe("StartTripScreen", () => {
  it("presents the hard-budget job without an account wall", () => {
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    expect(
      screen.getByRole("heading", {
        name: "How much can you spend today?",
      }),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "Set your limit. Add prices. Always know what's left.",
      ),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "€25" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "€50" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "€75" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "€100" })).not.toBeNull();
    expect(screen.getByText("Add a safety buffer")).not.toBeNull();
    expect(
      screen.getByText("No account. Your active trip stays on this device."),
    ).not.toBeNull();
  });

  it("starts a €50 trip in one action", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(screen.getByRole("button", { name: "€50" }));

    expect(controller.getSnapshot()).toMatchObject({
      lifecycle: "active",
      activeTrip: {
        budgetMinor: 5_000,
        safetyBufferMinor: 0,
      },
      persistence: {
        status: "healthy",
      },
    });
  });

  it("applies an optional safety buffer to a quick budget", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(screen.getByText("Add a safety buffer"));
    await user.type(
      screen.getByRole("textbox", { name: /Safety buffer/i }),
      "2",
    );
    await user.click(screen.getByRole("button", { name: "€50" }));

    expect(controller.getSnapshot().activeTrip).toMatchObject({
      budgetMinor: 5_000,
      safetyBufferMinor: 200,
    });
  });

  it("keeps the trip idle when the buffer exceeds the selected budget", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(screen.getByText("Add a safety buffer"));
    await user.type(
      screen.getByRole("textbox", { name: /Safety buffer/i }),
      "60",
    );
    await user.click(screen.getByRole("button", { name: "€50" }));

    expect(controller.getSnapshot().lifecycle).toBe("idle");
    expect(screen.getByRole("alert").textContent).toContain(
      "Keep the safety buffer within your budget.",
    );
  });

  it("accepts a locale-friendly custom decimal budget", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(
      screen.getByRole("button", { name: "Custom amount" }),
    );

    const customInput = screen.getByRole("textbox", {
      name: "Custom budget",
    });

    expect(document.activeElement).toBe(customInput);

    await user.type(customInput, "37,50");
    await user.click(
      screen.getByRole("button", { name: "Start shopping" }),
    );

    expect(controller.getSnapshot().activeTrip?.budgetMinor).toBe(3_750);
  });

  it("explains invalid custom money input inline", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(
      screen.getByRole("button", { name: "Custom amount" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Custom budget" }),
      "37.500",
    );
    await user.click(
      screen.getByRole("button", { name: "Start shopping" }),
    );

    expect(controller.getSnapshot().lifecycle).toBe("idle");
    expect(screen.getByRole("alert").textContent).toContain(
      "Use no more than two decimal places.",
    );
  });

  it("lets the domain reject a zero custom budget without duplicating the rule", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(
      screen.getByRole("button", { name: "Custom amount" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Custom budget" }),
      "0",
    );
    await user.click(
      screen.getByRole("button", { name: "Start shopping" }),
    );

    expect(controller.getSnapshot().lifecycle).toBe("idle");
    expect(screen.getByRole("alert").textContent).toContain(
      "Set a budget above €0.",
    );
  });

  it("allows keyboard submit for the custom budget form", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<StartTripScreen controller={controller} />);

    await user.click(
      screen.getByRole("button", { name: "Custom amount" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Custom budget" }),
      "42{Enter}",
    );

    expect(controller.getSnapshot().activeTrip?.budgetMinor).toBe(4_200);
  });
});
