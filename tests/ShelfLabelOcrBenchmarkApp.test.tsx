import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/qa/ShelfLabelOcrBenchmarkApp";
import {
  SHELF_LABEL_OCR_STORAGE_KEY,
} from "../src/qa/shelf-label-ocr-benchmark";

describe("ShelfLabelOcrBenchmarkApp", () => {
  afterEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(
      globalThis,
      "__SBC_SHELF_LABEL_OCR_ENGINE__",
    );
  });

  it("loads as an isolated evidence tool without shopping controls", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Shelf-label OCR benchmark",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add price" }),
    ).toBeNull();
    expect(screen.getByText("OCR not configured")).toBeTruthy();
    expect(
      screen.getByText(/contains no camera image, raw OCR text, price/i),
    ).toBeTruthy();
  });

  it("preserves malformed retained evidence until explicit reset", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      SHELF_LABEL_OCR_STORAGE_KEY,
      "{malformed",
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Shelf-label OCR benchmark",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/has not been overwritten/i),
    ).toBeTruthy();
    expect(
      localStorage.getItem(SHELF_LABEL_OCR_STORAGE_KEY),
    ).toBe("{malformed");

    await user.click(
      screen.getByRole("button", {
        name: "Reset malformed OCR benchmark evidence",
      }),
    );

    expect(
      localStorage.getItem(SHELF_LABEL_OCR_STORAGE_KEY),
    ).toContain('"version":1');
  });
});
