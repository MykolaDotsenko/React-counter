import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RetentionBetaPanel } from "../src/qa/RetentionBetaPanel";
import {
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
});
