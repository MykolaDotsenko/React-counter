import {
  EVIDENCE_BUILD_REVISION,
  isEvidenceBuildRevision,
} from "./evidence-build";

export const SHELF_LABEL_OCR_STORAGE_KEY =
  "budget-cart:qa:shelf-label-ocr-benchmark-v1";

export const SHELF_LABEL_OCR_SAMPLE_LIMIT = 120;
export const SHELF_LABEL_OCR_FAILURE_LIMIT = 50;

export type ShelfLabelOcrDataBoundary =
  | "local-only"
  | "remote-image";

export type ShelfLabelOcrOutcome =
  | "top1-confirmed"
  | "top3-confirmed"
  | "rejected"
  | "no-candidate"
  | "timeout"
  | "manual-fallback"
  | "ocr-error"
  | "parser-error"
  | "capture-error";

export type ShelfLabelOcrFailureType =
  | "ocr-unavailable"
  | "camera-unsupported"
  | "permission-denied"
  | "camera-error";

export type ShelfLabelOcrPreference =
  | "ocr"
  | "manual"
  | "same";

export type ShelfLabelOcrEffort = 1 | 2 | 3 | 4 | 5;

export interface ShelfLabelOcrEnvironment {
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cameraSupported: boolean;
  readonly ocrAvailable: boolean;
  readonly engineId: string | null;
  readonly dataBoundary: ShelfLabelOcrDataBoundary | null;
}

export interface ShelfLabelOcrSample {
  readonly id: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: ShelfLabelOcrOutcome;
  readonly candidateCount: number;
  readonly selectedRank: 1 | 2 | 3 | null;
  readonly ocrConfidence: number | null;
}

export interface ShelfLabelOcrFailure {
  readonly type: ShelfLabelOcrFailureType;
  readonly at: string;
}

export interface ShelfLabelOcrSession {
  readonly version: 1;
  readonly createdAt: string;
  readonly deviceLabel: string;
  readonly environment: ShelfLabelOcrEnvironment;
  readonly samples: readonly ShelfLabelOcrSample[];
  readonly failures: readonly ShelfLabelOcrFailure[];
  readonly preference: ShelfLabelOcrPreference | null;
  readonly effort: ShelfLabelOcrEffort | null;
}

export interface ShelfLabelOcrSummary {
  readonly attempts: number;
  readonly top1Confirmed: number;
  readonly top3Confirmed: number;
  readonly rejected: number;
  readonly noCandidates: number;
  readonly timeouts: number;
  readonly manualFallbacks: number;
  readonly ocrErrors: number;
  readonly parserErrors: number;
  readonly captureErrors: number;
  readonly medianDecisionMs: number | null;
  readonly p75DecisionMs: number | null;
  readonly p90DecisionMs: number | null;
  readonly medianConfirmedMs: number | null;
  readonly p75ConfirmedMs: number | null;
  readonly p90ConfirmedMs: number | null;
  readonly top1CorrectRate: number | null;
  readonly top3CorrectRate: number | null;
  readonly failureRate: number | null;
  readonly correctionRate: number | null;
  readonly fallbackRate: number | null;
  readonly ocrUnavailable: number;
  readonly cameraUnsupported: number;
  readonly permissionDenied: number;
  readonly cameraErrors: number;
  readonly preference: ShelfLabelOcrPreference | null;
  readonly effort: ShelfLabelOcrEffort | null;
}

export interface ShelfLabelOcrExport {
  readonly schemaVersion: 2;
  readonly kind: "shelf-label-ocr-benchmark-evidence";
  readonly buildRevision: string;
  readonly generatedAt: string;
  readonly privacy: {
    readonly networkTransmission: boolean;
    readonly containsRawImages: false;
    readonly containsRawOcrText: false;
    readonly containsPrices: false;
    readonly containsItemNames: false;
    readonly containsDeviceMetadata: true;
  };
  readonly session: ShelfLabelOcrSession;
  readonly summary: ShelfLabelOcrSummary;
}

