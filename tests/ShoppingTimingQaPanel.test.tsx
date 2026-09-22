import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShoppingTimingQaPanel } from "../src/qa/ShoppingTimingQaPanel";
import {
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
      screen.getByRole("button", { name: "Confirm fresh session" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Confirm fresh session" }),
    );

    expect(onResetSession).toHaveBeenCalledTimes(1);
  });


});
