import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppearanceSwitcher } from "../src/app/AppearanceSwitcher";
import { APPEARANCE_STORAGE_KEY } from "../src/app/appearance";

describe("AppearanceSwitcher", () => {
  it("offers all appearance modes as explicit accessible choices", () => {
    render(<AppearanceSwitcher />);

    expect(
      screen.getByRole("group", { name: "Appearance theme" }),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "System" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Light" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Dark" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Aurora" })).not.toBeNull();
  });

  it("links to the static scanner and camera hub without replacing the shopping flow", () => {
    render(<AppearanceSwitcher />);

    const hub = screen.getByRole("link", { name: "Scanner & camera" });

    expect(
      hub.getAttribute("href")?.endsWith("/camera-tools/"),
    ).toBe(true);
  });

  it("switches immediately and persists the preference without touching shopping state", async () => {
    const user = userEvent.setup();

    render(<AppearanceSwitcher />);

    const aurora = screen.getByRole("button", { name: "Aurora" });
    await user.click(aurora);

    expect(aurora.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.appearance).toBe("aurora");
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("aurora");
  });
});
