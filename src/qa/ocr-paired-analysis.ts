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
  parseShelfLabelOcrExport,
  type ShelfLabelOcrDataBoundary,
  type ShelfLabelOcrSummary,
} from "./shelf-label-ocr-benchmark";
import {
  EVIDENCE_BUILD_REVISION,
  isImmutableEvidenceBuildRevision,
} from "./evidence-build";

export const OCR_PAIRED_MIN_ATTEMPTS = 10;
export const OCR_PAIRED_MIN_DECISIONS = 10;

export interface OcrPairedTimingStats {
  readonly count: number;
  readonly medianMs: number | null;
  readonly p75Ms: number | null;
  readonly p90Ms: number | null;
  readonly maxMs: number | null;
}

export interface OcrPairedTimingComparison {
  readonly medianDeltaMs: number | null;
  readonly p75DeltaMs: number | null;
  readonly p90DeltaMs: number | null;
  readonly medianRatio: number | null;
  readonly p75Ratio: number | null;
  readonly p90Ratio: number | null;
}

export interface OcrPairedCompatibility {
  readonly fullGitBuildRevision: boolean;
  readonly sameBuildRevision: boolean;
  readonly sameUserAgent: boolean;
  readonly sameViewport: boolean;
  readonly sameDeviceLabel: boolean;
  readonly manualInputMethodPresent: boolean;
  readonly manualPhysicalContextComplete: boolean;
  readonly manualLightAppearanceRecorded: boolean;
  readonly manualPhonePortraitViewport: boolean;
  readonly manualFixtureEvidenceComplete: boolean;
  readonly ocrEnginePresent: boolean;
  readonly ocrAttemptEvidenceComplete: boolean;
  readonly ocrDecisionEvidenceComplete: boolean;
  readonly ocrPreferenceRecorded: boolean;
  readonly ocrEffortRecorded: boolean;
}

export type OcrPairedReadiness =
  | "invalid"
  | "incompatible"
  | "incomplete"
  | "ready";

export interface OcrPairedAnalysisSummary {
  readonly readiness: OcrPairedReadiness;
  readonly sourceBuildRevision: string | null;
  readonly compatibility: OcrPairedCompatibility;
  readonly manualLowFixture: OcrPairedTimingStats;
  readonly manualHighFixture: OcrPairedTimingStats;
  readonly ocr: ShelfLabelOcrSummary | null;
  readonly ocrEngineId: string | null;
  readonly ocrDataBoundary: ShelfLabelOcrDataBoundary | null;
  readonly versusLowFixture: OcrPairedTimingComparison;
  readonly versusHighFixture: OcrPairedTimingComparison;
  readonly issues: readonly string[];
}

export interface OcrPairedAnalysisExport {
  readonly schemaVersion: 1;
  readonly kind: "ocr-paired-analysis";
  readonly sourceBuildRevision: string;
  readonly analyzerBuildRevision: string;
  readonly generatedAt: string;
  readonly privacy: {
    readonly containsRawManualSamples: false;
    readonly containsRawOcrSamples: false;
    readonly containsRawImages: false;
    readonly containsRawOcrText: false;
    readonly containsPrices: false;
    readonly containsDeviceLabels: false;
    readonly containsFileNames: false;
    readonly networkTransmission: false;
  };
  readonly summary: OcrPairedAnalysisSummary;
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
): OcrPairedTimingStats => ({
  count: durations.length,
  medianMs: median(durations),
  p75Ms: percentile(durations, 0.75),
  p90Ms: percentile(durations, 0.9),
  maxMs: durations.length === 0 ? null : Math.max(...durations),
});

const delta = (
  ocr: number | null,
  manual: number | null,
): number | null =>
  ocr === null || manual === null ? null : ocr - manual;

const ratio = (
  ocr: number | null,
  manual: number | null,
): number | null =>
  ocr === null || manual === null || manual <= 0
    ? null
    : ocr / manual;

const compareTiming = (
  ocr: {
    readonly medianMs: number | null;
    readonly p75Ms: number | null;
    readonly p90Ms: number | null;
  },
  manual: OcrPairedTimingStats,
): OcrPairedTimingComparison => ({
  medianDeltaMs: delta(ocr.medianMs, manual.medianMs),
  p75DeltaMs: delta(ocr.p75Ms, manual.p75Ms),
  p90DeltaMs: delta(ocr.p90Ms, manual.p90Ms),
  medianRatio: ratio(ocr.medianMs, manual.medianMs),
  p75Ratio: ratio(ocr.p75Ms, manual.p75Ms),
  p90Ratio: ratio(ocr.p90Ms, manual.p90Ms),
});

