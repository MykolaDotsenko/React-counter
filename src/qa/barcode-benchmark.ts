export const BARCODE_BENCHMARK_STORAGE_KEY =
  "budget-cart:qa:barcode-benchmark-v1";

export const BARCODE_BENCHMARK_SAMPLE_LIMIT = 200;
export const BARCODE_BENCHMARK_FAILURE_LIMIT = 50;

export type BarcodeBenchmarkOutcome =
  | "confirmed"
  | "rejected"
  | "timeout"
  | "manual-fallback"
  | "detector-error";

export type BarcodeBenchmarkFailureType =
  | "detector-unsupported"
  | "camera-unsupported"
  | "permission-denied"
  | "camera-error";

export type BarcodeBenchmarkPreference =
  | "scanner"
  | "manual"
  | "same";

export type BarcodeBenchmarkEffort = 1 | 2 | 3 | 4 | 5;

export interface BarcodeBenchmarkEnvironment {
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly detectorSupported: boolean;
  readonly cameraSupported: boolean;
  readonly supportedFormats: readonly string[];
}

export interface BarcodeBenchmarkSample {
  readonly id: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: BarcodeBenchmarkOutcome;
  readonly detectedFormat: string | null;
}

export interface BarcodeBenchmarkFailure {
  readonly type: BarcodeBenchmarkFailureType;
  readonly at: string;
}

export interface BarcodeBenchmarkSession {
  readonly version: 1;
  readonly createdAt: string;
  readonly deviceLabel: string;
  readonly environment: BarcodeBenchmarkEnvironment;
  readonly samples: readonly BarcodeBenchmarkSample[];
  readonly failures: readonly BarcodeBenchmarkFailure[];
  readonly preference: BarcodeBenchmarkPreference | null;
  readonly effort: BarcodeBenchmarkEffort | null;
}

export interface BarcodeBenchmarkSummary {
  readonly attempts: number;
  readonly confirmed: number;
  readonly rejected: number;
  readonly timeouts: number;
  readonly manualFallbacks: number;
  readonly medianConfirmedMs: number | null;
  readonly p75ConfirmedMs: number | null;
  readonly p90ConfirmedMs: number | null;
  readonly recognitionFailureRate: number | null;
  readonly correctionRate: number | null;
  readonly fallbackRate: number | null;
  readonly detectorUnsupported: number;
  readonly cameraUnsupported: number;
  readonly permissionDenied: number;
  readonly cameraErrors: number;
  readonly detectorErrors: number;
  readonly preference: BarcodeBenchmarkPreference | null;
  readonly effort: BarcodeBenchmarkEffort | null;
}

export interface BarcodeBenchmarkExport {
  readonly schemaVersion: 1;
  readonly kind: "barcode-benchmark-evidence";
  readonly generatedAt: string;
  readonly privacy: {
    readonly networkTransmission: false;
    readonly containsRawBarcodes: false;
    readonly containsPrices: false;
    readonly containsItemNames: false;
    readonly containsDeviceMetadata: true;
  };
  readonly session: BarcodeBenchmarkSession;
  readonly summary: BarcodeBenchmarkSummary;
}

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

const isBoundedString = (
  value: unknown,
  maxLength: number,
): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLength;

const isFormat = (value: unknown): value is string =>
  isBoundedString(value, 64);

const isEnvironment = (
  value: unknown,
): value is BarcodeBenchmarkEnvironment => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<BarcodeBenchmarkEnvironment>;
  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "userAgent",
      "viewportWidth",
      "viewportHeight",
      "detectorSupported",
      "cameraSupported",
      "supportedFormats",
    ]) &&
    typeof candidate.userAgent === "string" &&
    candidate.userAgent.length <= 512 &&
    Number.isSafeInteger(candidate.viewportWidth) &&
    Number(candidate.viewportWidth) > 0 &&
    Number(candidate.viewportWidth) <= 10_000 &&
    Number.isSafeInteger(candidate.viewportHeight) &&
    Number(candidate.viewportHeight) > 0 &&
    Number(candidate.viewportHeight) <= 10_000 &&
    typeof candidate.detectorSupported === "boolean" &&
    typeof candidate.cameraSupported === "boolean" &&
    Array.isArray(candidate.supportedFormats) &&
    candidate.supportedFormats.length <= 32 &&
    candidate.supportedFormats.every(isFormat) &&
    new Set(candidate.supportedFormats).size ===
      candidate.supportedFormats.length
  );
};