export type ShelfLabelOcrLoadResult =
  | {
      readonly status: "ready";
      readonly session: ShelfLabelOcrSession;
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
): value is ShelfLabelOcrDataBoundary =>
  value === "local-only" || value === "remote-image";

const isEnvironment = (
  value: unknown,
): value is ShelfLabelOcrEnvironment => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ShelfLabelOcrEnvironment>;

  return (
    exactKeys(value as Record<string, unknown>, [
      "userAgent",
      "viewportWidth",
      "viewportHeight",
      "cameraSupported",
      "ocrAvailable",
      "engineId",
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
    typeof candidate.ocrAvailable === "boolean" &&
    (candidate.engineId === null ||
      isBoundedString(candidate.engineId, 160)) &&
    (candidate.dataBoundary === null ||
      isDataBoundary(candidate.dataBoundary)) &&
    (candidate.ocrAvailable
      ? candidate.engineId !== null &&
        candidate.dataBoundary !== null
      : candidate.engineId === null &&
        candidate.dataBoundary === null)
  );
};

const isOutcome = (value: unknown): value is ShelfLabelOcrOutcome =>
  value === "top1-confirmed" ||
  value === "top3-confirmed" ||
  value === "rejected" ||
  value === "no-candidate" ||
  value === "timeout" ||
  value === "manual-fallback" ||
  value === "ocr-error" ||
  value === "parser-error" ||
  value === "capture-error";

const isRank = (value: unknown): value is 1 | 2 | 3 =>
  value === 1 || value === 2 || value === 3;

const isConfidence = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

const isSample = (value: unknown): value is ShelfLabelOcrSample => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ShelfLabelOcrSample>;
  const decisionOutcome =
    candidate.outcome === "top1-confirmed" ||
    candidate.outcome === "top3-confirmed" ||
    candidate.outcome === "rejected";

  return (
    exactKeys(value as Record<string, unknown>, [
      "id",
      "startedAt",
      "completedAt",
      "durationMs",
      "outcome",
      "candidateCount",
      "selectedRank",
      "ocrConfidence",
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
    Number(candidate.candidateCount) <= 8 &&
    (candidate.selectedRank === null || isRank(candidate.selectedRank)) &&
    (candidate.ocrConfidence === null ||
      isConfidence(candidate.ocrConfidence)) &&
    (!decisionOutcome || Number(candidate.candidateCount) > 0) &&
    (candidate.outcome === "top1-confirmed"
      ? candidate.selectedRank === 1
      : true) &&
    (candidate.outcome === "top3-confirmed"
      ? candidate.selectedRank === 2 || candidate.selectedRank === 3
      : true) &&
    (candidate.outcome === "top1-confirmed" ||
    candidate.outcome === "top3-confirmed"
      ? candidate.selectedRank !== null
      : candidate.selectedRank === null) &&
    (candidate.selectedRank === null ||
      candidate.selectedRank <= Number(candidate.candidateCount))
  );
};

const isFailureType = (
  value: unknown,
): value is ShelfLabelOcrFailureType =>
  value === "ocr-unavailable" ||
  value === "camera-unsupported" ||
  value === "permission-denied" ||
  value === "camera-error";

const isFailure = (value: unknown): value is ShelfLabelOcrFailure => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ShelfLabelOcrFailure>;

  return (
    exactKeys(value as Record<string, unknown>, ["type", "at"]) &&
    isFailureType(candidate.type) &&
    isCanonicalIsoTimestamp(candidate.at)
  );
};

const isPreference = (
  value: unknown,
): value is ShelfLabelOcrPreference =>
  value === "ocr" || value === "manual" || value === "same";

const isEffort = (value: unknown): value is ShelfLabelOcrEffort =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

export const isShelfLabelOcrSession = (
  value: unknown,
): value is ShelfLabelOcrSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ShelfLabelOcrSession>;

  if (
    !exactKeys(value as Record<string, unknown>, [
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
    candidate.samples.length > SHELF_LABEL_OCR_SAMPLE_LIMIT ||
    !candidate.samples.every(isSample) ||
    new Set(candidate.samples.map((sample) => sample.id)).size !==
      candidate.samples.length ||
    !Array.isArray(candidate.failures) ||
    candidate.failures.length > SHELF_LABEL_OCR_FAILURE_LIMIT ||
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

export const sameShelfLabelOcrEnvironment = (
  left: ShelfLabelOcrEnvironment,
  right: ShelfLabelOcrEnvironment,
): boolean =>
  left.userAgent === right.userAgent &&
  left.viewportWidth === right.viewportWidth &&
  left.viewportHeight === right.viewportHeight &&
  left.cameraSupported === right.cameraSupported &&
  left.ocrAvailable === right.ocrAvailable &&
  left.engineId === right.engineId &&
  left.dataBoundary === right.dataBoundary;

export const createShelfLabelOcrSession = (
  environment: ShelfLabelOcrEnvironment,
  createdAt: string,
): ShelfLabelOcrSession => {
  if (!isEnvironment(environment)) {
    throw new RangeError("Invalid shelf-label OCR benchmark environment");
  }

  if (!isCanonicalIsoTimestamp(createdAt)) {
    throw new RangeError(
      "Shelf-label OCR benchmark requires canonical ISO time",
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

export const appendShelfLabelOcrSample = (
  session: ShelfLabelOcrSession,
  sample: ShelfLabelOcrSample,
): ShelfLabelOcrSession => {
  if (!isShelfLabelOcrSession(session) || !isSample(sample)) {
    throw new RangeError("Invalid shelf-label OCR benchmark sample");
  }

  if (Date.parse(sample.startedAt) < Date.parse(session.createdAt)) {
    throw new RangeError(
      "Shelf-label OCR sample cannot predate session",
    );
  }

  if (session.samples.some((candidate) => candidate.id === sample.id)) {
    throw new RangeError("Duplicate shelf-label OCR sample ID");
  }

  if (session.samples.length >= SHELF_LABEL_OCR_SAMPLE_LIMIT) {
    throw new RangeError("Shelf-label OCR sample limit reached");
  }

  return Object.freeze({
    ...session,
    samples: Object.freeze([
      ...session.samples,
      Object.freeze({ ...sample }),
    ]),
  });
};

export const appendShelfLabelOcrFailure = (
  session: ShelfLabelOcrSession,
  failure: ShelfLabelOcrFailure,
): ShelfLabelOcrSession => {
  if (!isShelfLabelOcrSession(session) || !isFailure(failure)) {
    throw new RangeError("Invalid shelf-label OCR benchmark failure");
  }

  if (Date.parse(failure.at) < Date.parse(session.createdAt)) {
    throw new RangeError(
      "Shelf-label OCR failure cannot predate session",
    );
  }

  if (session.failures.length >= SHELF_LABEL_OCR_FAILURE_LIMIT) {
    throw new RangeError("Shelf-label OCR failure limit reached");
  }

  return Object.freeze({
    ...session,
    failures: Object.freeze([
      ...session.failures,
      Object.freeze({ ...failure }),
    ]),
  });
};

export const updateShelfLabelOcrDeviceLabel = (
  session: ShelfLabelOcrSession,
  deviceLabel: string,
): ShelfLabelOcrSession => {
  if (deviceLabel.length > 160) {
    throw new RangeError("Shelf-label OCR device label is too long");
  }

  return Object.freeze({
    ...session,
    deviceLabel,
  });
};

export const updateShelfLabelOcrSubjective = (
  session: ShelfLabelOcrSession,
  preference: ShelfLabelOcrPreference | null,
  effort: ShelfLabelOcrEffort | null,
): ShelfLabelOcrSession => {
  if (
    (preference !== null && !isPreference(preference)) ||
    (effort !== null && !isEffort(effort))
  ) {
    throw new RangeError(
      "Invalid shelf-label OCR subjective evidence",
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

export const summarizeShelfLabelOcr = (
  session: ShelfLabelOcrSession,
): ShelfLabelOcrSummary => {
  const count = (outcome: ShelfLabelOcrOutcome): number =>
    session.samples.filter((sample) => sample.outcome === outcome).length;

  const top1Confirmed = count("top1-confirmed");
  const top3Confirmed = count("top3-confirmed");
  const rejected = count("rejected");
  const noCandidates = count("no-candidate");
  const timeouts = count("timeout");
  const manualFallbacks = count("manual-fallback");
  const ocrErrors = count("ocr-error");
  const parserErrors = count("parser-error");
  const captureErrors = count("capture-error");
  const attempts = session.samples.length;
  const decisions = top1Confirmed + top3Confirmed + rejected;
  const decisionDurations = session.samples
    .filter(
      (sample) =>
        sample.outcome === "top1-confirmed" ||
        sample.outcome === "top3-confirmed" ||
        sample.outcome === "rejected",
    )
    .map((sample) => sample.durationMs);
  const confirmedDurations = session.samples
    .filter(
      (sample) =>
        sample.outcome === "top1-confirmed" ||
        sample.outcome === "top3-confirmed",
    )
    .map((sample) => sample.durationMs);
  const failureCount = (type: ShelfLabelOcrFailureType): number =>
    session.failures.filter((failure) => failure.type === type).length;

  return Object.freeze({
    attempts,
    top1Confirmed,
    top3Confirmed,
    rejected,
    noCandidates,
    timeouts,
    manualFallbacks,
    ocrErrors,
    parserErrors,
    captureErrors,
    medianDecisionMs: percentile(decisionDurations, 0.5),
    p75DecisionMs: percentile(decisionDurations, 0.75),
    p90DecisionMs: percentile(decisionDurations, 0.9),
    medianConfirmedMs: percentile(confirmedDurations, 0.5),
    p75ConfirmedMs: percentile(confirmedDurations, 0.75),
    p90ConfirmedMs: percentile(confirmedDurations, 0.9),
    top1CorrectRate: rate(top1Confirmed, decisions),
    top3CorrectRate: rate(top1Confirmed + top3Confirmed, decisions),
    failureRate: rate(
      noCandidates +
        timeouts +
        ocrErrors +
        parserErrors +
        captureErrors,
      attempts,
    ),
    correctionRate: rate(rejected, decisions),
    fallbackRate: rate(manualFallbacks, attempts),
    ocrUnavailable: failureCount("ocr-unavailable"),
    cameraUnsupported: failureCount("camera-unsupported"),
    permissionDenied: failureCount("permission-denied"),
    cameraErrors: failureCount("camera-error"),
    preference: session.preference,
    effort: session.effort,
  });
};

export const persistShelfLabelOcrSession = (
  storage: Pick<Storage, "setItem">,
  session: ShelfLabelOcrSession,
): void => {
  if (!isShelfLabelOcrSession(session)) {
    throw new RangeError("Refusing to persist invalid OCR benchmark");
  }

  storage.setItem(SHELF_LABEL_OCR_STORAGE_KEY, JSON.stringify(session));
};

export const clearShelfLabelOcrSession = (
  storage: Pick<Storage, "removeItem">,
): void => {
  storage.removeItem(SHELF_LABEL_OCR_STORAGE_KEY);
};

export const loadShelfLabelOcrSession = (
  storage: Pick<Storage, "getItem" | "setItem">,
  environment: ShelfLabelOcrEnvironment,
  createdAt: string,
): ShelfLabelOcrLoadResult => {
  let raw: string | null = null;

  try {
    raw = storage.getItem(SHELF_LABEL_OCR_STORAGE_KEY);
  } catch {
    return {
      status: "ready",
      session: createShelfLabelOcrSession(environment, createdAt),
    };
  }

  if (raw === null) {
    const session = createShelfLabelOcrSession(environment, createdAt);

    try {
      persistShelfLabelOcrSession(storage, session);
    } catch {
      // Evidence storage failure must not break the isolated benchmark UI.
    }

    return { status: "ready", session };
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return isShelfLabelOcrSession(parsed)
      ? { status: "ready", session: parsed }
      : { status: "corrupt", session: null };
  } catch {
    return { status: "corrupt", session: null };
  }
};

const observationEndCoversSession = (
  session: ShelfLabelOcrSession,
  generatedAt: string,
): boolean => {
  const latest = Math.max(
    Date.parse(session.createdAt),
    ...session.samples.map((sample) => Date.parse(sample.completedAt)),
    ...session.failures.map((failure) => Date.parse(failure.at)),
  );

  return Date.parse(generatedAt) >= latest;
};

const sameShelfLabelOcrSummary = (
  value: unknown,
  expected: ShelfLabelOcrSummary,
): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(expected);

  return (
    exactKeys(record, keys) &&
    keys.every((key) =>
      Object.is(
        record[key],
        expected[key as keyof ShelfLabelOcrSummary],
      ),
    )
  );
};

export const buildShelfLabelOcrExport = (
  session: ShelfLabelOcrSession,
  generatedAt: string,
): ShelfLabelOcrExport => {
  if (!isShelfLabelOcrSession(session)) {
    throw new RangeError("Invalid shelf-label OCR benchmark session");
  }

  if (
    !isCanonicalIsoTimestamp(generatedAt) ||
    !observationEndCoversSession(session, generatedAt)
  ) {
    throw new RangeError("Shelf-label OCR export time is invalid");
  }

  if (!isEvidenceBuildRevision(EVIDENCE_BUILD_REVISION)) {
    throw new RangeError("Invalid evidence build revision");
  }

  return Object.freeze({
    schemaVersion: 2,
    kind: "shelf-label-ocr-benchmark-evidence",
    buildRevision: EVIDENCE_BUILD_REVISION,
    generatedAt,
    privacy: Object.freeze({
      networkTransmission:
        session.environment.dataBoundary === "remote-image",
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    }),
    session,
    summary: summarizeShelfLabelOcr(session),
  });
};

export const parseShelfLabelOcrExport = (
  value: unknown,
): ShelfLabelOcrExport | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !exactKeys(record, [
      "schemaVersion",
      "kind",
      "buildRevision",
      "generatedAt",
      "privacy",
      "session",
      "summary",
    ]) ||
    record.schemaVersion !== 2 ||
    record.kind !== "shelf-label-ocr-benchmark-evidence" ||
    !isEvidenceBuildRevision(record.buildRevision) ||
    !isCanonicalIsoTimestamp(record.generatedAt) ||
    !isShelfLabelOcrSession(record.session) ||
    !observationEndCoversSession(record.session, record.generatedAt)
  ) {
    return null;
  }

  if (typeof record.privacy !== "object" || record.privacy === null) {
    return null;
  }

  const privacy = record.privacy as Record<string, unknown>;
  const expectedNetworkTransmission =
    record.session.environment.dataBoundary === "remote-image";

  if (
    !exactKeys(privacy, [
      "networkTransmission",
      "containsRawImages",
      "containsRawOcrText",
      "containsPrices",
      "containsItemNames",
      "containsDeviceMetadata",
    ]) ||
    privacy.networkTransmission !== expectedNetworkTransmission ||
    privacy.containsRawImages !== false ||
    privacy.containsRawOcrText !== false ||
    privacy.containsPrices !== false ||
    privacy.containsItemNames !== false ||
    privacy.containsDeviceMetadata !== true
  ) {
    return null;
  }

  const summary = summarizeShelfLabelOcr(record.session);

  if (!sameShelfLabelOcrSummary(record.summary, summary)) {
    return null;
  }

  return Object.freeze({
    schemaVersion: 2,
    kind: "shelf-label-ocr-benchmark-evidence",
    buildRevision: record.buildRevision,
    generatedAt: record.generatedAt,
    privacy: Object.freeze({
      networkTransmission: expectedNetworkTransmission,
      containsRawImages: false,
      containsRawOcrText: false,
      containsPrices: false,
      containsItemNames: false,
      containsDeviceMetadata: true,
    }),
    session: record.session,
    summary,
  });
};
