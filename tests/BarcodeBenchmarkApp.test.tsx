import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/qa/BarcodeBenchmarkApp";
import {
  BARCODE_BENCHMARK_STORAGE_KEY,
  createBarcodeBenchmarkSession,
  persistBarcodeBenchmarkSession,
} from "../src/qa/barcode-benchmark";
import { captureBarcodeBenchmarkEnvironment } from "../src/qa/barcode-benchmark-native";

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

    const startCamera = screen.getByRole("button", {
      name: "Start camera",
    });

    await user.click(startCamera);
    await user.click(startCamera);

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "BarcodeDetector is unavailable",
      );
    });

    const stored = localStorage.getItem(BARCODE_BENCHMARK_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.failures).toEqual([
      expect.objectContaining({
        type: "detector-unsupported",
      }),
    ]);
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


  it("downloads a privacy-safe benchmark export with a non-identifying filename", async () => {
    const user = userEvent.setup();
    const createdBlobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return "blob:barcode-benchmark";
    });
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
      render(<App />);

      await screen.findByRole("heading", {
        name: "Barcode interaction benchmark",
      });

      await user.click(
        screen.getByRole("button", {
          name: "Download benchmark JSON",
        }),
      );

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(downloadedFileName).toMatch(
        /^barcode-benchmark-\d{8}T\d{9}Z\.json$/,
      );
      expect(revokeObjectURL).toHaveBeenCalledWith(
        "blob:barcode-benchmark",
      );

      const blob = createdBlobs[0];

      if (blob === undefined) {
        throw new Error("Expected benchmark download blob");
      }

      const exported = await blob.text();

      expect(exported).toContain(
        '"kind": "barcode-benchmark-evidence"',
      );
      expect(exported).toContain(
        '"containsRawBarcodes": false',
      );
      expect(exported).not.toContain('"rawValue"');
    } finally {
      click.mockRestore();
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  it("keeps export failure inside the evidence UI when device time predates retained evidence", async () => {
    const user = userEvent.setup();
    const currentEnvironment =
      await captureBarcodeBenchmarkEnvironment();
    const retained = createBarcodeBenchmarkSession(
      currentEnvironment,
      "2099-01-01T08:00:00.000Z",
    );

    persistBarcodeBenchmarkSession(localStorage, retained);

    render(<App />);

    await screen.findByRole("heading", {
      name: "Barcode interaction benchmark",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Copy privacy-safe benchmark JSON",
      }),
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Benchmark export unavailable",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "device date and time",
    );
  });

});
