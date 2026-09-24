import {
  QA_FIXTURE_BUDGET_MINOR,
  QA_FIXTURE_BUFFER_MINOR,
  QA_TARGET_PRICE_1250,
  QA_TARGET_PRICE_479,
  QA_TARGET_SAMPLE_COUNT,
  parseQaTimingExport,
  type QaTimingExport,
  type QaTimingSample,
} from "./shopping-timing";
import {
  parseBarcodeBenchmarkExport,
  type BarcodeBenchmarkExport,
  type BarcodeBenchmarkSummary,
} from "./barcode-benchmark";
import {
  EVIDENCE_BUILD_REVISION,
  isEvidenceBuildRevision,
} from "./evidence-build";

export interface PairedTimingStats {
  readonly count: number;
  readonly medianMs: number | null;
  readonly p75Ms: number | null;
  readonly p90Ms: number | null;
  readonly maxMs: number | null;
}

export interface PairedTimingComparison {
  readonly medianDeltaMs: number | null;
  readonly p75DeltaMs: number | null;
  readonly p90DeltaMs: number | null;
  readonly medianRatio: number | null;
  readonly p75Ratio: number | null;
  readonly p90Ratio: number | null;
}

export interface BarcodePairedCompatibility {
  readonly fullGitBuildRevision: boolean;
  readonly sameBuildRevision: boolean;
  readonly sameUserAgent: boolean;
  readonly sameViewport: boolean;
  readonly sameDeviceLabel: boolean;
  readonly manualInputMethodPresent: boolean;
  readonly manualPhysicalContextComplete: boolean;
  readonly manualFixtureEvidenceComplete: boolean;
  readonly barcodeConfirmedEvidenceComplete: boolean;
  readonly barcodePreferenceRecorded: boolean;
  readonly barcodeEffortRecorded: boolean;
}

export type BarcodePairedReadiness =
  | "invalid"
  | "incompatible"
  | "incomplete"
  | "ready";

export interface BarcodePairedAnalysisSummary {
  readonly readiness: BarcodePairedReadiness;
  readonly sourceBuildRevision: string | null;
  readonly compatibility: BarcodePairedCompatibility;
  readonly manual479: PairedTimingStats;
  readonly manual1250: PairedTimingStats;
  readonly barcode: BarcodeBenchmarkSummary | null;
  readonly versus479: PairedTimingComparison;
  readonly versus1250: PairedTimingComparison;
  readonly issues: readonly string[];
}

export interface BarcodePairedAnalysisExport {
  readonly schemaVersion: 1;
  readonly kind: "barcode-paired-analysis";
  readonly sourceBuildRevision: string;
  readonly analyzerBuildRevision: string;
  readonly generatedAt: string;
  readonly privacy: {
    readonly containsRawManualSamples: false;
    readonly containsRawBarcodeSamples: false;
    readonly containsRawBarcodes: false;
    readonly containsPrices: false;
    readonly containsFileNames: false;
    readonly networkTransmission: false;
  };
  readonly summary: BarcodePairedAnalysisSummary;
}

const percentile = (
  values: readonly number[],
  fraction: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1),
  );

  return sorted[rank] ?? null;
};

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const lower = sorted[middle - 1];
  const upper = sorted[middle];

  return lower === undefined || upper === undefined
    ? null
    : (lower + upper) / 2;
};

const representativeDurations = (
  report: QaTimingExport,
  lineTotalMinor: number,
): readonly number[] => {
  const excluded = new Set(
    report.session.exclusions.map((entry) => entry.sampleId),
  );

  return report.session.samples
    .filter(
      (sample: QaTimingSample) =>
        !excluded.has(sample.id) &&
        sample.quantity === 1 &&
        sample.unitPriceMinor === lineTotalMinor &&
        sample.lineTotalMinor === lineTotalMinor &&
        sample.budgetMinor === QA_FIXTURE_BUDGET_MINOR &&
        sample.safetyBufferMinor === QA_FIXTURE_BUFFER_MINOR,
    )
    .map((sample) => sample.durationMs);
};

const summarizeDurations = (
  durations: readonly number[],
): PairedTimingStats => ({
  count: durations.length,
  medianMs: median(durations),
  p75Ms: percentile(durations, 0.75),
  p90Ms: percentile(durations, 0.9),
  maxMs:
    durations.length === 0 ? null : Math.max(...durations),
});

