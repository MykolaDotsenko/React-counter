import { describe, expect, it } from "vitest";

import {
  QA_FIXTURE_BUDGET_MINOR,
  QA_FIXTURE_BUFFER_MINOR,
  QA_TARGET_PRICE_1250,
  QA_TARGET_PRICE_479,
  QA_TIMING_STORAGE_KEY,
  appendQaTimingSample,
  createQaTimingSession,
  loadQaTimingSession,
  qaChecklistComplete,
  resetQaTimingSamples,
  summarizeQaEmpiricalGate,
  summarizeQaTimingSamples,
  updateQaChecklist,
  updateQaCompactDeviceLabel,
  updateQaDeviceLabel,
  type QaTimingEnvironment,
  type QaTimingSample,
} from "../src/qa/shopping-timing";

const environment: QaTimingEnvironment = {
  userAgent: "test",
  viewportWidth: 390,
  viewportHeight: 844,
  screenWidth: 390,
  screenHeight: 844,
  devicePixelRatio: 3,
  colorScheme: "light",
  reducedMotion: false,
};

const sample = (
  id: string,
  lineTotalMinor: number,
  durationMs: number,
  overrides: Partial<QaTimingSample> = {},
): QaTimingSample => ({
  id,
  durationMs,
  unitPriceMinor: lineTotalMinor,
  quantity: 1,
  lineTotalMinor,
  budgetMinor: QA_FIXTURE_BUDGET_MINOR,
  safetyBufferMinor: QA_FIXTURE_BUFFER_MINOR,
  completedAt: "2026-09-21T12:00:00.000Z",
  ...overrides,
});

