import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/qa/BarcodeBenchmarkApp";
import {
  BARCODE_BENCHMARK_STORAGE_KEY,
  createBarcodeBenchmarkSession,
  persistBarcodeBenchmarkSession,
} from "../src/qa/barcode-benchmark";

describe("BarcodeBenchmarkApp", () => {
  afterEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(globalThis, "BarcodeDetector");
  });

  it("degrades to a documented unsupported state without changing shopping UI", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Barcode interaction benchmark",
      }),
    ).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Add price" })).toBeNull();
    expect(screen.getByText("Detector unavailable")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Start camera" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "BarcodeDetector is unavailable",
      );
    });

    const stored = localStorage.getItem(BARCODE_BENCHMARK_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(stored).toContain("detector-unsupported");
  });

  it("states the privacy boundary that raw codes are not exported", async () => {
    render(<App />);

    await screen.findByRole("heading", {
      name: "Barcode interaction benchmark",
    });

    expect(
      screen.getByText(/contains no raw barcode value/i),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Copy privacy-safe benchmark JSON",
      }),
    ).toBeTruthy();
  });

  it("freezes retained evidence when the benchmark environment changes", async () => {
    const retained = createBarcodeBenchmarkSession(
      {
        userAgent: "Different benchmark browser",
        viewportWidth: 390,
        viewportHeight: 844,
        detectorSupported: false,
        cameraSupported: false,
        supportedFormats: [],
      },
      "2026-09-24T07:00:00.000Z",
    );

    persistBarcodeBenchmarkSession(localStorage, retained);

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Benchmark environment changed",
      }),
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: "Start camera" }),
    ).toBeNull();

    expect(
      screen.getByRole("button", {
        name: "Copy privacy-safe benchmark JSON",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Start fresh benchmark session",
      }),
    ).toBeTruthy();

    expect(
      (screen.getByRole("textbox", {
        name: "Device / browser label",
      }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

});