const delta = (
  barcode: number | null,
  manual: number | null,
): number | null =>
  barcode === null || manual === null ? null : barcode - manual;

const ratio = (
  barcode: number | null,
  manual: number | null,
): number | null =>
  barcode === null || manual === null || manual <= 0
    ? null
    : barcode / manual;

const compareTiming = (
  barcode: {
    readonly medianMs: number | null;
    readonly p75Ms: number | null;
    readonly p90Ms: number | null;
  },
  manual: PairedTimingStats,
): PairedTimingComparison => ({
  medianDeltaMs: delta(barcode.medianMs, manual.medianMs),
  p75DeltaMs: delta(barcode.p75Ms, manual.p75Ms),
  p90DeltaMs: delta(barcode.p90Ms, manual.p90Ms),
  medianRatio: ratio(barcode.medianMs, manual.medianMs),
  p75Ratio: ratio(barcode.p75Ms, manual.p75Ms),
  p90Ratio: ratio(barcode.p90Ms, manual.p90Ms),
});

const emptyTiming = (): PairedTimingStats => ({
  count: 0,
  medianMs: null,
  p75Ms: null,
  p90Ms: null,
  maxMs: null,
});

const emptyComparison = (): PairedTimingComparison => ({
  medianDeltaMs: null,
  p75DeltaMs: null,
  p90DeltaMs: null,
  medianRatio: null,
  p75Ratio: null,
  p90Ratio: null,
});

const normalizedLabel = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const manualPhysicalContextComplete = (
  report: QaTimingExport,
): boolean =>
  report.session.physicalContext.oneHanded &&
  report.session.physicalContext.brightStoreLikeLighting &&
  report.session.physicalContext.defaultTextSize;