describe("shopping timing QA model", () => {
  it("keeps timing evidence separate from product state", () => {
    const session = createQaTimingSession(environment);
    const next = appendQaTimingSample(
      session,
      sample("one", QA_TARGET_PRICE_479, 2_100),
    );

    expect(session.samples).toHaveLength(0);
    expect(next.samples).toHaveLength(1);
    expect(next.environment).toBe(environment);
  });

  it("reports pending until ten representative samples exist", () => {
    let session = createQaTimingSession(environment);

    for (let index = 0; index < 9; index += 1) {
      session = appendQaTimingSample(
        session,
        sample(String(index), QA_TARGET_PRICE_479, 2_100),
      );
    }

    const summary = summarizeQaTimingSamples(
      session.samples,
      QA_TARGET_PRICE_479,
    );

    expect(summary.count).toBe(9);
    expect(summary.status).toBe("pending");
  });

  it("classifies the <=2.5 second median target", () => {
    const durations = [
      2_000, 2_050, 2_100, 2_150, 2_200,
      2_250, 2_300, 2_350, 2_400, 2_450,
    ];
    const samples = durations.map((duration, index) =>
      sample(String(index), QA_TARGET_PRICE_479, duration),
    );

    const summary = summarizeQaTimingSamples(
      samples,
      QA_TARGET_PRICE_479,
    );

    expect(summary.count).toBe(10);
    expect(summary.medianMs).toBe(2_225);
    expect(summary.p75Ms).toBe(2_350);
    expect(summary.maxMs).toBe(2_450);
    expect(summary.status).toBe("target-met");
  });

  it("distinguishes release-floor and failed medians", () => {
    const releaseFloor = Array.from({ length: 10 }, (_, index) =>
      sample(String(index), QA_TARGET_PRICE_1250, 2_700 + index),
    );
    const failed = Array.from({ length: 10 }, (_, index) =>
      sample(String(index), QA_TARGET_PRICE_1250, 3_100 + index),
    );

    expect(
      summarizeQaTimingSamples(releaseFloor, QA_TARGET_PRICE_1250).status,
    ).toBe("release-floor");
    expect(
      summarizeQaTimingSamples(failed, QA_TARGET_PRICE_1250).status,
    ).toBe("fail");
  });

  it("does not mix quantity scenarios into price-only timing", () => {
    const quantitySample: QaTimingSample = {
      ...sample("quantity", QA_TARGET_PRICE_479, 2_000),
      unitPriceMinor: 479,
      quantity: 3,
      lineTotalMinor: 1_437,
    };

    expect(
      summarizeQaTimingSamples(
        [quantitySample],
        QA_TARGET_PRICE_479,
      ).count,
    ).toBe(0);
  });

  it("discards malformed stored evidence instead of trusting it", () => {
    sessionStorage.setItem(
      QA_TIMING_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        environment,
        deviceLabel: "fake",
        compactDeviceLabel: "",
        notes: "",
        checklist: {},
        samples: [
          {
            id: "forged",
            durationMs: -50,
            unitPriceMinor: 479,
            quantity: 1,
            lineTotalMinor: 479,
            budgetMinor: QA_FIXTURE_BUDGET_MINOR,
            safetyBufferMinor: QA_FIXTURE_BUFFER_MINOR,
            completedAt: "not-a-real-sample",
          },
        ],
      }),
    );

    const restored = loadQaTimingSession(sessionStorage, environment);

    expect(restored.samples).toHaveLength(0);
    expect(restored.deviceLabel).toBe("");
  });

  it("keeps the empirical gate pending until timing, device and checklist evidence are complete", () => {
    let session = createQaTimingSession(environment);

    for (let index = 0; index < 10; index += 1) {
      session = appendQaTimingSample(
        session,
        sample(`479-${index}`, QA_TARGET_PRICE_479, 2_100),
      );
      session = appendQaTimingSample(
        session,
        sample(`1250-${index}`, QA_TARGET_PRICE_1250, 2_200),
      );
    }

    expect(summarizeQaEmpiricalGate(session)).toMatchObject({
      status: "pending",
      releaseEligible: false,
      deviceLabelPresent: false,
      checklistComplete: false,
    });

    session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");
    session = updateQaCompactDeviceLabel(
      session,
      "iPhone SE · Safari",
    );

    for (const key of Object.keys(session.checklist) as Array<
      keyof typeof session.checklist
    >) {
      session = updateQaChecklist(session, key, true);
    }

    expect(summarizeQaEmpiricalGate(session)).toMatchObject({
      status: "target-met",
      releaseEligible: true,
      deviceLabelPresent: true,
      compactDeviceLabelPresent: true,
      lightAppearanceRecorded: true,
      phonePortraitViewport: true,
      checklistComplete: true,
      ignoredSampleCount: 0,
    });
  });

  it("reports release-floor and failed empirical outcomes without hiding non-target samples", () => {
    let releaseFloor = createQaTimingSession(environment);
    releaseFloor = updateQaDeviceLabel(
      releaseFloor,
      "Pixel 8 · Chrome",
    );
    releaseFloor = updateQaCompactDeviceLabel(
      releaseFloor,
      "Compact phone · Chrome",
    );

    for (const key of Object.keys(releaseFloor.checklist) as Array<
      keyof typeof releaseFloor.checklist
    >) {
      releaseFloor = updateQaChecklist(releaseFloor, key, true);
    }

    for (let index = 0; index < 10; index += 1) {
      releaseFloor = appendQaTimingSample(
        releaseFloor,
        sample(`479-${index}`, QA_TARGET_PRICE_479, 2_200),
      );
      releaseFloor = appendQaTimingSample(
        releaseFloor,
        sample(`1250-${index}`, QA_TARGET_PRICE_1250, 2_750),
      );
    }

    releaseFloor = appendQaTimingSample(
      releaseFloor,
      sample("other", 999, 2_000),
    );

    expect(summarizeQaEmpiricalGate(releaseFloor)).toMatchObject({
      status: "release-floor",
      releaseEligible: true,
      ignoredSampleCount: 1,
    });

    let failed = createQaTimingSession(environment);
    failed = updateQaDeviceLabel(failed, "Pixel 8 · Chrome");
    failed = updateQaCompactDeviceLabel(
      failed,
      "Compact phone · Chrome",
    );

    for (const key of Object.keys(failed.checklist) as Array<
      keyof typeof failed.checklist
    >) {
      failed = updateQaChecklist(failed, key, true);
    }

    for (let index = 0; index < 10; index += 1) {
      failed = appendQaTimingSample(
        failed,
        sample(`479-${index}`, QA_TARGET_PRICE_479, 3_200),
      );
      failed = appendQaTimingSample(
        failed,
        sample(`1250-${index}`, QA_TARGET_PRICE_1250, 2_200),
      );
    }

    expect(summarizeQaEmpiricalGate(failed)).toMatchObject({
      status: "fail",
      releaseEligible: false,
    });
  });

  it("excludes timing samples captured outside the neutral €500 no-buffer fixture", () => {
    const samples = [
      sample("valid", QA_TARGET_PRICE_479, 2_100),
      sample("wrong-budget", QA_TARGET_PRICE_479, 2_100, {
        budgetMinor: 5_000,
      }),
      sample("with-buffer", QA_TARGET_PRICE_479, 2_100, {
        safetyBufferMinor: 200,
      }),
    ];

    const summary = summarizeQaTimingSamples(
      samples,
      QA_TARGET_PRICE_479,
    );

    expect(summary.count).toBe(1);
  });

  it("keeps release eligibility pending for dark or non-phone timing environments", () => {
    const completeSession = (
      candidateEnvironment: QaTimingEnvironment,
    ) => {
      let session = createQaTimingSession(candidateEnvironment);
      session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");
      session = updateQaCompactDeviceLabel(
        session,
        "Compact phone · Chrome",
      );

      for (const key of Object.keys(session.checklist) as Array<
        keyof typeof session.checklist
      >) {
        session = updateQaChecklist(session, key, true);
      }

      for (let index = 0; index < 10; index += 1) {
        session = appendQaTimingSample(
          session,
          sample(`479-${index}`, QA_TARGET_PRICE_479, 2_100),
        );
        session = appendQaTimingSample(
          session,
          sample(`1250-${index}`, QA_TARGET_PRICE_1250, 2_200),
        );
      }

      return session;
    };

    const dark = summarizeQaEmpiricalGate(
      completeSession({ ...environment, colorScheme: "dark" }),
    );
    expect(dark.releaseEligible).toBe(false);
    expect(dark.lightAppearanceRecorded).toBe(false);

    const desktop = summarizeQaEmpiricalGate(
      completeSession({
        ...environment,
        viewportWidth: 1_280,
        viewportHeight: 800,
      }),
    );
    expect(desktop.releaseEligible).toBe(false);
    expect(desktop.phonePortraitViewport).toBe(false);
  });

  it("requires a compact phone or equivalent spot-check label", () => {
    let session = createQaTimingSession(environment);
    session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");

    for (const key of Object.keys(session.checklist) as Array<
      keyof typeof session.checklist
    >) {
      session = updateQaChecklist(session, key, true);
    }

    for (let index = 0; index < 10; index += 1) {
      session = appendQaTimingSample(
        session,
        sample(`479-${index}`, QA_TARGET_PRICE_479, 2_100),
      );
      session = appendQaTimingSample(
        session,
        sample(`1250-${index}`, QA_TARGET_PRICE_1250, 2_200),
      );
    }

    const gate = summarizeQaEmpiricalGate(session);
    expect(gate.compactDeviceLabelPresent).toBe(false);
    expect(gate.releaseEligible).toBe(false);
  });

  it("tracks the manual checklist independently from timing samples", () => {
    let session = createQaTimingSession(environment);

    expect(qaChecklistComplete(session.checklist)).toBe(false);

    for (const key of Object.keys(session.checklist) as Array<
      keyof typeof session.checklist
    >) {
      session = updateQaChecklist(session, key, true);
    }

    expect(qaChecklistComplete(session.checklist)).toBe(true);

    const reset = resetQaTimingSamples(session);
    expect(reset.samples).toHaveLength(0);
    expect(qaChecklistComplete(reset.checklist)).toBe(true);
  });
});
