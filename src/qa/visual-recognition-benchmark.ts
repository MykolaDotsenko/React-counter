import {
  EVIDENCE_BUILD_REVISION,
  isEvidenceBuildRevision,
} from "./evidence-build";

export const VISUAL_RECOGNITION_STORAGE_KEY =
  "budget-cart:qa:visual-recognition-benchmark-v1";

export const VISUAL_RECOGNITION_SAMPLE_LIMIT = 120;
export const VISUAL_RECOGNITION_FAILURE_LIMIT = 50;
export const VISUAL_RECOGNITION_MODEL_ID = "Xenova/mobileclip_s0";
export const VISUAL_RECOGNITION_MODEL_REVISION = "757d59c";
export const VISUAL_RECOGNITION_RUNTIME_VERSION = "4.3.0";
export const VISUAL_RECOGNITION_DEVICE = "wasm";
export const VISUAL_RECOGNITION_DTYPE = "q8";

export type VisualRecognitionOutcome =
  | "confirmed"
  | "rejected"
  | "timeout"
  | "manual-fallback"
  | "recognizer-error";

export type VisualRecognitionFailureType =
  | "camera-unsupported"
  | "permission-denied"
  | "camera-error"
  | "model-load-error";

export type VisualRecognitionPreference =
  | "visual"
  | "manual"
  | "same";

export type VisualRecognitionEffort = 1 | 2 | 3 | 4 | 5;

export interface VisualRecognitionEnvironment {
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cameraSupported: boolean;
  readonly webGpuSupported: boolean;
}

export interface VisualRecognitionModel {
  readonly modelId: typeof VISUAL_RECOGNITION_MODEL_ID;
  readonly revision: typeof VISUAL_RECOGNITION_MODEL_REVISION;
  readonly runtimeVersion: typeof VISUAL_RECOGNITION_RUNTIME_VERSION;
  readonly device: typeof VISUAL_RECOGNITION_DEVICE;
  readonly dtype: typeof VISUAL_RECOGNITION_DTYPE;
}

export interface VisualRecognitionSample {
  readonly id: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: VisualRecognitionOutcome;
  readonly candidateCount: number;
  readonly correctRank: number | null;
  readonly topScore: number | null;
  readonly scoreMargin: number | null;
}

export interface VisualRecognitionFailure {
  readonly type: VisualRecognitionFailureType;
  readonly at: string;
}

export interface VisualRecognitionSession {
  readonly version: 1;
  readonly createdAt: string;
  readonly deviceLabel: string;
  readonly environment: VisualRecognitionEnvironment;
  readonly model: VisualRecognitionModel;
  readonly modelLoadDurationMs: number | null;
  readonly samples: readonly VisualRecognitionSample[];
  readonly failures: readonly VisualRecognitionFailure[];
  readonly preference: VisualRecognitionPreference | null;
  readonly effort: VisualRecognitionEffort | null;
}

export interface VisualRecognitionSummary {
  readonly attempts: number;
  readonly confirmed: number;
  readonly rejected: number;
  readonly timeouts: number;
  readonly manualFallbacks: number;
  readonly recognizerErrors: number;
  readonly rankedAttempts: number;
  readonly top1Accuracy: number | null;
  readonly top3Accuracy: number | null;
  readonly correctionRate: number | null;
  readonly recognitionFailureRate: number | null;
  readonly fallbackRate: number | null;
  readonly medianDecisionMs: number | null;
  readonly p75DecisionMs: number | null;
  readonly p90DecisionMs: number | null;
  readonly medianTopScore: number | null;
  readonly medianScoreMargin: number | null;
  readonly modelLoadDurationMs: number | null;
  readonly cameraUnsupported: number;
  readonly permissionDenied: number;
  readonly cameraErrors: number;
  readonly modelLoadErrors: number;
  readonly preference: VisualRecognitionPreference | null;
  readonly effort: VisualRecognitionEffort | null;
}

export interface VisualRecognitionExport {
  readonly schemaVersion: 1;
  readonly kind: "visual-recognition-benchmark-evidence";
  readonly buildRevision: string;
  readonly generatedAt: string;
  readonly privacy: {
    readonly imageTransmission: false;
    readonly imagePersistence: false;
    readonly candidateLabelsPersisted: false;
    readonly containsProductNames: false;
    readonly containsPrices: false;
    readonly containsLocation: false;
    readonly modelAssetsMayDownload: true;
    readonly containsDeviceMetadata: true;
  };
  readonly session: VisualRecognitionSession;
  readonly summary: VisualRecognitionSummary;
}

