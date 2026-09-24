import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/qa/ShelfLabelTesseractBenchmarkApp";

describe("ShelfLabelTesseractBenchmarkApp", () => {
  it("shows the pinned local-first OCR contract without starting model downloads", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Tesseract.js shelf-label OCR benchmark",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Tesseract.js 7.0.0")).toBeTruthy();
    expect(screen.getByText("fin + swe + eng")).toBeTruthy();
    expect(screen.getByText("4.0.0_best_int")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add price" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Prepare pinned Tesseract OCR",
      }),
    ).toBeTruthy();
  });
});
