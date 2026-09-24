import {
  EVIDENCE_BUILD_REVISION,
  isEvidenceBuildRevision,
} from "./evidence-build";

export const VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY =
  "budget-cart:qa:visual-product-benchmark-v1";

export const VISUAL_PRODUCT_BENCHMARK_SAMPLE_LIMIT = 120;
export const VISUAL_PRODUCT_BENCHMARK_FAILURE_LIMIT = 50;

export type VisualProductDataBoundary =
  | "local-only"
  | "remote-image";

export type VisualProductBenchmarkOutcome =
  | "top1-confirmed"
  | "top3-confirmed"
  | "rejected"
  | "no-result"
  | "timeout"
  | "manual-fallback"
  | "recognizer-error"
  | "capture-error";

export type VisualProductBenchmarkFailureType =
  | "recognizer-unavailable"
  | "camera-unsupported"
  | "permission-denied"
  | "camera-error";

export type VisualProductBenchmarkPreference =
  | "visual"
  | "manual"
  | "same";

export type VisualProductBenchmarkEffort = 1 | 2 | 3 | 4 | 5;

export interface VisualProductBenchmarkEnvironment {
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cameraSupported: boolean;
  readonly recognizerAvailable: boolean;
  readonly recognizerId: string | null;
  readonly dataBoundary: VisualProductDataBoundary | null;
}

export interface VisualProductBenchmarkSample {
  readonly id: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: VisualProductBenchmarkOutcome;
  readonly candidateCount: number;
  readonly selectedRank: 1 | 2 | 3 | null;
  readonly topConfidence: number | null;
}

export interface VisualProductBenchmarkFailure {
  readonly type: VisualProductBenchmarkFailureType;
  readonly at: string;
}

export interface VisualProductBenchmarkSession {
  readonly version: 1;
  readonly createdAt: string;
  readonly deviceLabel: string;
  readonly environment: VisualProductBenchmarkEnvironment;
  readonly samples: readonly VisualProductBenchmarkSample[];
  readonly failures: readonly VisualProductBenchmarkFailure[];
  readonly preference: VisualProductBenchmarkPreference | null;
  readonly effort: VisualProductBenchmarkEffort | null;
}

export interface VisualProductBenchmarkSummary {
  readonly attempts: number;
  readonly top1Confirmed: number;
  readonly top3Confirmed: number;
  readonly rejected: number;
  readonly noResults: number;
  readonly timeouts: number;
  readonly manualFallbacks: number;
  readonly recognizerErrors: number;
  readonly captureErrors: number;
  readonly medianConfirmedMs: number | null;
  readonly p75ConfirmedMs: number | null;
  readonly p90ConfirmedMs: number | null;
  readonly top1Accuracy: number | null;
  readonly top3Accuracy: number | null;
  readonly recognitionFailureRate: number | null;
  readonly correctionRate: number | null;
  readonly fallbackRate: number | null;
  readonly recognizerUnavailable: number;
  readonly cameraUnsupported: number;
  readonly permissionDenied: number;
  readonly cameraErrors: number;
  readonly preference: VisualProductBenchmarkPreference | null;
  readonly effort: VisualProductBenchmarkEffort | null;
}

export interface VisualProductBenchmarkExport {
  readonly schemaVersion: 1;
  readonly kind: "visual-product-benchmark-evidence";
  readonly buildRevision: string;
  readonly generatedAt: string;
  readonly privacy: {
    readonly networkTransmission: boolean;
    readonly containsRawImages: false;
    readonly containsCandidateLabels: false;
    readonly containsPrices: false;
    readonly containsItemNames: false;
    readonly containsDeviceMetadata: true;
  };
  readonly session: VisualProductBenchmarkSession;
  readonly summary: VisualProductBenchmarkSummary;
}

export type VisualProductBenchmarkLoadResult =
  | {
      readonly status: "ready";
      readonly session: VisualProductBenchmarkSession;
    }
  | {
      readonly status: "corrupt";
      readonly session: null;
    };

const exactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const isCanonicalIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const isBoundedString = (
  value: unknown,
  maxLength: number,
): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLength;

const isDataBoundary = (
  value: unknown,
): value is VisualProductDataBoundary =>
  value === "local-only" || value === "remote-image";

const isEnvironment = (
  value: unknown,
): value is VisualProductBenchmarkEnvironment => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VisualProductBenchmarkEnvironment>;
  const record = value as Record<string, unknown>;

  return (
    exactKeys(record, [
      "userAgent",
      "viewportWidth",
      "viewportHeight",
      "cameraSupported",
      "recognizerAvailable",
      "recognizerId",
      "dataBoundary",
    ]) &&
    typeof candidate.userAgent === "string" &&
    candidate.userAgent.length <= 512 &&
    Number.isSafeInteger(candidate.viewportWidth) &&
    Number(candidate.viewportWidth) > 0 &&
    Number(candidate.viewportWidth) <= 10_000 &&
    Number.isSafeInteger(candidate.viewportHeight) &&
    Number(candidate.viewportHeight) > 0 &&
    Number(candidate.viewportHeight) <= 10_000 &&
    typeof candidate.cameraSupported === "boolean" &&
    typeof candidate.recognizerAvailable === "boolean" &&
    (candidate.recognizerId === null ||
      isBoundedString(candidate.recognizerId, 160)) &&
    (candidate.dataBoundary === null ||
      isDataBoundary(candidate.dataBoundary)) &&
    (candidate.recognizerAvailable
      ? candidate.recognizerId !== null &&
        candidate.dataBoundary !== null
      : candidate.recognizerId === null &&
        candidate.dataBoundary === null)
  );
};

const isOutcome = (
  value: unknown,
): value is VisualProductBenchmarkOutcome =>
  value === "top1-confirmed" ||
  value === "top3-confirmed" ||
  value === "rejected" ||
  value === "no-result" ||
  value === "timeout" ||
  value === "manual-fallback" ||
  value === "recognizer-error" ||
  value === "capture-error";

const isRank = (value: unknown): value is 1 | 2 | 3 =>
  value === 1 || value === 2 || value === 3;

const isConfidence = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

const isSample = (
  value: unknown,
): value is VisualProductBenchmarkSample => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VisualProductBenchmarkSample>;
  const record = value as Record<string, unknown>;
  const decisionOutcome =
    candidate.outcome === "top1-confirmed" ||
    candidate.outcome === "top3-confirmed" ||
    candidate.outcome === "rejected";

  return (
    exactKeys(record, [
      "id",
      "startedAt",
      "completedAt",
      "durationMs",
      "outcome",
      "candidateCount",
      "selectedRank",
      "topConfidence",
    ]) &&
    isBoundedString(candidate.id, 128) &&
    isCanonicalIsoTimestamp(candidate.startedAt) &&
    isCanonicalIsoTimestamp(candidate.completedAt) &&
    Date.parse(candidate.completedAt) >= Date.parse(candidate.startedAt) &&
    typeof candidate.durationMs === "number" &&
    Number.isFinite(candidate.durationMs) &&
    candidate.durationMs >= 0 &&
    candidate.durationMs <= 3_600_000 &&
    isOutcome(candidate.outcome) &&
    Number.isSafeInteger(candidate.candidateCount) &&
    Number(candidate.candidateCount) >= 0 &&
    Number(candidate.candidateCount) <= 10 &&
    (candidate.selectedRank === null || isRank(candidate.selectedRank)) &&
    (candidate.topConfidence === null ||
      isConfidence(candidate.topConfidence)) &&
    (candidate.outcome === "top1-confirmed"
      ? candidate.selectedRank === 1
      : true) &&
    (candidate.outcome === "top3-confirmed"
      ? candidate.selectedRank === 2 || candidate.selectedRank === 3
      : true) &&
    (!decisionOutcome || candidate.candidateCount > 0) &&
    (candidate.outcome === "rejected"
      ? candidate.selectedRank === null
      : true) &&
    (candidate.outcome === "top1-confirmed" ||
    candidate.outcome === "top3-confirmed"
      ? candidate.selectedRank !== null
      : candidate.selectedRank === null) &&
    (Number(candidate.candidateCount) > 0 ||
      candidate.topConfidence === null) &&
    (candidate.selectedRank === null ||
      candidate.selectedRank <= Number(candidate.candidateCount))
  );
};