const emptyTiming = (): OcrPairedTimingStats => ({
  count: 0,
  medianMs: null,
  p75Ms: null,
  p90Ms: null,
  maxMs: null,
});

const emptyComparison = (): OcrPairedTimingComparison => ({
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

export const analyzeOcrPairedEvidence = (
  manualValue: unknown,
  ocrValue: unknown,
): OcrPairedAnalysisSummary => {
  const manual = parseQaTimingExport(manualValue);
  const ocr = parseShelfLabelOcrExport(ocrValue);

  if (manual === null || ocr === null) {
    const issues = [
      ...(manual === null
        ? ["Manual timing JSON is invalid or tampered."]
        : []),
      ...(ocr === null
        ? ["OCR benchmark JSON is invalid or tampered."]
        : []),
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
        manualLightAppearanceRecorded: false,
        manualPhonePortraitViewport: false,
        manualFixtureEvidenceComplete: false,
        ocrEnginePresent: false,
        ocrAttemptEvidenceComplete: false,
        ocrDecisionEvidenceComplete: false,
        ocrPreferenceRecorded: false,
        ocrEffortRecorded: false,
      }),
      manualLowFixture: emptyTiming(),
      manualHighFixture: emptyTiming(),
      ocr: null,
      ocrEngineId: null,
      ocrDataBoundary: null,
      versusLowFixture: emptyComparison(),
      versusHighFixture: emptyComparison(),
      issues: Object.freeze(issues),
    });
  }

  const manualLowFixture = summarizeDurations(
    representativeDurations(manual, QA_TARGET_PRICE_479),
  );
  const manualHighFixture = summarizeDurations(
    representativeDurations(manual, QA_TARGET_PRICE_1250),
  );
  const ocrDecisions =
    ocr.summary.top1Confirmed +
    ocr.summary.top3Confirmed +
    ocr.summary.rejected;

  const compatibility: OcrPairedCompatibility = Object.freeze({
    fullGitBuildRevision:
      isImmutableEvidenceBuildRevision(manual.buildRevision) &&
      isImmutableEvidenceBuildRevision(ocr.buildRevision),
    sameBuildRevision: manual.buildRevision === ocr.buildRevision,
    sameUserAgent:
      manual.session.environment.userAgent ===
      ocr.session.environment.userAgent,
    sameViewport:
      manual.session.environment.viewportWidth ===
        ocr.session.environment.viewportWidth &&
      manual.session.environment.viewportHeight ===
        ocr.session.environment.viewportHeight,
    sameDeviceLabel:
      normalizedLabel(manual.session.deviceLabel).length > 0 &&
      normalizedLabel(manual.session.deviceLabel) ===
        normalizedLabel(ocr.session.deviceLabel),
    manualInputMethodPresent:
      manual.session.inputMethodLabel.trim().length > 0,
    manualPhysicalContextComplete:
      manualPhysicalContextComplete(manual),
    manualLightAppearanceRecorded:
      manual.gate.lightAppearanceRecorded,
    manualPhonePortraitViewport:
      manual.gate.phonePortraitViewport,
    manualFixtureEvidenceComplete:
      manualLowFixture.count >= QA_TARGET_SAMPLE_COUNT &&
      manualHighFixture.count >= QA_TARGET_SAMPLE_COUNT,
    ocrEnginePresent:
      ocr.session.environment.ocrAvailable &&
      ocr.session.environment.engineId !== null &&
      ocr.session.environment.dataBoundary !== null,
    ocrAttemptEvidenceComplete:
      ocr.summary.attempts >= OCR_PAIRED_MIN_ATTEMPTS,
    ocrDecisionEvidenceComplete:
      ocrDecisions >= OCR_PAIRED_MIN_DECISIONS,
    ocrPreferenceRecorded:
      ocr.summary.preference !== null,
    ocrEffortRecorded:
      ocr.summary.effort !== null,
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
    compatibility.manualLightAppearanceRecorded &&
    compatibility.manualPhonePortraitViewport &&
    compatibility.manualFixtureEvidenceComplete &&
    compatibility.ocrEnginePresent &&
    compatibility.ocrAttemptEvidenceComplete &&
    compatibility.ocrDecisionEvidenceComplete &&
    compatibility.ocrPreferenceRecorded &&
    compatibility.ocrEffortRecorded;

  const issues: string[] = [];

  if (!compatibility.fullGitBuildRevision) {
    issues.push(
      "Field comparison requires full 40-character Git SHA build revisions.",
    );
  }
  if (!compatibility.sameBuildRevision) {
    issues.push(
      "Manual and OCR exports use different buildRevision values.",
    );
  }
  if (!compatibility.sameUserAgent) {
    issues.push(
      "Manual and OCR exports use different browser user agents.",
    );
  }
  if (!compatibility.sameViewport) {
    issues.push(
      "Manual and OCR exports use different viewport dimensions.",
    );
  }
  if (!compatibility.sameDeviceLabel) {
    issues.push(
      "Manual and OCR device labels are missing or do not match.",
    );
  }
  if (!compatibility.manualInputMethodPresent) {
    issues.push(
      "Manual timing evidence does not declare one input method.",
    );
  }
  if (!compatibility.manualPhysicalContextComplete) {
    issues.push(
      "Manual timing physical-context checklist is incomplete.",
    );
  }
  if (!compatibility.manualLightAppearanceRecorded) {
    issues.push(
      "Manual timing baseline is not recorded in the required light appearance.",
    );
  }
  if (!compatibility.manualPhonePortraitViewport) {
    issues.push(
      "Manual timing baseline is not recorded in a phone portrait viewport.",
    );
  }
  if (!compatibility.manualFixtureEvidenceComplete) {
    issues.push(
      `Manual timing requires at least ${QA_TARGET_SAMPLE_COUNT} valid samples for both reference fixtures.`,
    );
  }
  if (!compatibility.ocrEnginePresent) {
    issues.push(
      "OCR evidence does not declare an available concrete engine and data boundary.",
    );
  }
  if (!compatibility.ocrAttemptEvidenceComplete) {
    issues.push(
      `OCR benchmark requires at least ${OCR_PAIRED_MIN_ATTEMPTS} timed attempts.`,
    );
  }
  if (!compatibility.ocrDecisionEvidenceComplete) {
    issues.push(
      `OCR benchmark requires at least ${OCR_PAIRED_MIN_DECISIONS} human candidate decisions.`,
    );
  }
  if (!compatibility.ocrPreferenceRecorded) {
    issues.push(
      "OCR repeated-use preference is not recorded.",
    );
  }
  if (!compatibility.ocrEffortRecorded) {
    issues.push(
      "OCR cognitive-effort score is not recorded.",
    );
  }

  const readiness: OcrPairedReadiness = !hardCompatibility
    ? "incompatible"
    : evidenceComplete
      ? "ready"
      : "incomplete";

  const ocrTiming = {
    medianMs: ocr.summary.medianConfirmedMs,
    p75Ms: ocr.summary.p75ConfirmedMs,
    p90Ms: ocr.summary.p90ConfirmedMs,
  };

  return Object.freeze({
    readiness,
    sourceBuildRevision:
      compatibility.fullGitBuildRevision &&
      compatibility.sameBuildRevision
        ? manual.buildRevision
        : null,
    compatibility,
    manualLowFixture,
    manualHighFixture,
    ocr: ocr.summary,
    ocrEngineId: ocr.session.environment.engineId,
    ocrDataBoundary: ocr.session.environment.dataBoundary,
    versusLowFixture: compareTiming(ocrTiming, manualLowFixture),
    versusHighFixture: compareTiming(ocrTiming, manualHighFixture),
    issues: Object.freeze(issues),
  });
};

const isCanonicalIsoTimestamp = (value: string): boolean => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

export const buildOcrPairedAnalysisExport = (
  summary: OcrPairedAnalysisSummary,
  generatedAt: string,
  analyzerBuildRevision: string = EVIDENCE_BUILD_REVISION,
): OcrPairedAnalysisExport => {
  if (
    summary.readiness !== "ready" ||
    summary.sourceBuildRevision === null ||
    !isImmutableEvidenceBuildRevision(summary.sourceBuildRevision) ||
    !isImmutableEvidenceBuildRevision(analyzerBuildRevision) ||
    !isCanonicalIsoTimestamp(generatedAt)
  ) {
    throw new RangeError(
      "OCR paired export requires ready immutable evidence",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "ocr-paired-analysis",
    sourceBuildRevision: summary.sourceBuildRevision,
    analyzerBuildRevision,
    generatedAt,
    privacy: Object.freeze({
      containsRawManualSamples: false,
      containsRawOcrSamples: false,
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsDeviceLabels: false,
      containsFileNames: false,
      networkTransmission: false,
    }),
    summary,
  });
};