const canonicalModel = (): VisualRecognitionModel =>
  Object.freeze({
    modelId: VISUAL_RECOGNITION_MODEL_ID,
    revision: VISUAL_RECOGNITION_MODEL_REVISION,
    runtimeVersion: VISUAL_RECOGNITION_RUNTIME_VERSION,
    device: VISUAL_RECOGNITION_DEVICE,
    dtype: VISUAL_RECOGNITION_DTYPE,
  });

const isCanonicalIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const hasExactKeys = (
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

const boundedNumber = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

const isEnvironment = (
  value: unknown,
): value is VisualRecognitionEnvironment => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "userAgent",
      "viewportWidth",
      "viewportHeight",
      "cameraSupported",
      "webGpuSupported",
    ]) &&
    typeof record.userAgent === "string" &&
    record.userAgent.length <= 512 &&
    Number.isSafeInteger(record.viewportWidth) &&
    Number(record.viewportWidth) > 0 &&
    Number(record.viewportWidth) <= 10_000 &&
    Number.isSafeInteger(record.viewportHeight) &&
    Number(record.viewportHeight) > 0 &&
    Number(record.viewportHeight) <= 10_000 &&
    typeof record.cameraSupported === "boolean" &&
    typeof record.webGpuSupported === "boolean"
  );
};

const isModel = (
  value: unknown,
): value is VisualRecognitionModel => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "modelId",
      "revision",
      "runtimeVersion",
      "device",
      "dtype",
    ]) &&
    record.modelId === VISUAL_RECOGNITION_MODEL_ID &&
    record.revision === VISUAL_RECOGNITION_MODEL_REVISION &&
    record.runtimeVersion === VISUAL_RECOGNITION_RUNTIME_VERSION &&
    record.device === VISUAL_RECOGNITION_DEVICE &&
    record.dtype === VISUAL_RECOGNITION_DTYPE
  );
};

const isOutcome = (value: unknown): value is VisualRecognitionOutcome =>
  value === "confirmed" ||
  value === "rejected" ||
  value === "timeout" ||
  value === "manual-fallback" ||
  value === "recognizer-error";

const isSample = (
  value: unknown,
): value is VisualRecognitionSample => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const candidateCount = Number(record.candidateCount);
  const correctRank =
    record.correctRank === null ? null : Number(record.correctRank);

  return (
    hasExactKeys(record, [
      "id",
      "startedAt",
      "completedAt",
      "durationMs",
      "outcome",
      "candidateCount",
      "correctRank",
      "topScore",
      "scoreMargin",
    ]) &&
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    record.id.length <= 128 &&
    isCanonicalIsoTimestamp(record.startedAt) &&
    isCanonicalIsoTimestamp(record.completedAt) &&
    Date.parse(record.completedAt as string) >=
      Date.parse(record.startedAt as string) &&
    boundedNumber(record.durationMs, 0, 3_600_000) &&
    isOutcome(record.outcome) &&
    Number.isSafeInteger(candidateCount) &&
    candidateCount >= 2 &&
    candidateCount <= 20 &&
    (correctRank === null ||
      (Number.isSafeInteger(correctRank) &&
        correctRank >= 1 &&
        correctRank <= candidateCount)) &&
    (record.topScore === null ||
      boundedNumber(record.topScore, 0, 1)) &&
    (record.scoreMargin === null ||
      boundedNumber(record.scoreMargin, -1, 1)) &&
    (record.outcome === "confirmed" || record.outcome === "rejected"
      ? correctRank !== null &&
        record.topScore !== null &&
        record.scoreMargin !== null
      : correctRank === null)
  );
};

const isFailureType = (
  value: unknown,
): value is VisualRecognitionFailureType =>
  value === "camera-unsupported" ||
  value === "permission-denied" ||
  value === "camera-error" ||
  value === "model-load-error";

const isFailure = (
  value: unknown,
): value is VisualRecognitionFailure => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, ["type", "at"]) &&
    isFailureType(record.type) &&
    isCanonicalIsoTimestamp(record.at)
  );
};

const isPreference = (
  value: unknown,
): value is VisualRecognitionPreference =>
  value === "visual" || value === "manual" || value === "same";

const isEffort = (value: unknown): value is VisualRecognitionEffort =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

const timestampsCoverSession = (
  session: VisualRecognitionSession,
): boolean => {
  const createdAt = Date.parse(session.createdAt);

  return (
    session.samples.every(
      (sample) => Date.parse(sample.startedAt) >= createdAt,
    ) &&
    session.failures.every(
      (failure) => Date.parse(failure.at) >= createdAt,
    )
  );
};

