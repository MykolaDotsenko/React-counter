import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  createActiveTrip,
  type ActiveTrip,
} from "../src/domain/shopping-trip";
import { PriceEntrySurface } from "../src/features/shopping/PriceEntrySurface";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const money = (value: number) => unwrap(mvpMinorUnits(value));

const createTrip = (
  budget = 5_000,
  buffer = 0,
): ActiveTrip =>
  unwrap(
    createActiveTrip({
      id: "trip-price-entry",
      budgetMinor: money(budget),
      safetyBufferMinor: money(buffer),
      startedAt: "2026-09-21T09:00:00.000Z",
    }),
  );

describe("PriceEntrySurface", () => {
  it("previews exact remaining without mutating the active trip", async () => {
    const user = userEvent.setup();
    const trip = createTrip();

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.79");

    expect(
      screen.getByText("After adding: €45.21 left"),
    ).not.toBeNull();
    expect(screen.getByLabelText("Projected cart result")).not.toBeNull();
    expect(trip.items).toHaveLength(0);
  });

  it("previews safe remaining first when a safety buffer exists", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip(5_000, 200)}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.79");

    expect(
      screen.getByText("After adding: €43.21 safe to spend"),
    ).not.toBeNull();
    expect(
      screen.getByText("€45.21 remains before your nominal limit."),
    ).not.toBeNull();
  });

  it("distinguishes safety-buffer use without adding a confirmation step", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();
    const trip = createTrip(5_000, 200);

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "49.00");

    expect(
      screen.getByText("This item uses €1.00 of your safety buffer."),
    ).not.toBeNull();
    expect(
      screen.getByText("€1.00 remains before your nominal limit."),
    ).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Add this price anyway?" }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add · €49.00" }),
    );

    expect(onValidatedPrice).toHaveBeenCalledTimes(1);
    expect(onValidatedPrice).toHaveBeenCalledWith(4_900);
    expect(trip.items).toHaveLength(0);
  });

  it("requires explicit Add anyway before emitting a nominal over-budget intent", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();
    const trip = createTrip();

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    const input = screen.getByLabelText("Price") as HTMLInputElement;
    await user.type(input, "53.41");

    expect(
      screen.getByText("This puts you €3.41 over your limit."),
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add · €53.41" }),
    );

    expect(onValidatedPrice).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Add this price anyway?" }),
    ).not.toBeNull();
    expect(input.readOnly).toBe(true);
    expect(trip.items).toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "Add anyway · €53.41" }),
    );

    expect(onValidatedPrice).toHaveBeenCalledTimes(1);
    expect(onValidatedPrice).toHaveBeenCalledWith(5_341);
    expect(trip.items).toHaveLength(0);
  });

  it("cancels over-budget review without changing the trip or draft", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();
    const onCancel = vi.fn();
    const trip = createTrip();

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={onCancel}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    const input = screen.getByLabelText("Price") as HTMLInputElement;
    await user.type(input, "53.41");
    await user.click(
      screen.getByRole("button", { name: "Add · €53.41" }),
    );

    await user.click(
      screen.getAllByRole("button", { name: "Cancel" }).at(-1)!,
    );

    expect(onValidatedPrice).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(input.value).toBe("53.41");
    expect(input.readOnly).toBe(false);
    expect(trip.items).toHaveLength(0);
    expect(
      screen.queryByRole("heading", { name: "Add this price anyway?" }),
    ).toBeNull();
  });

  it("lets Escape dismiss only the over-budget review", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={onCancel}
        onValidatedPrice={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "53.41");
    await user.click(
      screen.getByRole("button", { name: "Add · €53.41" }),
    );

    expect(
      screen.getByRole("heading", { name: "Add this price anyway?" }),
    ).not.toBeNull();

    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Add this price anyway?" }),
    ).toBeNull();
  });

  it("guards Add anyway from rapid duplicate submission", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "53.41");
    await user.click(
      screen.getByRole("button", { name: "Add · €53.41" }),
    );

    const addAnyway = screen.getByRole("button", {
      name: "Add anyway · €53.41",
    });

    await user.dblClick(addAnyway);

    expect(onValidatedPrice).toHaveBeenCalledTimes(1);
  });

  it("shows no fake projection for an incomplete or invalid draft", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Price");
    await user.type(input, "4.");

    expect(screen.queryByLabelText("Projected cart result")).toBeNull();

    await user.type(input, "790");

    expect(screen.queryByLabelText("Projected cart result")).toBeNull();
  });
  it("enters a basic EUR 4.79 price with the one-hand keypad", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Digit 4" }));
    await user.click(
      screen.getByRole("button", { name: "Decimal separator" }),
    );
    await user.click(screen.getByRole("button", { name: "Digit 7" }));
    await user.click(screen.getByRole("button", { name: "Digit 9" }));

    expect((screen.getByLabelText("Price") as HTMLInputElement).value).toBe("4.79");
    expect(screen.getByText("€4.79")).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add · €4.79" }),
    );

    expect(onValidatedPrice).toHaveBeenCalledTimes(1);
    expect(onValidatedPrice).toHaveBeenCalledWith(479);
  });

  it("accepts comma input and paste through the real text field", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    const input = screen.getByLabelText("Price");
    await user.click(input);
    await user.paste("4,79");

    expect((input as HTMLInputElement).value).toBe("4,79");
    expect(screen.getByText("€4.79")).not.toBeNull();

    await user.keyboard("{Enter}");

    expect(onValidatedPrice).toHaveBeenCalledWith(479);
  });

  it("keeps normal incomplete decimal typing visible without an error", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Price");
    await user.type(input, "4.");

    expect((input as HTMLInputElement).value).toBe("4.");
    expect(screen.getByText("Finish the amount.")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows concise invalid copy and keeps Add disabled", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.790");

    expect(
      screen.getByText("Use no more than two decimal places."),
    ).not.toBeNull();
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not allow zero-priced items to become a valid intent", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "0");

    expect(screen.getByText("Enter a price above €0.")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("supports backspace and one-action clear", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Price");
    await user.type(input, "12.50");

    await user.click(screen.getByRole("button", { name: "Backspace" }));
    expect((input as HTMLInputElement).value).toBe("12.5");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("makes auto-cents explicit and prevents mid-draft reinterpretation", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    const centsMode = screen.getByRole("button", {
      name: "Cents mode",
    });

    await user.click(centsMode);

    expect(centsMode.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByText("Fast entry: 479 becomes €4.79."),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Digit 4" }));
    await user.click(screen.getByRole("button", { name: "Digit 7" }));
    await user.click(screen.getByRole("button", { name: "Digit 9" }));

    expect(screen.getByText("€4.79")).not.toBeNull();
    expect((screen.getByRole("button", { name: "Euros" }) as HTMLButtonElement).disabled).toBe(true);
    expect((centsMode as HTMLButtonElement).disabled).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Add · €4.79" }),
    );

    expect(onValidatedPrice).toHaveBeenCalledWith(479);
  });

  it("supports Escape as a predictable cancel path", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={onCancel}
        onValidatedPrice={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Price"));
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("guards the submit callback from re-entry during one commit", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedPrice={onValidatedPrice}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.79");

    const add = screen.getByRole("button", { name: "Add · €4.79" });
    await user.dblClick(add);

    expect(onValidatedPrice).toHaveBeenCalledTimes(1);
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Adding…" })).not.toBeNull();
  });
});
