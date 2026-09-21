import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PriceEntrySurface } from "../src/features/shopping/PriceEntrySurface";

describe("PriceEntrySurface", () => {
  it("enters a basic EUR 4.79 price with the one-hand keypad", async () => {
    const user = userEvent.setup();
    const onValidatedPrice = vi.fn();

    render(
      <PriceEntrySurface
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