export const isVisualRecognitionSession = (
  value: unknown,
): value is VisualRecognitionSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "version",
      "createdAt",
      "deviceLabel",
      "environment",
      "model",
      "modelLoadDurationMs",
      "samples",
      "failures",
      "preference",
      "effort",
    ]) &&
    record.version === 1 &&
    isCanonicalIsoTimestamp(record.createdAt) &&
    typeof record.deviceLabel === "string" &&
    record.deviceLabel.length <= 160 &&
    isEnvironment(record.environment) &&
    isModel(record.model) &&
    (record.modelLoadDurationMs === null ||
      boundedNumber(record.modelLoadDurationMs, 0, 3_600_000)) &&
    Array.isArray(record.samples) &&
    record.samples.length <= VISUAL_RECOGNITION_SAMPLE_LIMIT &&
    record.samples.every(isSample) &&
    new Set(record.samples.map((sample) => sample.id)).size ===
      record.samples.length &&
    Array.isArray(record.failures) &&
    record.failures.length <= VISUAL_RECOGNITION_FAILURE_LIMIT &&
    record.failures.every(isFailure) &&
    (record.preference === null || isPreference(record.preference)) &&
    (record.effort === null || isEffort(record.effort)) &&
    timestampsCoverSession(record as unknown as VisualRecognitionSession)
  );
};

export const captureVisualRecognitionEnvironment =
  (): VisualRecognitionEnvironment =>
    Object.freeze({
      userAgent: navigator.userAgent.slice(0, 512),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      cameraSupported:
        typeof navigator.mediaDevices?.getUserMedia === "function",
      webGpuSupported: "gpu" in navigator,
    });

export const sameVisualRecognitionEnvironment = (
  left: VisualRecognitionEnvironment,
  right: VisualRecognitionEnvironment,
): boolean =>
  left.userAgent === right.userAgent &&
  left.viewportWidth === right.viewportWidth &&
  left.viewportHeight === right.viewportHeight &&
  left.cameraSupported === right.cameraSupported &&
  left.webGpuSupported === right.webGpuSupported;

export const createVisualRecognitionSession = (
  environment: VisualRecognitionEnvironment,
  createdAt: string,
): VisualRecognitionSession => {
  if (!isEnvironment(environment) || !isCanonicalIsoTimestamp(createdAt)) {
    throw new RangeError("Invalid visual recognition benchmark environment");
  }

  return Object.freeze({
    version: 1,
    createdAt,
    deviceLabel: "",
    environment: Object.freeze({ ...environment }),
    model: canonicalModel(),
    modelLoadDurationMs: null,
    samples: Object.freeze([]),
    failures: Object.freeze([]),
    preference: null,
    effort: null,
  });
};

export const updateVisualRecognitionDeviceLabel = (
  session: VisualRecognitionSession,
  deviceLabel: string,
): VisualRecognitionSession => {
  if (!isVisualRecognitionSession(session) || deviceLabel.length > 160) {
    throw new RangeError("Invalid visual benchmark device label");
  }

  return Object.freeze({ ...session, deviceLabel });
};

export const updateVisualRecognitionModelLoad = (
  session: VisualRecognitionSession,
  durationMs: number,
): VisualRecognitionSession => {
  if (
    !isVisualRecognitionSession(session) ||
    !boundedNumber(durationMs, 0, 3_600_000)
  ) {
    throw new RangeError("Invalid visual benchmark model load duration");
  }

  return Object.freeze({ ...session, modelLoadDurationMs: durationMs });
};

export const appendVisualRecognitionSample = (
  session: VisualRecognitionSession,
  sample: VisualRecognitionSample,
): VisualRecognitionSession => {
  if (!isVisualRecognitionSession(session) || !isSample(sample)) {
    throw new RangeError("Invalid visual recognition benchmark evidence");
  }

  if (Date.parse(sample.startedAt) < Date.parse(session.createdAt)) {
    throw new RangeError("Visual benchmark sample cannot predate session");
  }

  if (session.samples.some((candidate) => candidate.id === sample.id)) {
    throw new RangeError("Duplicate visual benchmark sample ID");
  }

  if (session.samples.length >= VISUAL_RECOGNITION_SAMPLE_LIMIT) {
    throw new RangeError("Visual benchmark sample limit reached");
  }

  return Object.freeze({
    ...session,
    samples: Object.freeze([
      ...session.samples,
      Object.freeze({ ...sample }),
    ]),
  });
};

