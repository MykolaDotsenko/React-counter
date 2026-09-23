import { beforeEach, describe, expect, it } from "vitest";

import {
  QA_FIXTURE_BUDGET_MINOR,
  QA_FIXTURE_BUFFER_MINOR,
  QA_TARGET_PRICE_1250,
  QA_TARGET_PRICE_479,
  LEGACY_QA_TIMING_STORAGE_KEY,
  PREVIOUS_QA_TIMING_STORAGE_KEY,
  QA_TIMING_STORAGE_KEY,
  appendQaTimingSample,
  buildQaTimingExport,
  createQaTimingSession,
  documentQaTimingInterruption,
  loadQaTimingSession,
  parseQaTimingExport,
  qaChecklistComplete,
  resetQaTimingSamples,
  restoreQaTimingSample,
  summarizeQaEmpiricalGate,
  summarizeQaTimingSamples,
  updateQaChecklist,
  updateQaCompactDeviceLabel,
  updateQaDeviceLabel,
  updateQaInputMethodLabel,
  updateQaPhysicalContext,
  updateQaSpotCheck,
  type QaTimingEnvironment,
  type QaTimingSample,
  type QaTimingSession,
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

const completeRequiredPhysicalEvidence = (
  session: QaTimingSession,
): QaTimingSession => {
  let next = updateQaInputMethodLabel(
    session,
    "On-screen custom keypad · one thumb",
  );

  next = updateQaPhysicalContext(next, "oneHanded", true);
  next = updateQaPhysicalContext(
    next,
    "brightStoreLikeLighting",
    true,
  );
  next = updateQaPhysicalContext(next, "defaultTextSize", true);

  return next;
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
  beforeEach(() => {
    sessionStorage.clear();
  });

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

  it("rejects internally inconsistent or non-canonical timing samples", () => {
    const session = createQaTimingSession(environment);

    expect(() =>
      appendQaTimingSample(
        session,
        sample("bad-total", QA_TARGET_PRICE_479, 2_100, {
          unitPriceMinor: 500,
          lineTotalMinor: QA_TARGET_PRICE_479,
        }),
      ),
    ).toThrow("Invalid QA timing sample");

    expect(() =>
      appendQaTimingSample(
        session,
        sample("zero-duration", QA_TARGET_PRICE_479, 0),
      ),
    ).toThrow("Invalid QA timing sample");

    expect(() =>
      appendQaTimingSample(
        session,
        sample("bad-time", QA_TARGET_PRICE_479, 2_100, {
          completedAt: "2026-09-21 12:00:00",
        }),
      ),
    ).toThrow("Invalid QA timing sample");
  });

  it("rejects duplicate timing sample ids", () => {
    const first = appendQaTimingSample(
      createQaTimingSession(environment),
      sample("same-id", QA_TARGET_PRICE_479, 2_100),
    );

    expect(() =>
      appendQaTimingSample(
        first,
        sample("same-id", QA_TARGET_PRICE_1250, 2_200),
      ),
    ).toThrow("Duplicate QA timing sample id");
  });

  it("exports versioned evidence and rejects tampered summaries", () => {
    const session = appendQaTimingSample(
      createQaTimingSession(environment),
      sample("exported", QA_TARGET_PRICE_479, 2_100),
    );
    const exported = buildQaTimingExport(
      session,
      "2026-09-22T12:00:00.000Z",
    );

    expect(exported).toMatchObject({
      schemaVersion: 2,
      kind: "shopping-timing-evidence",
      privacy: {
        networkTransmission: false,
        containsItemNames: false,
        containsStoreHistory: false,
        containsDeviceMetadata: true,
      },
    });
    expect(parseQaTimingExport(exported)).not.toBeNull();

    const tampered = {
      ...exported,
      gate: {
        ...exported.gate,
        b6Eligible: true,
      },
    };

    expect(parseQaTimingExport(tampered)).toBeNull();
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

  it("migrates v2 timing evidence without losing samples or device labels", () => {
    sessionStorage.setItem(
      LEGACY_QA_TIMING_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        environment,
        deviceLabel: "Pixel 8 · Chrome",
        compactDeviceLabel: "iPhone SE · Safari",
        notes: "Existing human evidence",
        checklist: {
          addPriceReachable: true,
          numericKeysReachable: true,
          cancelReachable: true,
          projectionReadable: true,
          reserveWithoutColour: true,
          addPlacementStable: true,
          keypadCloses: true,
          brightSummaryReadable: true,
          softwareKeyboardClear: true,
          repeatedAddNoScroll: true,
          typoCorrectionWorks: true,
          fiveConsecutiveAddsSmooth: true,
          consistentInputMethod: true,
          compactSpotCheckRecorded: true,
        },
        samples: [
          sample("legacy", QA_TARGET_PRICE_479, 2_100),
        ],
      }),
    );

    const restored = loadQaTimingSession(sessionStorage, environment);

    expect(restored.version).toBe(4);
    expect(restored.deviceLabel).toBe("Pixel 8 · Chrome");
    expect(restored.compactDeviceLabel).toBe("iPhone SE · Safari");
    expect(restored.notes).toBe("Existing human evidence");
    expect(restored.samples).toHaveLength(1);
    expect(restored.inputMethodLabel).toBe("");
    expect(restored.physicalContext).toEqual({
      oneHanded: false,
      brightStoreLikeLighting: false,
      defaultTextSize: false,
    });
    expect(restored.spotChecks).toEqual({
      darkAppearance: "not-run",
      largeText200: "not-run",
      reducedMotion: "not-run",
    });
  });

  it("requires explicit input method and primary physical context for release eligibility", () => {
    let session = createQaTimingSession(environment);
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
      b6Eligible: false,
      inputMethodPresent: false,
      physicalContextComplete: false,
    });

    session = completeRequiredPhysicalEvidence(session);

    expect(summarizeQaEmpiricalGate(session)).toMatchObject({
      status: "target-met",
      b6Eligible: true,
      inputMethodPresent: true,
      physicalContextComplete: true,
      secondarySpotChecksRecorded: 0,
      secondarySpotCheckFailures: 0,
    });
  });

  it("does not require optional secondary spot-checks, but a recorded failure blocks release", () => {
    let session = createQaTimingSession(environment);
    session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");
    session = updateQaCompactDeviceLabel(
      session,
      "iPhone SE · Safari",
    );
    session = completeRequiredPhysicalEvidence(session);

    for (const key of Object.keys(session.checklist) as Array<
      keyof typeof session.checklist
    >) {
      session = updateQaChecklist(session, key, true);
    }

    for (let index = 0; index < 10; index += 1) {
      session = appendQaTimingSample(
        session,
        sample(`479-spot-${index}`, QA_TARGET_PRICE_479, 2_100),
      );
      session = appendQaTimingSample(
        session,
        sample(`1250-spot-${index}`, QA_TARGET_PRICE_1250, 2_200),
      );
    }

    expect(summarizeQaEmpiricalGate(session)).toMatchObject({
      status: "target-met",
      b6Eligible: true,
      secondarySpotChecksRecorded: 0,
    });

    session = updateQaSpotCheck(
      session,
      "darkAppearance",
      "fail",
    );

    expect(summarizeQaEmpiricalGate(session)).toMatchObject({
      status: "fail",
      b6Eligible: false,
      secondarySpotChecksRecorded: 1,
      secondarySpotCheckFailures: 1,
    });
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
      b6Eligible: false,
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

    session = completeRequiredPhysicalEvidence(session);

    expect(summarizeQaEmpiricalGate(session)).toMatchObject({
      status: "target-met",
      b6Eligible: true,
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
    releaseFloor = completeRequiredPhysicalEvidence(releaseFloor);

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
      b6Eligible: true,
      ignoredSampleCount: 1,
    });

    let failed = createQaTimingSession(environment);
    failed = updateQaDeviceLabel(failed, "Pixel 8 · Chrome");
    failed = updateQaCompactDeviceLabel(
      failed,
      "Compact phone · Chrome",
    );
    failed = completeRequiredPhysicalEvidence(failed);

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
      b6Eligible: false,
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
      session = completeRequiredPhysicalEvidence(session);

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
    expect(dark.b6Eligible).toBe(false);
    expect(dark.lightAppearanceRecorded).toBe(false);

    const desktop = summarizeQaEmpiricalGate(
      completeSession({
        ...environment,
        viewportWidth: 1_280,
        viewportHeight: 800,
      }),
    );
    expect(desktop.b6Eligible).toBe(false);
    expect(desktop.phonePortraitViewport).toBe(false);
  });

  it("requires a compact phone or equivalent spot-check label", () => {
    let session = createQaTimingSession(environment);
    session = updateQaDeviceLabel(session, "Pixel 8 · Chrome");
    session = completeRequiredPhysicalEvidence(session);

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
    expect(gate.b6Eligible).toBe(false);
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

  it("migrates valid v3 evidence into v4 without inventing exclusions", () => {
    const v3 = {
      version: 3,
      environment,
      deviceLabel: "Pixel 8 · Chrome",
      compactDeviceLabel: "Compact phone · Chrome",
      inputMethodLabel: "Custom keypad · one thumb",
      physicalContext: {
        oneHanded: true,
        brightStoreLikeLighting: true,
        defaultTextSize: true,
      },
      spotChecks: {
        darkAppearance: "not-run",
        largeText200: "not-run",
        reducedMotion: "not-run",
      },
      notes: "",
      checklist: createQaTimingSession(environment).checklist,
      samples: [sample("v3-sample", QA_TARGET_PRICE_479, 2_100)],
    };

    sessionStorage.setItem(
      PREVIOUS_QA_TIMING_STORAGE_KEY,
      JSON.stringify(v3),
    );

    const restored = loadQaTimingSession(sessionStorage, environment);

    expect(restored.version).toBe(4);
    expect(restored.samples).toHaveLength(1);
    expect(restored.exclusions).toEqual([]);
    expect(restored.inputMethodLabel).toBe(
      "Custom keypad · one thumb",
    );
  });

  it("documents external interruptions without deleting captured timing samples", () => {
    let session = createQaTimingSession(environment);

    for (let index = 0; index < 10; index += 1) {
      session = appendQaTimingSample(
        session,
        sample(`base-${index}`, QA_TARGET_PRICE_479, 2_100 + index),
      );
    }

    session = appendQaTimingSample(
      session,
      sample("interrupted", QA_TARGET_PRICE_479, 9_500),
    );

    expect(
      summarizeQaTimingSamples(
        session.samples,
        QA_TARGET_PRICE_479,
        session.exclusions,
      ).count,
    ).toBe(11);

    session = documentQaTimingInterruption(
      session,
      "interrupted",
      "Another person interrupted the timed attempt",
    );

    expect(
      summarizeQaTimingSamples(
        session.samples,
        QA_TARGET_PRICE_479,
        session.exclusions,
      ).count,
    ).toBe(10);
    expect(session.samples).toHaveLength(11);
    expect(session.exclusions).toEqual([
      {
        sampleId: "interrupted",
        reason: "Another person interrupted the timed attempt",
      },
    ]);

    const gate = summarizeQaEmpiricalGate(session);
    expect(gate.documentedInterruptionCount).toBe(1);
    expect(gate.ignoredSampleCount).toBe(1);

    const exported = buildQaTimingExport(
      session,
      "2026-09-23T20:00:00.000Z",
    );
    expect(parseQaTimingExport(exported)).not.toBeNull();
    expect(exported.session.samples).toHaveLength(11);

    session = restoreQaTimingSample(session, "interrupted");
    expect(session.exclusions).toEqual([]);
  });

  it("rejects undocumented, oversized, or unknown timing exclusions", () => {
    const session = appendQaTimingSample(
      createQaTimingSession(environment),
      sample("known", QA_TARGET_PRICE_479, 2_100),
    );

    expect(() =>
      documentQaTimingInterruption(session, "known", "   "),
    ).toThrow("1-240 characters");

    expect(() =>
      documentQaTimingInterruption(session, "known", "x".repeat(241)),
    ).toThrow("1-240 characters");

    expect(() =>
      documentQaTimingInterruption(
        session,
        "missing",
        "External interruption",
      ),
    ).toThrow("unknown QA timing sample");
  });

  it("rejects exported exclusions that reference unknown samples", () => {
    const session = documentQaTimingInterruption(
      appendQaTimingSample(
        createQaTimingSession(environment),
        sample("known", QA_TARGET_PRICE_479, 2_100),
      ),
      "known",
      "External interruption",
    );
    const exported = buildQaTimingExport(
      session,
      "2026-09-23T20:00:00.000Z",
    );

    const tampered = {
      ...exported,
      session: {
        ...exported.session,
        exclusions: [
          {
            sampleId: "missing",
            reason: "External interruption",
          },
        ],
      },
    };

    expect(parseQaTimingExport(tampered)).toBeNull();
  });

});
