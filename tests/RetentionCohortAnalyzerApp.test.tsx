import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../src/qa/RetentionCohortAnalyzerApp";
import {
  appendRetentionBetaEvent,
  buildRetentionBetaExport,
  createRetentionBetaSession,
  type RetentionBetaEvent,
} from "../src/qa/retention-beta";

const at = (
  type: RetentionBetaEvent["type"],
  tripOrdinal: number,
  timestamp: string,
  extra: Record<string, unknown> = {},
): RetentionBetaEvent =>
  ({
    type,
    tripOrdinal,
    at: timestamp,
    ...extra,
  }) as RetentionBetaEvent;

const report = (
  events: readonly RetentionBetaEvent[],
  generatedAt: string,
  createdAt = "2026-09-01T08:00:00.000Z",
) => {
  let session = createRetentionBetaSession(createdAt);

  for (const event of events) {
    session = appendRetentionBetaEvent(session, event);
  }

  return buildRetentionBetaExport(session, generatedAt);
};

const file = (
  name: string,
  value: unknown,
): File =>
  new File([JSON.stringify(value)], name, {
    type: "application/json",
  });

describe("RetentionCohortAnalyzerApp", () => {
  it("validates exports and computes maturity-aware cohort metrics locally", async () => {
    const user = userEvent.setup();

    const returned = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("trip_started", 2, "2026-09-03T08:00:00.000Z", {
          source: "repeat",
        }),
      ],
      "2026-09-03T09:00:00.000Z",
    );
    const matureNonReturner = report(
      [
        at("trip_started", 1, "2026-09-02T08:00:00.000Z", {
          source: "new",
        }),
      ],
      "2026-09-12T08:00:00.000Z",
      "2026-09-02T08:00:00.000Z",
    );

    render(<App />);

    await user.upload(
      screen.getByLabelText("Select JSON exports"),
      [
        file("P001.json", returned),
        file("P002.json", matureNonReturner),
      ],
    );

    expect(
      screen.getByRole("heading", { name: "2 participants" }),
    ).toBeTruthy();

    const secondTripMetric = screen
      .getByText("Second-trip rate")
      .closest("article");
    expect(secondTripMetric?.textContent).toContain("50.0%");

    const sevenDayMetric = screen
      .getByText("7-day retention")
      .closest("article");
    expect(sevenDayMetric?.textContent).toContain("50.0%");
    expect(sevenDayMetric?.textContent).toContain("2 eligible");

    expect(screen.getByRole("status").textContent).toContain(
      "Imported 2",
    );
  });

  it("replaces an older export from the same retained session", async () => {
    const user = userEvent.setup();
    const first = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
      ],
      "2026-09-02T08:00:00.000Z",
    );
    const later = report(
      [
        at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
          source: "new",
        }),
        at("trip_started", 2, "2026-09-04T08:00:00.000Z", {
          source: "repeat",
        }),
      ],
      "2026-09-04T09:00:00.000Z",
    );

    render(<App />);
    const input = screen.getByLabelText("Select JSON exports");

    await user.upload(input, file("P001-old.json", first));
    await user.upload(input, file("P001-new.json", later));

    expect(
      screen.getByRole("heading", { name: "1 participant" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "replaced 1",
    );

    const secondTripMetric = screen
      .getByText("Second-trip rate")
      .closest("article");
    expect(secondTripMetric?.textContent).toContain("100.0%");
  });

  it("rejects invalid evidence without adding it to the cohort", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.upload(
      screen.getByLabelText("Select JSON exports"),
      file("invalid.json", { schemaVersion: 999 }),
    );

    expect(
      screen.getByRole("heading", { name: "0 participants" }),
    ).toBeTruthy();
    expect(screen.getByText("Invalid 1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "invalid 1",
    );
  });

  it("rejects implausibly future-dated evidence before cohort aggregation", async () => {
    const user = userEvent.setup();
    const future = report(
      [
        at("trip_started", 1, "2099-01-01T08:00:00.000Z", {
          source: "new",
        }),
      ],
      "2099-01-01T09:00:00.000Z",
      "2099-01-01T07:00:00.000Z",
    );

    render(<App />);

    await user.upload(
      screen.getByLabelText("Select JSON exports"),
      file("future.json", future),
    );

    expect(
      screen.getByRole("heading", { name: "0 participants" }),
    ).toBeTruthy();
    expect(screen.getByText("Invalid 1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "invalid 1",
    );
  });


  it("downloads an aggregate report without raw participant events or filenames", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:cohort-summary");
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
      const participant = report(
        [
          at("trip_started", 1, "2026-09-01T08:00:00.000Z", {
            source: "new",
          }),
        ],
        "2026-09-10T08:00:00.000Z",
      );

      render(<App />);

      await user.upload(
        screen.getByLabelText("Select JSON exports"),
        file("P001-private-filename.json", participant),
      );
      await user.click(
        screen.getByRole("button", {
          name: "Download aggregate summary",
        }),
      );

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(downloadedFileName).toMatch(
        /^retention-cohort-summary-\d{8}T\d{9}Z\.json$/,
      );
      expect(revokeObjectURL).toHaveBeenCalledWith(
        "blob:cohort-summary",
      );

      const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
      const exported = await blob.text();

      expect(exported).toContain(
        '"kind": "retention-cohort-summary"',
      );
      expect(exported).toContain('"sourceReportCount": 1');
      expect(exported).toContain(
        '"containsRawParticipantEvents": false',
      );
      expect(exported).toContain(
        '"containsParticipantFileNames": false',
      );
      expect(exported).not.toContain("P001-private-filename");
      expect(exported).not.toContain('"events"');
      expect(screen.getByRole("status").textContent).toContain(
        "Aggregate summary downloaded as retention-cohort-summary-",
      );
    } finally {
      click.mockRestore();
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

});