export const analyzeBarcodePairedEvidence = (
  manualValue: unknown,
  barcodeValue: unknown,
): BarcodePairedAnalysisSummary => {
  const manual = parseQaTimingExport(manualValue);
  const barcode = parseBarcodeBenchmarkExport(barcodeValue);

  if (manual === null || barcode === null) {
    const issues = [
      ...(manual === null ? ["Manual timing JSON is invalid or tampered."] : []),
      ...(barcode === null ? ["Barcode benchmark JSON is invalid or tampered."] : []),
    ];

    return Object.freeze({
      readiness: "invalid",
      sourceBuildRevision: null,
      compatibility: Object.freeze({
        fullGitBuildRevision: false,
        sameBuildRevision: false,
        sameUserAgent: false,
        sameViewport: false,
        sameDeviceLabel: false,
        manualInputMethodPresent: false,
        manualPhysicalContextComplete: false,
        manualFixtureEvidenceComplete: false,
        barcodeConfirmedEvidenceComplete: false,
        barcodePreferenceRecorded: false,
        barcodeEffortRecorded: false,
      }),
      manual479: emptyTiming(),
      manual1250: emptyTiming(),
      barcode: null,
      versus479: emptyComparison(),
      versus1250: emptyComparison(),
      issues: Object.freeze(issues),
    });
  }

  const manual479 = summarizeDurations(
    representativeDurations(manual, QA_TARGET_PRICE_479),
  );
  const manual1250 = summarizeDurations(
    representativeDurations(manual, QA_TARGET_PRICE_1250),
  );

  const fullGitSha = /^[0-9a-f]{40}$/;
  const compatibility: BarcodePairedCompatibility = Object.freeze({
    fullGitBuildRevision:
      fullGitSha.test(manual.buildRevision) &&
      fullGitSha.test(barcode.buildRevision),
    sameBuildRevision: manual.buildRevision === barcode.buildRevision,
    sameUserAgent:
      manual.session.environment.userAgent ===
      barcode.session.environment.userAgent,
    sameViewport:
      manual.session.environment.viewportWidth ===
        barcode.session.environment.viewportWidth &&
      manual.session.environment.viewportHeight ===
        barcode.session.environment.viewportHeight,
    sameDeviceLabel:
      normalizedLabel(manual.session.deviceLabel).length > 0 &&
      normalizedLabel(manual.session.deviceLabel) ===
        normalizedLabel(barcode.session.deviceLabel),
    manualInputMethodPresent:
      manual.session.inputMethodLabel.trim().length > 0,
    manualPhysicalContextComplete: manualPhysicalContextComplete(manual),
    manualFixtureEvidenceComplete:
      manual479.count >= QA_TARGET_SAMPLE_COUNT &&
      manual1250.count >= QA_TARGET_SAMPLE_COUNT,
    barcodeConfirmedEvidenceComplete:
      barcode.summary.confirmed >= 10,
    barcodePreferenceRecorded:
      barcode.summary.preference !== null,
    barcodeEffortRecorded:
      barcode.summary.effort !== null,
  });

  const hardCompatibility =
    compatibility.fullGitBuildRevision &&
    compatibility.sameBuildRevision &&
    compatibility.sameUserAgent &&
    compatibility.sameViewport &&
    compatibility.sameDeviceLabel;

  const evidenceComplete =
    compatibility.manualInputMethodPresent &&
    compatibility.manualPhysicalContextComplete &&
    compatibility.manualFixtureEvidenceComplete &&
    compatibility.barcodeConfirmedEvidenceComplete &&
    compatibility.barcodePreferenceRecorded &&
    compatibility.barcodeEffortRecorded;

  const issues: string[] = [];

  if (!compatibility.fullGitBuildRevision) {
    issues.push("Field comparison requires full 40-character Git SHA build revisions.");
  }
  if (!compatibility.sameBuildRevision) {
    issues.push("Manual and barcode exports use different buildRevision values.");
  }
  if (!compatibility.sameUserAgent) {
    issues.push("Manual and barcode exports use different browser user agents.");
  }
  if (!compatibility.sameViewport) {
    issues.push("Manual and barcode exports use different viewport dimensions.");
  }
  if (!compatibility.sameDeviceLabel) {
    issues.push("Manual and barcode device labels are missing or do not match.");
  }
  if (!compatibility.manualInputMethodPresent) {
    issues.push("Manual timing evidence does not declare one input method.");
  }
  if (!compatibility.manualPhysicalContextComplete) {
    issues.push("Manual timing physical-context checklist is incomplete.");
  }
  if (!compatibility.manualFixtureEvidenceComplete) {
    issues.push(
      `Manual timing requires at least ${QA_TARGET_SAMPLE_COUNT} valid samples for both EUR 4.79 and EUR 12.50.`,
    );
  }
  if (!compatibility.barcodeConfirmedEvidenceComplete) {
    issues.push("Barcode benchmark requires at least 10 confirmed attempts.");
  }
  if (!compatibility.barcodePreferenceRecorded) {
    issues.push("Barcode repeated-use preference is not recorded.");
  }
  if (!compatibility.barcodeEffortRecorded) {
    issues.push("Barcode cognitive-effort score is not recorded.");
  }

  const readiness: BarcodePairedReadiness = !hardCompatibility
    ? "incompatible"
    : evidenceComplete
      ? "ready"
      : "incomplete";

  const barcodeTiming = {
    medianMs: barcode.summary.medianConfirmedMs,
    p75Ms: barcode.summary.p75ConfirmedMs,
    p90Ms: barcode.summary.p90ConfirmedMs,
  };

  return Object.freeze({
    readiness,
    sourceBuildRevision: compatibility.sameBuildRevision
      ? manual.buildRevision
      : null,
    compatibility,
    manual479,
    manual1250,
    barcode: barcode.summary,
    versus479: compareTiming(barcodeTiming, manual479),
    versus1250: compareTiming(barcodeTiming, manual1250),
    issues: Object.freeze(issues),
  });
};

const isCanonicalIsoTimestamp = (value: string): boolean => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

export const buildBarcodePairedAnalysisExport = (
  summary: BarcodePairedAnalysisSummary,
  generatedAt: string,
): BarcodePairedAnalysisExport => {
  if (
    summary.readiness !== "ready" ||
    summary.sourceBuildRevision === null ||
    !isEvidenceBuildRevision(summary.sourceBuildRevision) ||
    !isCanonicalIsoTimestamp(generatedAt)
  ) {
    throw new RangeError(
      "Paired analysis export requires ready compatible evidence",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "barcode-paired-analysis",
    sourceBuildRevision: summary.sourceBuildRevision,
    analyzerBuildRevision: EVIDENCE_BUILD_REVISION,
    generatedAt,
    privacy: Object.freeze({
      containsRawManualSamples: false,
      containsRawBarcodeSamples: false,
      containsRawBarcodes: false,
      containsPrices: false,
      containsFileNames: false,
      networkTransmission: false,
    }),
    summary,
  });
};
