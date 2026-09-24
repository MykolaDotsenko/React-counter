import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("useRetentionBetaEvidence", () => {
  it("keeps shopping usable and exposes memory-only evidence when storage writes fail", async () => {
    vi.stubEnv("VITE_SHOPPING_BETA_EVIDENCE", "1");
    vi.resetModules();

    const { useRetentionBetaEvidence } = await import(
      "../src/qa/use-retention-beta-evidence"
    );
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      });
    const user = userEvent.setup();
    const controller = {
      getSnapshot: () => ({
        activeTrip: {},
      }),
    };

    function Harness() {
      const evidence = useRetentionBetaEvidence({
        controller: controller as never,
        activeTrip: null,
        showPanel: true,
      });

      return (
        <>
          {evidence.panel}
          <button
            type="button"
            onClick={() => evidence.recordTripStarted("new")}
          >
            Record trip start
          </button>
        </>
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: "Record trip start" }),
    );

    expect(setItem).toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Evidence storage is unavailable",
      );
    });

    expect(
      screen.getByRole("button", { name: "Record trip start" }),
    ).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "memory-only",
    );
  });

  it("freezes malformed retained evidence until an explicit reset", async () => {
    vi.stubEnv("VITE_SHOPPING_BETA_EVIDENCE", "1");
    vi.resetModules();

    const retentionKey = "budget-cart:qa:retention-v1";
    localStorage.setItem(retentionKey, "{broken");

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { useRetentionBetaEvidence } = await import(
      "../src/qa/use-retention-beta-evidence"
    );
    const user = userEvent.setup();
    const controller = {
      getSnapshot: () => ({
        activeTrip: {},
      }),
    };

    function Harness() {
      const evidence = useRetentionBetaEvidence({
        controller: controller as never,
        activeTrip: null,
        showPanel: true,
      });

      return (
        <>
          {evidence.panel}
          <button
            type="button"
            onClick={() => evidence.recordTripStarted("new")}
          >
            Record trip start
          </button>
        </>
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: "Record trip start" }),
    );

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(retentionKey)).toBe("{broken");

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "failed validation",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Download JSON evidence",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Copy privacy-safe evidence",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Reset evidence" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Confirm reset" }),
    );

    expect(setItem).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText(/failed validation/i)).toBeNull();
    });

    await user.click(
      screen.getByRole("button", { name: "Record trip start" }),
    );

    const restored = JSON.parse(
      localStorage.getItem(retentionKey) ?? "{}",
    );

    expect(restored.events).toEqual([
      expect.objectContaining({
        type: "trip_started",
        tripOrdinal: 1,
        source: "new",
      }),
    ]);
  });

});
