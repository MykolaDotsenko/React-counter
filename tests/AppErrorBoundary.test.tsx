import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "../src/app/AppErrorBoundary";

function BrokenChild(): never {
  throw new Error("render failure");
}

describe("AppErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces a crashed tree with a recoverable local-first fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", {
        name: "The app hit an unexpected problem",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Reload app" }),
    ).not.toBeNull();
    expect(
      screen.getByText(/latest trip that was successfully saved/i),
    ).not.toBeNull();
  });
});