const isOutcome = (
  value: unknown,
): value is BarcodeBenchmarkOutcome =>
  value === "confirmed" ||
  value === "rejected" ||
  value === "timeout" ||
  value === "manual-fallback";

const isSample = (value: unknown): value is BarcodeBenchmarkSample => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<BarcodeBenchmarkSample>;
  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "id",
      "startedAt",
      "completedAt",
      "durationMs",
      "outcome",
      "detectedFormat",
    ]) &&
    isBoundedString(candidate.id, 128) &&
    isCanonicalIsoTimestamp(candidate.startedAt) &&
    isCanonicalIsoTimestamp(candidate.completedAt) &&
    Date.parse(candidate.completedAt) >= Date.parse(candidate.startedAt) &&
    typeof candidate.durationMs === "number" &&
    Number.isFinite(candidate.durationMs) &&
    candidate.durationMs >= 0 &&
    candidate.durationMs <= 60_000 &&
    isOutcome(candidate.outcome) &&
    (candidate.detectedFormat === null ||
      isFormat(candidate.detectedFormat)) &&
    (candidate.outcome === "confirmed" ||
    candidate.outcome === "rejected"
      ? candidate.detectedFormat !== null
      : true)
  );
};

const isFailureType = (
  value: unknown,
): value is BarcodeBenchmarkFailureType =>
  value === "detector-unsupported" ||
  value === "camera-unsupported" ||
  value === "permission-denied" ||
  value === "camera-error";

const isFailure = (
  value: unknown,
): value is BarcodeBenchmarkFailure => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<BarcodeBenchmarkFailure>;
  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, ["type", "at"]) &&
    isFailureType(candidate.type) &&
    isCanonicalIsoTimestamp(candidate.at)
  );
};

const isPreference = (
  value: unknown,
): value is BarcodeBenchmarkPreference =>
  value === "scanner" || value === "manual" || value === "same";

const isEffort = (value: unknown): value is BarcodeBenchmarkEffort =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

const timestampsCoverSession = (
  session: BarcodeBenchmarkSession,
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

export const isBarcodeBenchmarkSession = (
  value: unknown,
): value is BarcodeBenchmarkSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<BarcodeBenchmarkSession>;
  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, [
      "version",
      "createdAt",
      "deviceLabel",
      "environment",
      "samples",
      "failures",
      "preference",
      "effort",
    ]) &&
    candidate.version === 1 &&
    isCanonicalIsoTimestamp(candidate.createdAt) &&
    typeof candidate.deviceLabel === "string" &&
    candidate.deviceLabel.length <= 160 &&
    isEnvironment(candidate.environment) &&
    Array.isArray(candidate.samples) &&
    candidate.samples.length <= BARCODE_BENCHMARK_SAMPLE_LIMIT &&
    candidate.samples.every(isSample) &&
    new Set(candidate.samples.map((sample) => sample.id)).size ===
      candidate.samples.length &&
    Array.isArray(candidate.failures) &&
    candidate.failures.length <= BARCODE_BENCHMARK_FAILURE_LIMIT &&
    candidate.failures.every(isFailure) &&
    (candidate.preference === null ||
      isPreference(candidate.preference)) &&
    (candidate.effort === null || isEffort(candidate.effort)) &&
    timestampsCoverSession(candidate as BarcodeBenchmarkSession)
  );
};

export const createBarcodeBenchmarkSession = (
  environment: BarcodeBenchmarkEnvironment,
  createdAt: string,
): BarcodeBenchmarkSession => {
  if (!isEnvironment(environment)) {
    throw new RangeError("Invalid barcode benchmark environment");
  }

  if (!isCanonicalIsoTimestamp(createdAt)) {
    throw new RangeError(
      "Barcode benchmark session requires canonical ISO time",
    );
  }

  return Object.freeze({
    version: 1,
    createdAt,
    deviceLabel: "",
    environment: Object.freeze({
      ...environment,
      supportedFormats: Object.freeze([...environment.supportedFormats]),
    }),
    samples: Object.freeze([]),
    failures: Object.freeze([]),
    preference: null,
    effort: null,
  });
};

