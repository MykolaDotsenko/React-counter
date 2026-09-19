import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CounterExperience } from "../src/features/counter/CounterExperience.jsx";
import { STORAGE_KEY } from "../src/features/counter/counter-storage.js";

describe("CounterExperience", () => {
  it("supports the primary pointer flow and persists state", async () => {
    const user = userEvent.setup();
    render(<CounterExperience />);

    expect(screen.getByLabelText("Current count 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease by 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset to zero" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Increase by 1" }));
    expect(screen.getByLabelText("Current count 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "10" }));
    expect(screen.getByRole("button", { name: "10" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Increase by 10" }));
    expect(screen.getByLabelText("Current count 11")).toBeInTheDocument();

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toEqual({
        version: 1,
        value: 11,
        step: 10,
      });
    });
  });

  it("restores persisted state on a new render", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, value: 125, step: 25 }),
    );

    render(<CounterExperience />);

    expect(screen.getByLabelText("Current count 125")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase by 25" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "25" })).toHaveAttribute("aria-pressed", "true");
  });

  it("scopes arrow shortcuts to the focused counter region", async () => {
    const user = userEvent.setup();
    render(<CounterExperience />);

    const region = screen.getByRole("region", { name: "Counter controls" });
    region.focus();
    expect(region).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByLabelText("Current count 1")).toBeInTheDocument();

    const increaseButton = screen.getByRole("button", { name: "Increase by 1" });
    increaseButton.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByLabelText("Current count 1")).toBeInTheDocument();

    region.focus();
    await user.keyboard("R");
    expect(screen.getByLabelText("Current count 1")).toBeInTheDocument();
  });

  it("resets without exposing a single-character shortcut", async () => {
    const user = userEvent.setup();
    render(<CounterExperience />);

    await user.click(screen.getByRole("button", { name: "Increase by 1" }));
    await user.click(screen.getByRole("button", { name: "Reset to zero" }));

    expect(screen.getByLabelText("Current count 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to zero" })).toBeDisabled();
  });
});
