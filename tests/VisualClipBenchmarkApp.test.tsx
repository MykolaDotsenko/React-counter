import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/qa/VisualClipBenchmarkApp";

describe("VisualClipBenchmarkApp", () => {
  it("shows a pinned local-first model setup without touching shopping state", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Transformers.js CLIP retail benchmark",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("Xenova/clip-vit-base-patch32"),
    ).toBeTruthy();
    expect(
      screen.getByText("d15189d"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add price" }),
    ).toBeNull();

    const textarea = screen.getByRole("textbox", {
      name: /candidate product labels/i,
    });

    await user.type(
      textarea,
      "Private product A\nPrivate product B\nPrivate product C",
    );

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps WebGPU unavailable when the browser does not expose it", () => {
    render(<App />);

    const option = screen.getByRole("option", {
      name: /WebGPU/i,
    }) as HTMLOptionElement;

    if (!("gpu" in navigator)) {
      expect(option.disabled).toBe(true);
    }
  });
});
