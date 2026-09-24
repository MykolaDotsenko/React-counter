import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RetentionBetaPanel } from "../src/qa/RetentionBetaPanel";
import {
  RETENTION_BETA_EVENT_LIMIT,
  appendRetentionBetaEvent,
  createRetentionBetaSession,
} from "../src/qa/retention-beta";

describe("RetentionBetaPanel", () => {
  it("stays collapsed by default and explains the privacy boundary when opened", async () => {
    const user = userEvent.setup();
    const session = appendRetentionBetaEvent(
      createRetentionBetaSession("2026-09-22T08:00:00.000Z"),
      {
        type: "trip_started",
        at: "2026-09-22T08:05:00.000Z",
        tripOrdinal: 1,
        source: "new",
      },
    );

    render(
      <RetentionBetaPanel
        session={session}
        onReset={vi.fn()}
      />,
    );

    expect(document.title).toBe(
      "Shopping Budget Companion — Retention Beta",
    );
    expect(
      document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      )?.content,
    ).toBe(
      "Internal Shopping Budget Companion real-store retention beta with privacy-safe local evidence.",
    );
    expect(
      screen.queryByRole("heading", { name: "Local beta evidence" }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    expect(
      screen.getByRole("heading", { name: "Local beta evidence" }),
    ).not.toBeNull();
    expect(screen.getByText("1", { exact: true })).not.toBeNull();
    expect(
      screen.getByText(/No prices, budgets, item names, stores/i),
    ).not.toBeNull();
  });

  it("prevents resetting evidence while a trip is active", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <RetentionBetaPanel
        session={createRetentionBetaSession(
          "2026-09-22T08:00:00.000Z",
        )}
        onReset={onReset}
        resetDisabled
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    const reset = screen.getByRole("button", {
      name: "Reset evidence",
    }) as HTMLButtonElement;

    expect(reset.disabled).toBe(true);
    expect(
      screen.getByText(/Finish or leave the active trip before resetting evidence/i),
    ).not.toBeNull();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("requires a second reset action before clearing evidence", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <RetentionBetaPanel
        session={createRetentionBetaSession(
          "2026-09-22T08:00:00.000Z",
        )}
        onReset={onReset}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Reset evidence" }),
    );
    expect(onReset).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Confirm reset" }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("downloads a privacy-safe JSON export with a stable session filename", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:retention-evidence");
    const revokeObjectURL = vi.fn();
    let downloadedFileName = "";

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileName = this.download;
      });

    try {
      render(
        <RetentionBetaPanel
          session={createRetentionBetaSession(
            "2026-09-22T08:00:00.000Z",
          )}
          onReset={vi.fn()}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Beta evidence" }),
      );
      await user.click(
        screen.getByRole("button", {
          name: "Download JSON evidence",
        }),
      );

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(downloadedFileName).toBe(
        "retention-beta-20260922T080000000Z.json",
      );
      expect(revokeObjectURL).toHaveBeenCalledWith(
        "blob:retention-evidence",
      );
      expect(screen.getByRole("status").textContent).toContain(
        "Evidence downloaded as retention-beta-20260922T080000000Z.json",
      );
    } finally {
      click.mockRestore();
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("keeps the panel usable when device time predates retained evidence", async () => {
    const user = userEvent.setup();

    render(
      <RetentionBetaPanel
        session={createRetentionBetaSession(
          "2099-01-01T08:00:00.000Z",
        )}
        onReset={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Copy privacy-safe evidence",
      }),
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Evidence export unavailable",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "device date and time",
    );
  });


  it("warns when evidence is only durable in memory", async () => {
    const user = userEvent.setup();

    render(
      <RetentionBetaPanel
        session={createRetentionBetaSession(
          "2026-09-22T08:00:00.000Z",
        )}
        recordingStatus="memory-only"
        onReset={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Evidence storage is unavailable",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "may be lost on reload",
    );
  });

  it("warns when the retained session reaches event capacity", async () => {
    const user = userEvent.setup();
    const base = createRetentionBetaSession(
      "2026-09-22T08:00:00.000Z",
    );
    const session = {
      ...base,
      events: Array.from(
        { length: RETENTION_BETA_EVENT_LIMIT },
        (_, index) => ({
          type: "manual_entry_abandoned" as const,
          at: new Date(
            Date.parse("2026-09-22T08:05:00.000Z") + index,
          ).toISOString(),
          tripOrdinal: 1,
        }),
      ),
    };

    render(
      <RetentionBetaPanel
        session={session}
        onReset={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Evidence event capacity reached",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "exclude it from primary cohort interpretation",
    );
  });


  it("blocks export when retained evidence failed validation", async () => {
    const user = userEvent.setup();

    render(
      <RetentionBetaPanel
        session={createRetentionBetaSession(
          "2026-09-22T08:00:00.000Z",
        )}
        recordingStatus="invalid-retained"
        onReset={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Beta evidence" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Retained beta evidence failed validation",
    );

    const download = screen.getByRole("button", {
      name: "Download JSON evidence",
    }) as HTMLButtonElement;
    const copy = screen.getByRole("button", {
      name: "Copy privacy-safe evidence",
    }) as HTMLButtonElement;

    expect(download.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
  });

});