const isFailureType = (
  value: unknown,
): value is VisualProductBenchmarkFailureType =>
  value === "recognizer-unavailable" ||
  value === "camera-unsupported" ||
  value === "permission-denied" ||
  value === "camera-error";

const isFailure = (
  value: unknown,
): value is VisualProductBenchmarkFailure => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VisualProductBenchmarkFailure>;

  return (
    exactKeys(value as Record<string, unknown>, ["type", "at"]) &&
    isFailureType(candidate.type) &&
    isCanonicalIsoTimestamp(candidate.at)
  );
};

const isPreference = (
  value: unknown,
): value is VisualProductBenchmarkPreference =>
  value === "visual" || value === "manual" || value === "same";

const isEffort = (
  value: unknown,
): value is VisualProductBenchmarkEffort =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

export const isVisualProductBenchmarkSession = (
  value: unknown,
): value is VisualProductBenchmarkSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<VisualProductBenchmarkSession>;
  const record = value as Record<string, unknown>;

  if (
    !exactKeys(record, [
      "version",
      "createdAt",
      "deviceLabel",
      "environment",
      "samples",
      "failures",
      "preference",
      "effort",
    ]) ||
    candidate.version !== 1 ||
    !isCanonicalIsoTimestamp(candidate.createdAt) ||
    typeof candidate.deviceLabel !== "string" ||
    candidate.deviceLabel.length > 160 ||
    !isEnvironment(candidate.environment) ||
    !Array.isArray(candidate.samples) ||
    candidate.samples.length > VISUAL_PRODUCT_BENCHMARK_SAMPLE_LIMIT ||
    !candidate.samples.every(isSample) ||
    new Set(candidate.samples.map((sample) => sample.id)).size !==
      candidate.samples.length ||
    !Array.isArray(candidate.failures) ||
    candidate.failures.length > VISUAL_PRODUCT_BENCHMARK_FAILURE_LIMIT ||
    !candidate.failures.every(isFailure) ||
    new Set(candidate.failures.map((failure) => failure.type)).size !==
      candidate.failures.length ||
    (candidate.preference !== null &&
      !isPreference(candidate.preference)) ||
    (candidate.effort !== null && !isEffort(candidate.effort))
  ) {
    return false;
  }

  const createdAt = Date.parse(candidate.createdAt);

  return (
    candidate.samples.every(
      (sample) => Date.parse(sample.startedAt) >= createdAt,
    ) &&
    candidate.failures.every(
      (failure) => Date.parse(failure.at) >= createdAt,
    )
  );
};

export const sameVisualProductBenchmarkEnvironment = (
  left: VisualProductBenchmarkEnvironment,
  right: VisualProductBenchmarkEnvironment,
): boolean =>
  left.userAgent === right.userAgent &&
  left.viewportWidth === right.viewportWidth &&
  left.viewportHeight === right.viewportHeight &&
  left.cameraSupported === right.cameraSupported &&
  left.recognizerAvailable === right.recognizerAvailable &&
  left.recognizerId === right.recognizerId &&
  left.dataBoundary === right.dataBoundary;

export const createVisualProductBenchmarkSession = (
  environment: VisualProductBenchmarkEnvironment,
  createdAt: string,
): VisualProductBenchmarkSession => {
  if (!isEnvironment(environment)) {
    throw new RangeError("Invalid visual product benchmark environment");
  }

  if (!isCanonicalIsoTimestamp(createdAt)) {
    throw new RangeError(
      "Visual product benchmark requires canonical ISO time",
    );
  }

  return Object.freeze({
    version: 1,
    createdAt,
    deviceLabel: "",
    environment: Object.freeze({ ...environment }),
    samples: Object.freeze([]),
    failures: Object.freeze([]),
    preference: null,
    effort: null,
  });
};