export const appendVisualRecognitionFailure = (
  session: VisualRecognitionSession,
  failure: VisualRecognitionFailure,
): VisualRecognitionSession => {
  if (!isVisualRecognitionSession(session) || !isFailure(failure)) {
    throw new RangeError("Invalid visual recognition benchmark failure");
  }

  if (Date.parse(failure.at) < Date.parse(session.createdAt)) {
    throw new RangeError("Visual benchmark failure cannot predate session");
  }

  if (session.failures.length >= VISUAL_RECOGNITION_FAILURE_LIMIT) {
    throw new RangeError("Visual benchmark failure limit reached");
  }

  return Object.freeze({
    ...session,
    failures: Object.freeze([
      ...session.failures,
      Object.freeze({ ...failure }),
    ]),
  });
};

export const updateVisualRecognitionSubjective = (
  session: VisualRecognitionSession,
  preference: VisualRecognitionPreference | null,
  effort: VisualRecognitionEffort | null,
): VisualRecognitionSession => {
  if (
    !isVisualRecognitionSession(session) ||
    (preference !== null && !isPreference(preference)) ||
    (effort !== null && !isEffort(effort))
  ) {
    throw new RangeError("Invalid visual benchmark subjective evidence");
  }

  return Object.freeze({ ...session, preference, effort });
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

const rate = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

export const summarizeVisualRecognition = (
  session: VisualRecognitionSession,
): VisualRecognitionSummary => {
  if (!isVisualRecognitionSession(session)) {
    throw new RangeError("Cannot summarize invalid visual benchmark");
  }

  const rankedSamples = session.samples.filter(
    (sample) => sample.correctRank !== null,
  );
  const decisionDurations = session.samples
    .filter(
      (sample) =>
        sample.outcome === "confirmed" || sample.outcome === "rejected",
    )
    .map((sample) => sample.durationMs);
  const scores = rankedSamples
    .map((sample) => sample.topScore)
    .filter((value): value is number => value !== null);
  const margins = rankedSamples
    .map((sample) => sample.scoreMargin)
    .filter((value): value is number => value !== null);
  const confirmed = session.samples.filter(
    (sample) => sample.outcome === "confirmed",
  ).length;
  const rejected = session.samples.filter(
    (sample) => sample.outcome === "rejected",
  ).length;
  const timeouts = session.samples.filter(
    (sample) => sample.outcome === "timeout",
  ).length;
  const manualFallbacks = session.samples.filter(
    (sample) => sample.outcome === "manual-fallback",
  ).length;
  const recognizerErrors = session.samples.filter(
    (sample) => sample.outcome === "recognizer-error",
  ).length;
  const failureCount = (type: VisualRecognitionFailureType): number =>
    session.failures.filter((failure) => failure.type === type).length;

  return Object.freeze({
    attempts: session.samples.length,
    confirmed,
    rejected,
    timeouts,
    manualFallbacks,
    recognizerErrors,
    rankedAttempts: rankedSamples.length,
    top1Accuracy: rate(
      rankedSamples.filter((sample) => sample.correctRank === 1).length,
      rankedSamples.length,
    ),
    top3Accuracy: rate(
      rankedSamples.filter(
        (sample) =>
          sample.correctRank !== null && sample.correctRank <= 3,
      ).length,
      rankedSamples.length,
    ),
    correctionRate: rate(
      rankedSamples.filter(
        (sample) =>
          sample.correctRank !== null && sample.correctRank > 1,
      ).length,
      rankedSamples.length,
    ),
    recognitionFailureRate: rate(
      timeouts + recognizerErrors,
      session.samples.length,
    ),
    fallbackRate: rate(manualFallbacks, session.samples.length),
    medianDecisionMs: percentile(decisionDurations, 0.5),
    p75DecisionMs: percentile(decisionDurations, 0.75),
    p90DecisionMs: percentile(decisionDurations, 0.9),
    medianTopScore: percentile(scores, 0.5),
    medianScoreMargin: percentile(margins, 0.5),
    modelLoadDurationMs: session.modelLoadDurationMs,
    cameraUnsupported: failureCount("camera-unsupported"),
    permissionDenied: failureCount("permission-denied"),
    cameraErrors: failureCount("camera-error"),
    modelLoadErrors: failureCount("model-load-error"),
    preference: session.preference,
    effort: session.effort,
  });
};

export const loadVisualRecognitionSession = (
  storage: Pick<Storage, "getItem">,
  environment: VisualRecognitionEnvironment,
  now: string,
): VisualRecognitionSession => {
  let raw: string | null;

  try {
    raw = storage.getItem(VISUAL_RECOGNITION_STORAGE_KEY);
  } catch {
    return createVisualRecognitionSession(environment, now);
  }

  if (raw === null) {
    return createVisualRecognitionSession(environment, now);
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isVisualRecognitionSession(parsed)
      ? parsed
      : createVisualRecognitionSession(environment, now);
  } catch {
    return createVisualRecognitionSession(environment, now);
  }
};

export const persistVisualRecognitionSession = (
  storage: Pick<Storage, "setItem">,
  session: VisualRecognitionSession,
): void => {
  if (!isVisualRecognitionSession(session)) {
    throw new RangeError("Cannot persist invalid visual benchmark session");
  }

  storage.setItem(
    VISUAL_RECOGNITION_STORAGE_KEY,
    JSON.stringify(session),
  );
};

const observationEndCoversSession = (
  session: VisualRecognitionSession,
  generatedAt: string,
): boolean => {
  const latest = Math.max(
    Date.parse(session.createdAt),
    ...session.samples.map((sample) => Date.parse(sample.completedAt)),
    ...session.failures.map((failure) => Date.parse(failure.at)),
  );

  return Date.parse(generatedAt) >= latest;
};

export const buildVisualRecognitionExport = (
  session: VisualRecognitionSession,
  generatedAt: string,
): VisualRecognitionExport => {
  if (
    !isVisualRecognitionSession(session) ||
    !isCanonicalIsoTimestamp(generatedAt) ||
    !observationEndCoversSession(session, generatedAt)
  ) {
    throw new RangeError("Cannot export invalid visual benchmark evidence");
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "visual-recognition-benchmark-evidence",
    buildRevision: EVIDENCE_BUILD_REVISION,
    generatedAt,
    privacy: Object.freeze({
      imageTransmission: false,
      imagePersistence: false,
      candidateLabelsPersisted: false,
      containsProductNames: false,
      containsPrices: false,
      containsLocation: false,
      modelAssetsMayDownload: true,
      containsDeviceMetadata: true,
    }),
    session,
    summary: summarizeVisualRecognition(session),
  });
};

