import { describe, expect, it } from "vitest";

import {
  BARCODE_BENCHMARK_FAILURE_LIMIT,
  BARCODE_BENCHMARK_SAMPLE_LIMIT,
  BARCODE_BENCHMARK_STORAGE_KEY,
  appendBarcodeBenchmarkFailure,
  appendBarcodeBenchmarkSample,
  buildBarcodeBenchmarkExport,
  createBarcodeBenchmarkSession,
  loadBarcodeBenchmarkSession,
  parseBarcodeBenchmarkExport,
  persistBarcodeBenchmarkSession,
  sameBarcodeBenchmarkEnvironment,
  summarizeBarcodeBenchmark,
  updateBarcodeBenchmarkSubjective,
  type BarcodeBenchmarkEnvironment,
  type BarcodeBenchmarkSample,
} from "../src/qa/barcode-benchmark";

const CREATED = "2026-09-24T08:00:00.000Z";
const environment: BarcodeBenchmarkEnvironment = {
  userAgent: "Benchmark Browser",
  viewportWidth: 390,
  viewportHeight: 844,
  detectorSupported: true,
  cameraSupported: true,
  supportedFormats: ["ean_13", "ean_8"],
};

const sample = (
  id: string,
  outcome: BarcodeBenchmarkSample["outcome"],
  durationMs: number,
  detectedFormat: string | null = null,
): BarcodeBenchmarkSample => ({
  id,
  startedAt: "2026-09-24T08:01:00.000Z",
  completedAt: "2026-09-24T08:01:05.000Z",
  durationMs,
  outcome,
  detectedFormat,
});

const storage = () => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

