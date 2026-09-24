import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShoppingTimingQaPanel } from "../src/qa/ShoppingTimingQaPanel";
import {
  appendQaTimingSample,
  createQaTimingSession,
  type QaTimingEnvironment,
} from "../src/qa/shopping-timing";

const environment: QaTimingEnvironment = {
  userAgent: "component-test",
  viewportWidth: 390,
  viewportHeight: 844,
  screenWidth: 390,
  screenHeight: 844,
  devicePixelRatio: 3,
  colorScheme: "light",
  reducedMotion: false,
};

describe("ShoppingTimingQaPanel", () => {
  it("captures structured primary and secondary physical evidence", async () => {
    const user = userEvent.setup();
    const onInputMethodLabelChange = vi.fn();
    const onPhysicalContextChange = vi.fn();
    const onSpotCheckChange = vi.fn();

    render(
      <ShoppingTimingQaPanel
        session={createQaTimingSession(environment)}
        onChecklistChange={vi.fn()}
        onDeviceLabelChange={vi.fn()}
        onCompactDeviceLabelChange={vi.fn()}
        onInputMethodLabelChange={onInputMethodLabelChange}
        onPhysicalContextChange={onPhysicalContextChange}
        onSpotCheckChange={onSpotCheckChange}
        onNotesChange={vi.fn()}
        onDocumentInterruption={vi.fn()}
        onRestoreSample={vi.fn()}
        onResetSamples={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );

    expect(document.title).toBe(
      "Shopping Budget Companion — Empirical Timing QA",
    );
    expect(
      document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      )?.content,
    ).toBe(
      "Internal Shopping Budget Companion empirical timing and one-hand usability QA.",
    );

    await user.click(screen.getByRole("button", { name: "QA 0/20" }));

    const inputMethod = screen.getByRole("textbox", {
      name: "Comparable timing input method",
    });
    fireEvent.change(inputMethod, {
      target: { value: "Custom keypad" },
    });

    expect(onInputMethodLabelChange).toHaveBeenLastCalledWith(
      "Custom keypad",
    );

    const oneHanded = screen.getByRole("checkbox", {
      name: "Primary timing set was completed one-handed",
    });
    await user.click(oneHanded);

    expect(onPhysicalContextChange).toHaveBeenCalledWith(
      "oneHanded",
      true,
    );

    const darkAppearance = screen.getByRole("combobox", {
      name: "Dark appearance",
    });
    await user.selectOptions(darkAppearance, "pass");

    expect(onSpotCheckChange).toHaveBeenCalledWith(
      "darkAppearance",
      "pass",
    );
  });

  it("keeps the physical evidence fields visible in the exported QA surface", async () => {
    const user = userEvent.setup();
    const session = {
      ...createQaTimingSession(environment),
      inputMethodLabel: "Custom keypad · one thumb",
      physicalContext: {
        oneHanded: true,
        brightStoreLikeLighting: true,
        defaultTextSize: true,
      },
      spotChecks: {
        darkAppearance: "pass" as const,
        largeText200: "not-run" as const,
        reducedMotion: "fail" as const,
      },
    };

    render(
      <ShoppingTimingQaPanel
        session={session}
        onChecklistChange={vi.fn()}
        onDeviceLabelChange={vi.fn()}
        onCompactDeviceLabelChange={vi.fn()}
        onInputMethodLabelChange={vi.fn()}
        onPhysicalContextChange={vi.fn()}
        onSpotCheckChange={vi.fn()}
        onNotesChange={vi.fn()}
        onDocumentInterruption={vi.fn()}
        onRestoreSample={vi.fn()}
        onResetSamples={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "QA 0/20" }));

    expect(
      (
        screen.getByRole("textbox", {
          name: "Comparable timing input method",
        }) as HTMLInputElement
      ).value,
    ).toBe("Custom keypad · one thumb");

    expect(
      (
        screen.getByRole("checkbox", {
          name: "Primary timing set was completed one-handed",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);

    expect(
      (
        screen.getByRole("combobox", {
          name: "Dark appearance",
        }) as HTMLSelectElement
      ).value,
    ).toBe("pass");
    expect(
      (
        screen.getByRole("combobox", {
          name: "Reduced motion",
        }) as HTMLSelectElement
      ).value,
    ).toBe("fail");
  });
  it("requires confirmation before starting a fresh QA session", async () => {
    const user = userEvent.setup();
    const onResetSession = vi.fn();

    render(
      <ShoppingTimingQaPanel
        session={createQaTimingSession(environment)}
        onChecklistChange={vi.fn()}
        onDeviceLabelChange={vi.fn()}
        onCompactDeviceLabelChange={vi.fn()}
        onInputMethodLabelChange={vi.fn()}
        onPhysicalContextChange={vi.fn()}
        onSpotCheckChange={vi.fn()}
        onNotesChange={vi.fn()}
        onDocumentInterruption={vi.fn()}
        onRestoreSample={vi.fn()}
        onResetSamples={vi.fn()}
        onResetSession={onResetSession}
      />,
    );

    await user.click(screen.getByRole("button", { name: "QA 0/20" }));
    await user.click(
      screen.getByRole("button", { name: "Start fresh QA session" }),
    );

    expect(onResetSession).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Confirm fresh session" }).textContent,
    ).toBe("Confirm fresh session");

    await user.click(
      screen.getByRole("button", { name: "Confirm fresh session" }),
    );

    expect(onResetSession).toHaveBeenCalledTimes(1);
  });



  it("requires a reason before a sample can be excluded as an external interruption", async () => {
    const user = userEvent.setup();
    const onDocumentInterruption = vi.fn();
    const session = appendQaTimingSample(
      createQaTimingSession(environment),
      {
        id: "sample-1",
        durationMs: 2_450,
        unitPriceMinor: 479,
        quantity: 1,
        lineTotalMinor: 479,
        budgetMinor: 50_000,
        safetyBufferMinor: 0,
        completedAt: "2026-09-23T20:00:00.000Z",
      },
    );

    render(
      <ShoppingTimingQaPanel
        session={session}
        onChecklistChange={vi.fn()}
        onDeviceLabelChange={vi.fn()}
        onCompactDeviceLabelChange={vi.fn()}
        onInputMethodLabelChange={vi.fn()}
        onPhysicalContextChange={vi.fn()}
        onSpotCheckChange={vi.fn()}
        onNotesChange={vi.fn()}
        onDocumentInterruption={onDocumentInterruption}
        onRestoreSample={vi.fn()}
        onResetSamples={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "QA 1/20" }));
    await user.click(
      screen.getByText("Timing sample audit · 1 recorded"),
    );

    const exclude = screen.getByRole("button", {
      name: "Exclude interruption",
    });
    expect((exclude as HTMLButtonElement).disabled).toBe(true);

    await user.type(
      screen.getByRole("textbox", {
        name: "External interruption reason for €4.79",
      }),
      "Someone interrupted the timed attempt",
    );

    expect((exclude as HTMLButtonElement).disabled).toBe(false);
    await user.click(exclude);

    expect(onDocumentInterruption).toHaveBeenCalledWith(
      "sample-1",
      "Someone interrupted the timed attempt",
    );
  });


  it("downloads versioned timing evidence and revokes the object URL", async () => {
    const user = userEvent.setup();
    const createdBlobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return "blob:timing-evidence";
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
      render(
        <ShoppingTimingQaPanel
          session={createQaTimingSession(environment)}
          onChecklistChange={vi.fn()}
          onDeviceLabelChange={vi.fn()}
          onCompactDeviceLabelChange={vi.fn()}
          onInputMethodLabelChange={vi.fn()}
          onPhysicalContextChange={vi.fn()}
          onSpotCheckChange={vi.fn()}
          onNotesChange={vi.fn()}
          onDocumentInterruption={vi.fn()}
          onRestoreSample={vi.fn()}
          onResetSamples={vi.fn()}
          onResetSession={vi.fn()}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "QA 0/20" }),
      );
      await user.click(
        screen.getByRole("button", {
          name: "Download JSON results",
        }),
      );

      expect(downloadedFileName).toMatch(
        /^shopping-timing-\d{8}T\d{9}Z\.json$/,
      );
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(
        "blob:timing-evidence",
      );

      const blob = createdBlobs[0];

      if (blob === undefined) {
        throw new Error("Expected timing evidence download blob");
      }

      const exported = JSON.parse(await blob.text());

      expect(exported).toMatchObject({
        schemaVersion: 3,
        kind: "shopping-timing-evidence",
        buildRevision: "local-dev",
      });
    } finally {
      click.mockRestore();
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

});