const sameSummary = (
  value: unknown,
  expected: VisualRecognitionSummary,
): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(expected);

  return (
    hasExactKeys(record, keys) &&
    keys.every((key) =>
      Object.is(
        record[key],
        expected[key as keyof VisualRecognitionSummary],
      ),
    )
  );
};

export const parseVisualRecognitionExport = (
  value: unknown,
): VisualRecognitionExport | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !hasExactKeys(record, [
      "schemaVersion",
      "kind",
      "buildRevision",
      "generatedAt",
      "privacy",
      "session",
      "summary",
    ]) ||
    record.schemaVersion !== 1 ||
    record.kind !== "visual-recognition-benchmark-evidence" ||
    !isEvidenceBuildRevision(record.buildRevision) ||
    !isCanonicalIsoTimestamp(record.generatedAt) ||
    !isVisualRecognitionSession(record.session) ||
    !observationEndCoversSession(
      record.session as VisualRecognitionSession,
      record.generatedAt as string,
    )
  ) {
    return null;
  }

  if (typeof record.privacy !== "object" || record.privacy === null) {
    return null;
  }

  const privacy = record.privacy as Record<string, unknown>;

  if (
    !hasExactKeys(privacy, [
      "imageTransmission",
      "imagePersistence",
      "candidateLabelsPersisted",
      "containsProductNames",
      "containsPrices",
      "containsLocation",
      "modelAssetsMayDownload",
      "containsDeviceMetadata",
    ]) ||
    privacy.imageTransmission !== false ||
    privacy.imagePersistence !== false ||
    privacy.candidateLabelsPersisted !== false ||
    privacy.containsProductNames !== false ||
    privacy.containsPrices !== false ||
    privacy.containsLocation !== false ||
    privacy.modelAssetsMayDownload !== true ||
    privacy.containsDeviceMetadata !== true
  ) {
    return null;
  }

  const session = record.session as VisualRecognitionSession;
  const summary = summarizeVisualRecognition(session);

  if (!sameSummary(record.summary, summary)) {
    return null;
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "visual-recognition-benchmark-evidence",
    buildRevision: record.buildRevision as string,
    generatedAt: record.generatedAt as string,
    privacy: Object.freeze({
      imageTransmission: false,
      imagePersistence: false,
      candidateLabelsPersisted: false,
      containsProductNames: false,
      containsPrices: false,
      containsLocation: false,
      modelAssetsMayDownload: true,
      containsDeviceMetadata: true,
    }),
    session,
    summary,
  });
};
