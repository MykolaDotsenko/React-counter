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
        onValidatedItem={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.79");

    expect(
      screen.getByText("After adding: €45.21 left"),
    ).not.toBeNull();
    const projection = screen.getByLabelText("Projected cart result");
    const add = screen.getByRole("button", { name: "Add · €4.79" });

    expect(projection).not.toBeNull();
    expect(add.getAttribute("aria-describedby")).toBe(projection.id);
    expect(trip.items).toHaveLength(0);
  });

  it("keeps naming optional but includes a chosen name in the validated intent", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "1.39");
    await user.click(
      screen.getByText("Name for next time", { exact: false }),
    );
    await user.type(screen.getByLabelText("Item name"), "Milk 1L");
    await user.click(
      screen.getByRole("button", { name: "Add · €1.39" }),
    );

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 139,
      quantity: 1,
      label: "Milk 1L",
    });
  });

  it("carries a Recent Item label into manual current-price override without pre-filling a stale price", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        initialLabel="Milk 1L"
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    expect(
      screen.getByText("Current price for", { exact: false }).textContent,
    ).toContain("Milk 1L");
    expect((screen.getByLabelText("Price") as HTMLInputElement).value).toBe("");

    await user.type(screen.getByLabelText("Price"), "1.49");
    await user.click(
      screen.getByRole("button", { name: "Add · €1.49" }),
    );

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 149,
      quantity: 1,
      label: "Milk 1L",
    });
  });

  it("previews safe remaining first when a safety buffer exists", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip(5_000, 200)}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={vi.fn()}
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
    const onValidatedItem = vi.fn();
    const trip = createTrip(5_000, 200);

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
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

    expect(onValidatedItem).toHaveBeenCalledTimes(1);
    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 4_900,
      quantity: 1,
    });
    expect(trip.items).toHaveLength(0);
  });

  it("requires explicit Add anyway before emitting a nominal over-budget intent", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();
    const trip = createTrip();

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
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

    expect(onValidatedItem).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Add this price anyway?" }),
    ).not.toBeNull();
    expect(input.readOnly).toBe(true);
    expect(trip.items).toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "Add anyway · €53.41" }),
    );

    expect(onValidatedItem).toHaveBeenCalledTimes(1);
    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 5_341,
      quantity: 1,
    });
    expect(trip.items).toHaveLength(0);
  });

  it("cancels over-budget review without changing the trip or draft", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();
    const onCancel = vi.fn();
    const trip = createTrip();

    render(
      <PriceEntrySurface
        trip={trip}
        locale="en-IE"
        onCancel={onCancel}
        onValidatedItem={onValidatedItem}
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

    expect(onValidatedItem).not.toHaveBeenCalled();
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
        onValidatedItem={vi.fn()}
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
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
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

    expect(onValidatedItem).toHaveBeenCalledTimes(1);
  });

  it("defaults quantity to one and prevents decrementing below the domain minimum", () => {
    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Current quantity").textContent).toBe("1");
    expect(
      (screen.getByRole("button", {
        name: "Decrease quantity",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Increase quantity",
      }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("projects exact line total and remaining for EUR 1.29 times three", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "1.29");
    await user.click(
      screen.getByRole("button", { name: "Increase quantity" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Increase quantity" }),
    );

    expect(screen.getByLabelText("Current quantity").textContent).toBe("3");
    expect(screen.getByText("€1.29 × 3 = €3.87")).not.toBeNull();
    expect(
      screen.getByText("After adding: €46.13 left"),
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add · €3.87" }),
    );

    expect(onValidatedItem).toHaveBeenCalledTimes(1);
    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 129,
      quantity: 3,
    });
  });

  it("updates projection immediately when quantity decreases", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "1.29");
    const increase = screen.getByRole("button", {
      name: "Increase quantity",
    });
    const decrease = screen.getByRole("button", {
      name: "Decrease quantity",
    });

    await user.click(increase);
    await user.click(increase);
    expect(screen.getByText("€1.29 × 3 = €3.87")).not.toBeNull();

    await user.click(decrease);

    expect(screen.getByLabelText("Current quantity").textContent).toBe("2");
    expect(screen.getByText("€1.29 × 2 = €2.58")).not.toBeNull();
    expect(
      screen.getByText("After adding: €47.42 left"),
    ).not.toBeNull();
  });

  it("lets quantity trigger safety-buffer use without nominal confirmation", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip(5_000, 200)}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "16.50");
    const increase = screen.getByRole("button", {
      name: "Increase quantity",
    });
    await user.click(increase);
    await user.click(increase);

    expect(
      screen.getByText("This item uses €1.50 of your safety buffer."),
    ).not.toBeNull();
    expect(
      screen.getByText("€0.50 remains before your nominal limit."),
    ).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Add this price anyway?" }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add · €49.50" }),
    );

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 1_650,
      quantity: 3,
    });
  });

  it("freezes the reviewed quantity when quantity creates nominal over-budget", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "20");
    const increase = screen.getByRole("button", {
      name: "Increase quantity",
    });
    await user.click(increase);
    await user.click(increase);

    expect(screen.getByText("€20.00 × 3 = €60.00")).not.toBeNull();
    expect(
      screen.getByText("This puts you €10.00 over your limit."),
    ).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Add · €60.00" }),
    );

    expect(
      (screen.getByRole("button", {
        name: "Increase quantity",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Decrease quantity",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(
      screen.getByRole("button", {
        name: "Add anyway · €60.00",
      }),
    );

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 2_000,
      quantity: 3,
    });
  });

  it("shows no fake projection for an incomplete or invalid draft", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={vi.fn()}
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
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
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

    expect(onValidatedItem).toHaveBeenCalledTimes(1);
    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 479,
      quantity: 1,
    });
  });

  it("keeps optional naming out of the baseline path but includes it when chosen", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    const namingSummary = screen.getByText(
      "Name for next time",
      { exact: false },
    );
    const namingDetails = namingSummary.closest("details");

    expect(namingDetails).not.toBeNull();
    expect((namingDetails as HTMLDetailsElement).open).toBe(false);

    await user.click(namingSummary);

    expect((namingDetails as HTMLDetailsElement).open).toBe(true);

    const name = screen.getByRole("textbox", { name: "Item name" });
    await user.type(name, "Milk 1L");
    await user.type(screen.getByLabelText("Price"), "1.39");
    await user.click(
      screen.getByRole("button", { name: "Add · €1.39" }),
    );

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 139,
      quantity: 1,
      label: "Milk 1L",
    });
  });

  it("preserves a recent-item label when the user enters the current price", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        initialLabel="Milk 1L"
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    expect(
      screen.getByText("Current price for", { exact: false }).textContent,
    ).toContain("Milk 1L");

    await user.type(screen.getByLabelText("Price"), "1.49");
    await user.click(
      screen.getByRole("button", { name: "Add · €1.49" }),
    );

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 149,
      quantity: 1,
      label: "Milk 1L",
    });
  });

  it("accepts comma input and paste through the real text field", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    const input = screen.getByLabelText("Price");
    await user.click(input);
    await user.paste("4,79");

    expect((input as HTMLInputElement).value).toBe("4,79");
    expect(screen.getByText("€4.79")).not.toBeNull();

    await user.keyboard("{Enter}");

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 479,
      quantity: 1,
    });
  });

  it("keeps normal incomplete decimal typing visible without an error", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={vi.fn()}
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
        onValidatedItem={vi.fn()}
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
        onValidatedItem={vi.fn()}
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
        onValidatedItem={vi.fn()}
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
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
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

    expect(onValidatedItem).toHaveBeenCalledWith({
      unitPriceMinor: 479,
      quantity: 1,
    });
  });

  it("does not auto-open the software keyboard on coarse-pointer devices", async () => {
    const user = userEvent.setup();
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(pointer: coarse)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    try {
      render(
        <PriceEntrySurface
          trip={createTrip()}
          locale="en-IE"
          onCancel={vi.fn()}
          onValidatedItem={vi.fn()}
        />,
      );

      const price = screen.getByLabelText("Price") as HTMLInputElement;
      const title = screen.getByRole("heading", {
        name: "What does this item cost?",
      });

      expect(document.activeElement).toBe(title);
      expect(document.activeElement).not.toBe(price);

      await user.click(screen.getByRole("button", { name: "Digit 4" }));

      expect(price.value).toBe("4");
      expect(document.activeElement).not.toBe(price);
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("supports Escape as a predictable cancel path", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={onCancel}
        onValidatedItem={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Price"));
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("remains recoverable when the parent rejects a canonical commit", async () => {
    const user = userEvent.setup();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={() => false}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.79");
    const add = screen.getByRole("button", { name: "Add · €4.79" });

    await user.click(add);

    expect(
      screen.getByText(
        "Could not add this item. Check the trip and try again.",
      ),
    ).not.toBeNull();
    expect((add as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Adding…" })).toBeNull();
  });

  it("guards the submit callback from re-entry during one commit", async () => {
    const user = userEvent.setup();
    const onValidatedItem = vi.fn();

    render(
      <PriceEntrySurface
        trip={createTrip()}
        locale="en-IE"
        onCancel={vi.fn()}
        onValidatedItem={onValidatedItem}
      />,
    );

    await user.type(screen.getByLabelText("Price"), "4.79");

    const add = screen.getByRole("button", { name: "Add · €4.79" });
    await user.dblClick(add);

    expect(onValidatedItem).toHaveBeenCalledTimes(1);
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(add.getAttribute("data-submitted")).toBe("true");
    expect(screen.getByRole("button", { name: "Adding…" })).not.toBeNull();
  });
});
