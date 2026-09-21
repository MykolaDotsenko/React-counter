import { describe, expect, it } from "vitest";

import {
  QA_TARGET_PRICE_1250,
  QA_TARGET_PRICE_479,
  appendQaTimingSample,
  createQaTimingSession,
  loadQaTimingSession,
  qaChecklistComplete,
  resetQaTimingSamples,
  summarizeQaTimingSamples,
  updateQaChecklist,
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
): QaTimingSample => ({
  id,
  durationMs,
  unitPriceMinor: lineTotalMinor,
  quantity: 1,
  lineTotalMinor,
  completedAt: "2026-09-21T12:00:00.000Z",
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
      "budget-cart:qa:timing-v1",
      JSON.stringify({
        version: 1,
        environment,
        deviceLabel: "fake",
        notes: "",
        checklist: {},
        samples: [
          {
            id: "forged",
            durationMs: -50,
            unitPriceMinor: 479,
            quantity: 1,
            lineTotalMinor: 479,
            completedAt: "not-a-real-sample",
          },
        ],
      }),
    );

    const restored = loadQaTimingSession(sessionStorage, environment);

    expect(restored.samples).toHaveLength(0);
    expect(restored.deviceLabel).toBe("");
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