export const appendBarcodeBenchmarkSample = (
  session: BarcodeBenchmarkSession,
  sample: BarcodeBenchmarkSample,
): BarcodeBenchmarkSession => {
  if (!isBarcodeBenchmarkSession(session) || !isSample(sample)) {
    throw new RangeError("Invalid barcode benchmark evidence");
  }

  if (Date.parse(sample.startedAt) < Date.parse(session.createdAt)) {
    throw new RangeError(
      "Barcode benchmark sample cannot predate session",
    );
  }

  if (session.samples.some((candidate) => candidate.id === sample.id)) {
    throw new RangeError("Duplicate barcode benchmark sample ID");
  }

  return Object.freeze({
    ...session,
    samples: Object.freeze(
      [...session.samples, Object.freeze({ ...sample })].slice(
        -BARCODE_BENCHMARK_SAMPLE_LIMIT,
      ),
    ),
  });
};

export const appendBarcodeBenchmarkFailure = (
  session: BarcodeBenchmarkSession,
  failure: BarcodeBenchmarkFailure,
): BarcodeBenchmarkSession => {
  if (!isBarcodeBenchmarkSession(session) || !isFailure(failure)) {
    throw new RangeError("Invalid barcode benchmark failure");
  }

  if (Date.parse(failure.at) < Date.parse(session.createdAt)) {
    throw new RangeError(
      "Barcode benchmark failure cannot predate session",
    );
  }

  return Object.freeze({
    ...session,
    failures: Object.freeze(
      [...session.failures, Object.freeze({ ...failure })].slice(
        -BARCODE_BENCHMARK_FAILURE_LIMIT,
      ),
    ),
  });
};

export const updateBarcodeBenchmarkDeviceLabel = (
  session: BarcodeBenchmarkSession,
  deviceLabel: string,
): BarcodeBenchmarkSession => {
  if (deviceLabel.length > 160) {
    throw new RangeError(
      "Barcode benchmark device label is too long",
    );
  }

  return Object.freeze({
    ...session,
    deviceLabel,
  });
};

