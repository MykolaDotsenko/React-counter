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

  it("exposes deployed camera tools without replacing the shopping flow", () => {
    render(<AppearanceSwitcher />);

    const barcode = screen.getByRole("link", { name: "Barcode scanner" });
    const visual = screen.getByRole("link", { name: "Visual camera" });
    const ocr = screen.getByRole("link", { name: "Shelf-price OCR" });

    expect(barcode.getAttribute("href")?.endsWith("/barcode-benchmark/")).toBe(true);
    expect(
      visual.getAttribute("href")?.endsWith("/visual-recognition-benchmark/"),
    ).toBe(true);
    expect(
      ocr
        .getAttribute("href")
        ?.endsWith("/shelf-label-ocr-tesseract-benchmark/"),
    ).toBe(true);

    expect(barcode.getAttribute("target")).toBe("_blank");
    expect(visual.getAttribute("target")).toBe("_blank");
    expect(ocr.getAttribute("target")).toBe("_blank");
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
