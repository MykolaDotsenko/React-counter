import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/qa/visual-product-clip-recognizer", async () => {
  const actual = await vi.importActual<
    typeof import("../src/qa/visual-product-clip-recognizer")
  >("../src/qa/visual-product-clip-recognizer");

  return {
    ...actual,
    configureVisualClipRecognizer: vi.fn(async () => ({
      id: "fixture-clip",
      dataBoundary: "local-only" as const,
      recognize: vi.fn(),
    })),
  };
});

import { VisualClipRecognizerSetup } from "../src/qa/VisualClipRecognizerSetup";
import {
  configureVisualClipRecognizer,
} from "../src/qa/visual-product-clip-recognizer";

describe("VisualClipRecognizerSetup", () => {
  it("loads a valid catalog without displaying its labels", async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();

    render(
      <VisualClipRecognizerSetup
        disabled={false}
        onConfigured={vi.fn()}
        onStatus={onStatus}
      />,
    );

    await user.upload(
      screen.getByLabelText("Candidate product catalog JSON"),
      new File(
        [
          JSON.stringify({
            schemaVersion: 1,
            labels: [
              "Private Product Alpha",
              "Private Product Beta",
              "Private Product Gamma",
            ],
          }),
        ],
        "catalog.json",
        { type: "application/json" },
      ),
    );

    expect(await screen.findByText("3 labels")).toBeTruthy();
    expect(screen.queryByText("Private Product Alpha")).toBeNull();
    expect(
      onStatus.mock.calls.at(-1)?.[0],
    ).not.toContain("Private Product Alpha");
  });

  it("configures the recognizer only after explicit user action", async () => {
    const user = userEvent.setup();
    const onConfigured = vi.fn();

    render(
      <VisualClipRecognizerSetup
        disabled={false}
        onConfigured={onConfigured}
        onStatus={vi.fn()}
      />,
    );

    await user.upload(
      screen.getByLabelText("Candidate product catalog JSON"),
      new File(
        [
          JSON.stringify({
            schemaVersion: 1,
            labels: ["Product A", "Product B", "Product C"],
          }),
        ],
        "catalog.json",
        { type: "application/json" },
      ),
    );

    expect(await screen.findByText("3 labels")).toBeTruthy();
    expect(configureVisualClipRecognizer).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "Load local CLIP recognizer",
      }),
    );

    expect(configureVisualClipRecognizer).toHaveBeenCalledTimes(1);
    expect(onConfigured).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed catalogs without configuring a recognizer", async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();

    render(
      <VisualClipRecognizerSetup
        disabled={false}
        onConfigured={vi.fn()}
        onStatus={onStatus}
      />,
    );

    await user.upload(
      screen.getByLabelText("Candidate product catalog JSON"),
      new File(
        [JSON.stringify({ schemaVersion: 1, labels: ["Only one"] })],
        "bad.json",
        { type: "application/json" },
      ),
    );

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(
        expect.stringContaining("Candidate catalog rejected"),
      );
    });
    expect(screen.getByText("Catalog required")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Load local CLIP recognizer",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
