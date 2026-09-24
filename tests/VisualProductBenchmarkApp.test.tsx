import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/qa/VisualProductBenchmarkApp";
import {
  VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY,
} from "../src/qa/visual-product-benchmark";

describe("VisualProductBenchmarkApp", () => {
  afterEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(
      globalThis,
      "__SBC_VISUAL_PRODUCT_RECOGNIZER__",
    );
  });

  it("loads as an isolated evidence tool without shopping controls", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Visual product recognition benchmark",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add price" }),
    ).toBeNull();
    expect(
      screen.getByText("Recognizer not configured"),
    ).toBeTruthy();
    expect(
      screen.getByText(/contains no image bytes/i),
    ).toBeTruthy();
  });

  it("does not silently replace malformed retained evidence", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY,
      "{malformed",
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Visual product recognition benchmark",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/has not been overwritten/i),
    ).toBeTruthy();
    expect(
      localStorage.getItem(
        VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY,
      ),
    ).toBe("{malformed");

    await user.click(
      screen.getByRole("button", {
        name: "Reset malformed benchmark evidence",
      }),
    );

    expect(
      localStorage.getItem(
        VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY,
      ),
    ).toContain('"version":1');
  });
});