export const appendVisualProductBenchmarkSample = (
  session: VisualProductBenchmarkSession,
  sample: VisualProductBenchmarkSample,
): VisualProductBenchmarkSession => {
  if (!isVisualProductBenchmarkSession(session) || !isSample(sample)) {
    throw new RangeError("Invalid visual product benchmark sample");
  }

  if (Date.parse(sample.startedAt) < Date.parse(session.createdAt)) {
    throw new RangeError(
      "Visual product benchmark sample cannot predate session",
    );
  }

  if (session.samples.some((candidate) => candidate.id === sample.id)) {
    throw new RangeError("Duplicate visual product benchmark sample ID");
  }

  if (session.samples.length >= VISUAL_PRODUCT_BENCHMARK_SAMPLE_LIMIT) {
    throw new RangeError(
      "Visual product benchmark sample limit reached",
    );
  }

  return Object.freeze({
    ...session,
    samples: Object.freeze([
      ...session.samples,
      Object.freeze({ ...sample }),
    ]),
  });
};

export const appendVisualProductBenchmarkFailure = (
  session: VisualProductBenchmarkSession,
  failure: VisualProductBenchmarkFailure,
): VisualProductBenchmarkSession => {
  if (
    !isVisualProductBenchmarkSession(session) ||
    !isFailure(failure)
  ) {
    throw new RangeError("Invalid visual product benchmark failure");
  }

  if (Date.parse(failure.at) < Date.parse(session.createdAt)) {
    throw new RangeError(
      "Visual product benchmark failure cannot predate session",
    );
  }

  if (
    session.failures.length >=
    VISUAL_PRODUCT_BENCHMARK_FAILURE_LIMIT
  ) {
    throw new RangeError(
      "Visual product benchmark failure limit reached",
    );
  }

  return Object.freeze({
    ...session,
    failures: Object.freeze([
      ...session.failures,
      Object.freeze({ ...failure }),
    ]),
  });
};

export const updateVisualProductBenchmarkDeviceLabel = (
  session: VisualProductBenchmarkSession,
  deviceLabel: string,
): VisualProductBenchmarkSession => {
  if (deviceLabel.length > 160) {
    throw new RangeError(
      "Visual product benchmark device label is too long",
    );
  }

  return Object.freeze({
    ...session,
    deviceLabel,
  });
};

export const updateVisualProductBenchmarkSubjective = (
  session: VisualProductBenchmarkSession,
  preference: VisualProductBenchmarkPreference | null,
  effort: VisualProductBenchmarkEffort | null,
): VisualProductBenchmarkSession => {
  if (
    (preference !== null && !isPreference(preference)) ||
    (effort !== null && !isEffort(effort))
  ) {
    throw new RangeError(
      "Invalid visual product benchmark subjective evidence",
    );
  }

  return Object.freeze({
    ...session,
    preference,
    effort,
  });
};

const percentile = (
  values: readonly number[],
  fraction: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(fraction * sorted.length) - 1;

  return sorted[Math.max(0, rank)] ?? null;
};

const rate = (
  numerator: number,
  denominator: number,
): number | null =>
  denominator === 0 ? null : numerator / denominator;