describe("barcode benchmark evidence", () => {
  it("summarizes end-to-end scan outcomes and confirmed percentiles", () => {
    let session = createBarcodeBenchmarkSession(environment, CREATED);

    for (const candidate of [
      sample("a", "confirmed", 1_800, "ean_13"),
      sample("b", "confirmed", 2_200, "ean_13"),
      sample("c", "confirmed", 3_000, "ean_8"),
      sample("d", "rejected", 2_500, "ean_13"),
      sample("e", "timeout", 8_000),
      sample("f", "manual-fallback", 4_000),
      sample("g", "detector-error", 900),
    ]) {
      session = appendBarcodeBenchmarkSample(session, candidate);
    }

    session = updateBarcodeBenchmarkSubjective(
      session,
      "scanner",
      2,
    );

    expect(summarizeBarcodeBenchmark(session)).toEqual({
      attempts: 7,
      confirmed: 3,
      rejected: 1,
      timeouts: 1,
      manualFallbacks: 1,
      medianConfirmedMs: 2_200,
      p75ConfirmedMs: 3_000,
      p90ConfirmedMs: 3_000,
      recognitionFailureRate: 2 / 7,
      correctionRate: 1 / 4,
      fallbackRate: 1 / 7,
      detectorUnsupported: 0,
      cameraUnsupported: 0,
      permissionDenied: 0,
      cameraErrors: 0,
      detectorErrors: 1,
      preference: "scanner",
      effort: 2,
    });
  });

  it("tracks capability and permission failures separately from scan attempts", () => {
    let session = createBarcodeBenchmarkSession(environment, CREATED);

    session = appendBarcodeBenchmarkFailure(session, {
      type: "permission-denied",
      at: "2026-09-24T08:02:00.000Z",
    });
    session = appendBarcodeBenchmarkFailure(session, {
      type: "camera-error",
      at: "2026-09-24T08:03:00.000Z",
    });

    expect(summarizeBarcodeBenchmark(session)).toMatchObject({
      attempts: 0,
      recognitionFailureRate: null,
      permissionDenied: 1,
      cameraErrors: 1,
    });
  });

  it("rejects duplicate IDs, inconsistent formats and undeclared raw barcode fields", () => {
    const base = createBarcodeBenchmarkSession(environment, CREATED);
    const confirmed = sample(
      "same",
      "confirmed",
      2_000,
      "ean_13",
    );
    const once = appendBarcodeBenchmarkSample(base, confirmed);

    expect(() =>
      appendBarcodeBenchmarkSample(once, confirmed),
    ).toThrow("Duplicate");

    expect(() =>
      appendBarcodeBenchmarkSample(
        base,
        sample("missing-format", "confirmed", 2_000),
      ),
    ).toThrow("Invalid");

    expect(() =>
      appendBarcodeBenchmarkSample(
        base,
        {
          ...sample("raw", "confirmed", 2_000, "ean_13"),
          rawValue: "6412345678901",
        } as BarcodeBenchmarkSample,
      ),
    ).toThrow("Invalid");
  });

  it("persists only validated local evidence", () => {
    const store = storage();
    let session = createBarcodeBenchmarkSession(environment, CREATED);
    session = appendBarcodeBenchmarkSample(
      session,
      sample("one", "confirmed", 2_100, "ean_13"),
    );

    persistBarcodeBenchmarkSession(store, session);

    expect(store.values.has(BARCODE_BENCHMARK_STORAGE_KEY)).toBe(true);
    expect(
      loadBarcodeBenchmarkSession(
        store,
        environment,
        "2026-09-24T09:00:00.000Z",
      ),
    ).toEqual(session);

    store.setItem(BARCODE_BENCHMARK_STORAGE_KEY, "{broken");

    expect(
      loadBarcodeBenchmarkSession(
        store,
        environment,
        "2026-09-24T09:00:00.000Z",
      ).samples,
    ).toEqual([]);
  });

  it("exports privacy-safe evidence and recomputes derived summary", () => {
    let session = createBarcodeBenchmarkSession(environment, CREATED);
    session = appendBarcodeBenchmarkSample(
      session,
      sample("one", "confirmed", 2_100, "ean_13"),
    );

    const evidence = buildBarcodeBenchmarkExport(
      session,
      "2026-09-24T09:00:00.000Z",
    );
    const raw = JSON.stringify(evidence);

    expect(evidence).toMatchObject({
      schemaVersion: 2,
      buildRevision: "local-dev",
    });
    expect(evidence.privacy).toEqual({
      networkTransmission: false,
      containsRawBarcodes: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    });
    expect(raw).not.toContain("rawValue");
    expect(raw).not.toContain("6412345678901");
    expect(parseBarcodeBenchmarkExport(evidence)).toEqual(evidence);

    const withoutRevision = { ...evidence } as Record<string, unknown>;
    delete withoutRevision.buildRevision;

    expect(parseBarcodeBenchmarkExport(withoutRevision)).toBeNull();
    expect(
      parseBarcodeBenchmarkExport({
        ...evidence,
        buildRevision: "not-a-git-revision",
      }),
    ).toBeNull();

    expect(
      parseBarcodeBenchmarkExport({
        ...evidence,
        summary: {
          ...evidence.summary,
          confirmed: 999,
        },
      }),
    ).toBeNull();
  });

  it("rejects exports whose observation end predates evidence", () => {
    const session = appendBarcodeBenchmarkSample(
      createBarcodeBenchmarkSession(environment, CREATED),
      sample("one", "confirmed", 2_100, "ean_13"),
    );

    expect(() =>
      buildBarcodeBenchmarkExport(
        session,
        "2026-09-24T08:00:30.000Z",
      ),
    ).toThrow("observation end");
  });

  it("treats environment identity as exact benchmark context", () => {
    expect(
      sameBarcodeBenchmarkEnvironment(environment, {
        ...environment,
        supportedFormats: ["ean_13", "ean_8"],
      }),
    ).toBe(true);

    expect(
      sameBarcodeBenchmarkEnvironment(environment, {
        ...environment,
        viewportWidth: 844,
        viewportHeight: 390,
      }),
    ).toBe(false);

    expect(
      sameBarcodeBenchmarkEnvironment(environment, {
        ...environment,
        supportedFormats: ["ean_8", "ean_13"],
      }),
    ).toBe(false);
  });

  it("keeps long human-confirm attempts as evidence instead of silently dropping them", () => {
    const session = appendBarcodeBenchmarkSample(
      createBarcodeBenchmarkSession(environment, CREATED),
      sample("long-confirm", "confirmed", 120_000, "ean_13"),
    );

    expect(session.samples[0]?.durationMs).toBe(120_000);
  });


  it("fails closed at evidence limits instead of dropping earlier records", () => {
    let samplesSession = createBarcodeBenchmarkSession(
      environment,
      CREATED,
    );

    for (
      let index = 0;
      index < BARCODE_BENCHMARK_SAMPLE_LIMIT;
      index += 1
    ) {
      samplesSession = appendBarcodeBenchmarkSample(
        samplesSession,
        sample(
          `sample-${index}`,
          "confirmed",
          2_000,
          "ean_13",
        ),
      );
    }

    expect(samplesSession.samples).toHaveLength(
      BARCODE_BENCHMARK_SAMPLE_LIMIT,
    );
    expect(samplesSession.samples[0]?.id).toBe("sample-0");

    expect(() =>
      appendBarcodeBenchmarkSample(
        samplesSession,
        sample(
          "overflow",
          "confirmed",
          2_000,
          "ean_13",
        ),
      ),
    ).toThrow("sample limit reached");

    let failuresSession = createBarcodeBenchmarkSession(
      environment,
      CREATED,
    );

    for (
      let index = 0;
      index < BARCODE_BENCHMARK_FAILURE_LIMIT;
      index += 1
    ) {
      failuresSession = appendBarcodeBenchmarkFailure(
        failuresSession,
        {
          type: "camera-error",
          at: "2026-09-24T08:02:00.000Z",
        },
      );
    }

    expect(failuresSession.failures).toHaveLength(
      BARCODE_BENCHMARK_FAILURE_LIMIT,
    );

    expect(() =>
      appendBarcodeBenchmarkFailure(failuresSession, {
        type: "camera-error",
        at: "2026-09-24T08:02:00.000Z",
      }),
    ).toThrow("failure limit reached");
  });

});