export const updateBarcodeBenchmarkSubjective = (
  session: BarcodeBenchmarkSession,
  preference: BarcodeBenchmarkPreference | null,
  effort: BarcodeBenchmarkEffort | null,
): BarcodeBenchmarkSession => {
  if (
    (preference !== null && !isPreference(preference)) ||
    (effort !== null && !isEffort(effort))
  ) {
    throw new RangeError("Invalid barcode benchmark subjective evidence");
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

export const summarizeBarcodeBenchmark = (
  session: BarcodeBenchmarkSession,
): BarcodeBenchmarkSummary => {
  const confirmedDurations = session.samples
    .filter((sample) => sample.outcome === "confirmed")
    .map((sample) => sample.durationMs);
  const confirmed = confirmedDurations.length;
  const rejected = session.samples.filter(
    (sample) => sample.outcome === "rejected",
  ).length;
  const timeouts = session.samples.filter(
    (sample) => sample.outcome === "timeout",
  ).length;
  const manualFallbacks = session.samples.filter(
    (sample) => sample.outcome === "manual-fallback",
  ).length;
  const detectorErrors = session.samples.filter(
    (sample) => sample.outcome === "detector-error",
  ).length;
  const attempts = session.samples.length;
  const detectedDecisions = confirmed + rejected;

  const failureCount = (type: BarcodeBenchmarkFailureType): number =>
    session.failures.filter((failure) => failure.type === type).length;

  return Object.freeze({
    attempts,
    confirmed,
    rejected,
    timeouts,
    manualFallbacks,
    medianConfirmedMs: percentile(confirmedDurations, 0.5),
    p75ConfirmedMs: percentile(confirmedDurations, 0.75),
    p90ConfirmedMs: percentile(confirmedDurations, 0.9),
    recognitionFailureRate: rate(
      timeouts + manualFallbacks + detectorErrors,
      attempts,
    ),
    correctionRate: rate(rejected, detectedDecisions),
    fallbackRate: rate(manualFallbacks, attempts),
    detectorUnsupported: failureCount("detector-unsupported"),
    cameraUnsupported: failureCount("camera-unsupported"),
    permissionDenied: failureCount("permission-denied"),
    cameraErrors: failureCount("camera-error"),
    detectorErrors,
    preference: session.preference,
    effort: session.effort,
  });
};

export const loadBarcodeBenchmarkSession = (
  storage: Pick<Storage, "getItem">,
  environment: BarcodeBenchmarkEnvironment,
  now: string,
): BarcodeBenchmarkSession => {
  let raw: string | null;

  try {
    raw = storage.getItem(BARCODE_BENCHMARK_STORAGE_KEY);
  } catch {
    return createBarcodeBenchmarkSession(environment, now);
  }

  if (raw === null) {
    return createBarcodeBenchmarkSession(environment, now);
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isBarcodeBenchmarkSession(parsed)
      ? parsed
      : createBarcodeBenchmarkSession(environment, now);
  } catch {
    return createBarcodeBenchmarkSession(environment, now);
  }
};

export const persistBarcodeBenchmarkSession = (
  storage: Pick<Storage, "setItem">,
  session: BarcodeBenchmarkSession,
): void => {
  if (!isBarcodeBenchmarkSession(session)) {
    throw new RangeError("Cannot persist invalid barcode benchmark session");
  }

  storage.setItem(
    BARCODE_BENCHMARK_STORAGE_KEY,
    JSON.stringify(session),
  );
};

const observationEndCoversSession = (
  session: BarcodeBenchmarkSession,
  generatedAt: string,
): boolean => {
  const latest = Math.max(
    Date.parse(session.createdAt),
    ...session.samples.map((sample) => Date.parse(sample.completedAt)),
    ...session.failures.map((failure) => Date.parse(failure.at)),
  );

  return Date.parse(generatedAt) >= latest;
};

export const buildBarcodeBenchmarkExport = (
  session: BarcodeBenchmarkSession,
  generatedAt: string,
): BarcodeBenchmarkExport => {
  if (!isBarcodeBenchmarkSession(session)) {
    throw new RangeError("Cannot export invalid barcode benchmark evidence");
  }

  if (
    !isCanonicalIsoTimestamp(generatedAt) ||
    !observationEndCoversSession(session, generatedAt)
  ) {
    throw new RangeError(
      "Barcode benchmark export requires a valid observation end",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "barcode-benchmark-evidence",
    generatedAt,
    privacy: Object.freeze({
      networkTransmission: false,
      containsRawBarcodes: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    }),
    session,
    summary: summarizeBarcodeBenchmark(session),
  });
};

const sameSummary = (
  value: unknown,
  expected: BarcodeBenchmarkSummary,
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
        expected[key as keyof BarcodeBenchmarkSummary],
      ),
    )
  );
};

export const parseBarcodeBenchmarkExport = (
  value: unknown,
): BarcodeBenchmarkExport | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !hasExactKeys(record, [
      "schemaVersion",
      "kind",
      "generatedAt",
      "privacy",
      "session",
      "summary",
    ]) ||
    record.schemaVersion !== 1 ||
    record.kind !== "barcode-benchmark-evidence" ||
    !isCanonicalIsoTimestamp(record.generatedAt) ||
    !isBarcodeBenchmarkSession(record.session) ||
    !observationEndCoversSession(record.session, record.generatedAt)
  ) {
    return null;
  }

  if (typeof record.privacy !== "object" || record.privacy === null) {
    return null;
  }

  const privacy = record.privacy as Record<string, unknown>;

  if (
    !hasExactKeys(privacy, [
      "networkTransmission",
      "containsRawBarcodes",
      "containsPrices",
      "containsItemNames",
      "containsDeviceMetadata",
    ]) ||
    privacy.networkTransmission !== false ||
    privacy.containsRawBarcodes !== false ||
    privacy.containsPrices !== false ||
    privacy.containsItemNames !== false ||
    privacy.containsDeviceMetadata !== true
  ) {
    return null;
  }

  const summary = summarizeBarcodeBenchmark(record.session);

  if (!sameSummary(record.summary, summary)) {
    return null;
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "barcode-benchmark-evidence",
    generatedAt: record.generatedAt,
    privacy: Object.freeze({
      networkTransmission: false,
      containsRawBarcodes: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    }),
    session: record.session,
    summary,
  });
};