export const summarizeVisualProductBenchmark = (
  session: VisualProductBenchmarkSession,
): VisualProductBenchmarkSummary => {
  const count = (outcome: VisualProductBenchmarkOutcome): number =>
    session.samples.filter((sample) => sample.outcome === outcome).length;

  const top1Confirmed = count("top1-confirmed");
  const top3Confirmed = count("top3-confirmed");
  const rejected = count("rejected");
  const noResults = count("no-result");
  const timeouts = count("timeout");
  const manualFallbacks = count("manual-fallback");
  const recognizerErrors = count("recognizer-error");
  const captureErrors = count("capture-error");
  const confirmedDurations = session.samples
    .filter(
      (sample) =>
        sample.outcome === "top1-confirmed" ||
        sample.outcome === "top3-confirmed",
    )
    .map((sample) => sample.durationMs);
  const decisions = top1Confirmed + top3Confirmed + rejected;
  const attempts = session.samples.length;
  const failureCount = (
    type: VisualProductBenchmarkFailureType,
  ): number =>
    session.failures.filter((failure) => failure.type === type).length;

  return Object.freeze({
    attempts,
    top1Confirmed,
    top3Confirmed,
    rejected,
    noResults,
    timeouts,
    manualFallbacks,
    recognizerErrors,
    captureErrors,
    medianConfirmedMs: percentile(confirmedDurations, 0.5),
    p75ConfirmedMs: percentile(confirmedDurations, 0.75),
    p90ConfirmedMs: percentile(confirmedDurations, 0.9),
    top1Accuracy: rate(top1Confirmed, decisions),
    top3Accuracy: rate(top1Confirmed + top3Confirmed, decisions),
    recognitionFailureRate: rate(
      noResults + timeouts + recognizerErrors + captureErrors,
      attempts,
    ),
    correctionRate: rate(rejected, decisions),
    fallbackRate: rate(manualFallbacks, attempts),
    recognizerUnavailable: failureCount("recognizer-unavailable"),
    cameraUnsupported: failureCount("camera-unsupported"),
    permissionDenied: failureCount("permission-denied"),
    cameraErrors: failureCount("camera-error"),
    preference: session.preference,
    effort: session.effort,
  });
};

export const persistVisualProductBenchmarkSession = (
  storage: Pick<Storage, "setItem">,
  session: VisualProductBenchmarkSession,
): void => {
  if (!isVisualProductBenchmarkSession(session)) {
    throw new RangeError("Refusing to persist invalid visual benchmark");
  }

  storage.setItem(
    VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY,
    JSON.stringify(session),
  );
};

export const clearVisualProductBenchmarkSession = (
  storage: Pick<Storage, "removeItem">,
): void => {
  storage.removeItem(VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY);
};

export const loadVisualProductBenchmarkSession = (
  storage: Pick<Storage, "getItem" | "setItem">,
  environment: VisualProductBenchmarkEnvironment,
  createdAt: string,
): VisualProductBenchmarkLoadResult => {
  let raw: string | null = null;

  try {
    raw = storage.getItem(VISUAL_PRODUCT_BENCHMARK_STORAGE_KEY);
  } catch {
    return {
      status: "ready",
      session: createVisualProductBenchmarkSession(
        environment,
        createdAt,
      ),
    };
  }

  if (raw === null) {
    const session = createVisualProductBenchmarkSession(
      environment,
      createdAt,
    );

    try {
      persistVisualProductBenchmarkSession(storage, session);
    } catch {
      // Evidence storage failure must not break the isolated benchmark UI.
    }

    return {
      status: "ready",
      session,
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isVisualProductBenchmarkSession(parsed)
      ? { status: "ready", session: parsed }
      : { status: "corrupt", session: null };
  } catch {
    return { status: "corrupt", session: null };
  }
};

export const buildVisualProductBenchmarkExport = (
  session: VisualProductBenchmarkSession,
  generatedAt: string,
): VisualProductBenchmarkExport => {
  if (!isVisualProductBenchmarkSession(session)) {
    throw new RangeError("Invalid visual product benchmark session");
  }

  if (
    !isCanonicalIsoTimestamp(generatedAt) ||
    Date.parse(generatedAt) < Date.parse(session.createdAt)
  ) {
    throw new RangeError(
      "Visual product benchmark export time is invalid",
    );
  }

  if (!isEvidenceBuildRevision(EVIDENCE_BUILD_REVISION)) {
    throw new RangeError("Invalid evidence build revision");
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "visual-product-benchmark-evidence",
    buildRevision: EVIDENCE_BUILD_REVISION,
    generatedAt,
    privacy: Object.freeze({
      networkTransmission:
        session.environment.dataBoundary === "remote-image",
      containsRawImages: false,
      containsCandidateLabels: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    }),
    session,
    summary: summarizeVisualProductBenchmark(session),
  });
};
