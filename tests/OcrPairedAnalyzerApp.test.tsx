import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../src/qa/OcrPairedAnalyzerApp";

describe("OcrPairedAnalyzerApp", () => {
  it("loads as an isolated page-memory-only facilitator tool", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "OCR paired evidence analyzer",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add price" }),
    ).toBeNull();
    expect(
      screen.getByText(/files stay in page memory/i),
    ).toBeTruthy();
    expect(storageSpy).not.toHaveBeenCalled();

    storageSpy.mockRestore();
  });

  it("marks malformed source imports invalid and keeps aggregate export disabled", async () => {
    const user = userEvent.setup();
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    await user.upload(
      screen.getByLabelText("Select manual JSON"),
      new File(["{bad"], "manual.json", {
        type: "application/json",
      }),
    );
    await user.upload(
      screen.getByLabelText("Select OCR JSON"),
      new File(["{bad"], "ocr.json", {
        type: "application/json",
      }),
    );

    expect(
      await screen.findByText("Analysis invalid"),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Download OCR paired aggregate",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(storageSpy).not.toHaveBeenCalled();

    storageSpy.mockRestore();
  });
});
