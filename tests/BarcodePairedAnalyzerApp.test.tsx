import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../src/qa/BarcodePairedAnalyzerApp";

describe("BarcodePairedAnalyzerApp", () => {
  it("loads as an isolated local-only facilitator tool", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Barcode paired evidence analyzer",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add price" }),
    ).toBeNull();
    expect(
      screen.getByText(/stay in this browser page memory/i),
    ).toBeTruthy();
    expect(storageSpy).not.toHaveBeenCalled();

    storageSpy.mockRestore();
  });

  it("marks malformed imports invalid without persisting them", async () => {
    const user = userEvent.setup();
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    const inputs = screen.getAllByLabelText(/select .* JSON/i, {
      selector: "input",
    });

    await user.upload(
      inputs[0] as HTMLInputElement,
      new File(["{bad"], "manual.json", {
        type: "application/json",
      }),
    );
    await user.upload(
      inputs[1] as HTMLInputElement,
      new File(["{bad"], "barcode.json", {
        type: "application/json",
      }),
    );

    expect(
      await screen.findByText(/Analysis invalid/i),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Download paired aggregate",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(storageSpy).not.toHaveBeenCalled();

    storageSpy.mockRestore();
  });
});
