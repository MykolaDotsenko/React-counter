export const QA_TIMING_STORAGE_KEY = "budget-cart:qa:timing-v3";
export const LEGACY_QA_TIMING_STORAGE_KEY =
  "budget-cart:qa:timing-v2";

export const QA_TARGET_PRICE_479 = 479;
export const QA_TARGET_PRICE_1250 = 1_250;
export const QA_TARGET_SAMPLE_COUNT = 10;
export const QA_FIXTURE_BUDGET_MINOR = 50_000;
export const QA_FIXTURE_BUFFER_MINOR = 0;

export type QaChecklistKey =
  | "addPriceReachable"
  | "numericKeysReachable"
  | "cancelReachable"
  | "projectionReadable"
  | "reserveWithoutColour"
  | "addPlacementStable"
  | "keypadCloses"
  | "brightSummaryReadable"
  | "softwareKeyboardClear"
  | "repeatedAddNoScroll"
  | "typoCorrectionWorks"
  | "fiveConsecutiveAddsSmooth"
  | "consistentInputMethod"
  | "compactSpotCheckRecorded";

export interface QaTimingEnvironment {
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly devicePixelRatio: number;
  readonly colorScheme: "light" | "dark";
  readonly reducedMotion: boolean;
}

export interface QaTimingSample {
  readonly id: string;
  readonly durationMs: number;
  readonly unitPriceMinor: number;
  readonly quantity: number;
  readonly lineTotalMinor: number;
  readonly budgetMinor: number;
  readonly safetyBufferMinor: number;
  readonly completedAt: string;
}

export interface QaTimingChecklist {
  readonly addPriceReachable: boolean;
  readonly numericKeysReachable: boolean;
  readonly cancelReachable: boolean;
  readonly projectionReadable: boolean;
  readonly reserveWithoutColour: boolean;
  readonly addPlacementStable: boolean;
  readonly keypadCloses: boolean;
  readonly brightSummaryReadable: boolean;
  readonly softwareKeyboardClear: boolean;
  readonly repeatedAddNoScroll: boolean;
  readonly typoCorrectionWorks: boolean;
  readonly fiveConsecutiveAddsSmooth: boolean;
  readonly consistentInputMethod: boolean;
  readonly compactSpotCheckRecorded: boolean;
}

export interface QaPhysicalContext {
  readonly oneHanded: boolean;
  readonly brightStoreLikeLighting: boolean;
  readonly defaultTextSize: boolean;
}

export type QaSpotCheckStatus = "not-run" | "pass" | "fail";

export interface QaSpotChecks {
  readonly darkAppearance: QaSpotCheckStatus;
  readonly largeText200: QaSpotCheckStatus;
  readonly reducedMotion: QaSpotCheckStatus;
}

export interface QaTimingSession {
  readonly version: 3;
  readonly environment: QaTimingEnvironment;
  readonly deviceLabel: string;
  readonly compactDeviceLabel: string;
  readonly inputMethodLabel: string;
  readonly physicalContext: QaPhysicalContext;
  readonly spotChecks: QaSpotChecks;
  readonly notes: string;
  readonly checklist: QaTimingChecklist;
  readonly samples: readonly QaTimingSample[];
}

export interface QaTimingSummary {
  readonly count: number;
  readonly medianMs: number | null;
  readonly p75Ms: number | null;
  readonly maxMs: number | null;
  readonly status: "pending" | "target-met" | "release-floor" | "fail";
}

export interface QaEmpiricalGateSummary {
  readonly eur479: QaTimingSummary;
  readonly eur1250: QaTimingSummary;
  readonly checklistComplete: boolean;
  readonly deviceLabelPresent: boolean;
  readonly compactDeviceLabelPresent: boolean;
  readonly inputMethodPresent: boolean;
  readonly physicalContextComplete: boolean;
  readonly lightAppearanceRecorded: boolean;
  readonly phonePortraitViewport: boolean;
  readonly secondarySpotChecksRecorded: number;
  readonly secondarySpotCheckFailures: number;
  readonly ignoredSampleCount: number;
  readonly status: "pending" | "target-met" | "release-floor" | "fail";
  readonly releaseEligible: boolean;
}

const emptyChecklist = (): QaTimingChecklist => ({
  addPriceReachable: false,
  numericKeysReachable: false,
  cancelReachable: false,
  projectionReadable: false,
  reserveWithoutColour: false,
  addPlacementStable: false,
  keypadCloses: false,
  brightSummaryReadable: false,
  softwareKeyboardClear: false,
  repeatedAddNoScroll: false,
  typoCorrectionWorks: false,
  fiveConsecutiveAddsSmooth: false,
  consistentInputMethod: false,
  compactSpotCheckRecorded: false,
});

const emptyPhysicalContext = (): QaPhysicalContext => ({
  oneHanded: false,
  brightStoreLikeLighting: false,
  defaultTextSize: false,
});

const emptySpotChecks = (): QaSpotChecks => ({
  darkAppearance: "not-run",
  largeText200: "not-run",
  reducedMotion: "not-run",
});

export const captureQaTimingEnvironment = (): QaTimingEnvironment => ({
  userAgent: navigator.userAgent,
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
  screenWidth: window.screen.width,
  screenHeight: window.screen.height,
  devicePixelRatio: window.devicePixelRatio,
  colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light",
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});

export const createQaTimingSession = (
  environment: QaTimingEnvironment,
): QaTimingSession => ({
  version: 3,
  environment,
  deviceLabel: "",
  compactDeviceLabel: "",
  inputMethodLabel: "",
  physicalContext: emptyPhysicalContext(),
  spotChecks: emptySpotChecks(),
  notes: "",
  checklist: emptyChecklist(),
  samples: [],
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isQaTimingEnvironment = (
  value: unknown,
): value is QaTimingEnvironment => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaTimingEnvironment>;

  return (
    typeof candidate.userAgent === "string" &&
    isFiniteNumber(candidate.viewportWidth) &&
    isFiniteNumber(candidate.viewportHeight) &&
    isFiniteNumber(candidate.screenWidth) &&
    isFiniteNumber(candidate.screenHeight) &&
    isFiniteNumber(candidate.devicePixelRatio) &&
    (candidate.colorScheme === "light" ||
      candidate.colorScheme === "dark") &&
    typeof candidate.reducedMotion === "boolean"
  );
};

const isQaTimingChecklist = (
  value: unknown,
): value is QaTimingChecklist => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaTimingChecklist>;

  return (
    typeof candidate.addPriceReachable === "boolean" &&
    typeof candidate.numericKeysReachable === "boolean" &&
    typeof candidate.cancelReachable === "boolean" &&
    typeof candidate.projectionReadable === "boolean" &&
    typeof candidate.reserveWithoutColour === "boolean" &&
    typeof candidate.addPlacementStable === "boolean" &&
    typeof candidate.keypadCloses === "boolean" &&
    typeof candidate.brightSummaryReadable === "boolean" &&
    typeof candidate.softwareKeyboardClear === "boolean" &&
    typeof candidate.repeatedAddNoScroll === "boolean" &&
    typeof candidate.typoCorrectionWorks === "boolean" &&
    typeof candidate.fiveConsecutiveAddsSmooth === "boolean" &&
    typeof candidate.consistentInputMethod === "boolean" &&
    typeof candidate.compactSpotCheckRecorded === "boolean"
  );
};

const isQaTimingSample = (value: unknown): value is QaTimingSample => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaTimingSample>;

  return (
    typeof candidate.id === "string" &&
    isFiniteNumber(candidate.durationMs) &&
    candidate.durationMs >= 0 &&
    isFiniteNumber(candidate.unitPriceMinor) &&
    Number.isSafeInteger(candidate.unitPriceMinor) &&
    isFiniteNumber(candidate.quantity) &&
    Number.isSafeInteger(candidate.quantity) &&
    candidate.quantity >= 1 &&
    isFiniteNumber(candidate.lineTotalMinor) &&
    Number.isSafeInteger(candidate.lineTotalMinor) &&
    isFiniteNumber(candidate.budgetMinor) &&
    Number.isSafeInteger(candidate.budgetMinor) &&
    candidate.budgetMinor > 0 &&
    isFiniteNumber(candidate.safetyBufferMinor) &&
    Number.isSafeInteger(candidate.safetyBufferMinor) &&
    candidate.safetyBufferMinor >= 0 &&
    typeof candidate.completedAt === "string"
  );
};

const isQaPhysicalContext = (
  value: unknown,
): value is QaPhysicalContext => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaPhysicalContext>;

  return (
    typeof candidate.oneHanded === "boolean" &&
    typeof candidate.brightStoreLikeLighting === "boolean" &&
    typeof candidate.defaultTextSize === "boolean"
  );
};

const isSpotCheckStatus = (
  value: unknown,
): value is QaSpotCheckStatus =>
  value === "not-run" || value === "pass" || value === "fail";

const isQaSpotChecks = (value: unknown): value is QaSpotChecks => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaSpotChecks>;

  return (
    isSpotCheckStatus(candidate.darkAppearance) &&
    isSpotCheckStatus(candidate.largeText200) &&
    isSpotCheckStatus(candidate.reducedMotion)
  );
};

interface QaTimingSessionV2 {
  readonly version: 2;
  readonly environment: QaTimingEnvironment;
  readonly deviceLabel: string;
  readonly compactDeviceLabel: string;
  readonly notes: string;
  readonly checklist: QaTimingChecklist;
  readonly samples: readonly QaTimingSample[];
}

const isQaTimingSessionV2 = (
  value: unknown,
): value is QaTimingSessionV2 => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaTimingSessionV2>;

  return (
    candidate.version === 2 &&
    isQaTimingEnvironment(candidate.environment) &&
    typeof candidate.deviceLabel === "string" &&
    typeof candidate.compactDeviceLabel === "string" &&
    typeof candidate.notes === "string" &&
    isQaTimingChecklist(candidate.checklist) &&
    Array.isArray(candidate.samples) &&
    candidate.samples.every(isQaTimingSample)
  );
};

const migrateQaTimingSessionV2 = (
  session: QaTimingSessionV2,
): QaTimingSession => ({
  version: 3,
  environment: session.environment,
  deviceLabel: session.deviceLabel,
  compactDeviceLabel: session.compactDeviceLabel,
  inputMethodLabel: "",
  physicalContext: emptyPhysicalContext(),
  spotChecks: emptySpotChecks(),
  notes: session.notes,
  checklist: session.checklist,
  samples: session.samples,
});

const isQaTimingSession = (value: unknown): value is QaTimingSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaTimingSession>;

  return (
    candidate.version === 3 &&
    isQaTimingEnvironment(candidate.environment) &&
    typeof candidate.deviceLabel === "string" &&
    typeof candidate.compactDeviceLabel === "string" &&
    typeof candidate.inputMethodLabel === "string" &&
    isQaPhysicalContext(candidate.physicalContext) &&
    isQaSpotChecks(candidate.spotChecks) &&
    typeof candidate.notes === "string" &&
    isQaTimingChecklist(candidate.checklist) &&
    Array.isArray(candidate.samples) &&
    candidate.samples.every(isQaTimingSample)
  );
};

export const loadQaTimingSession = (
  storage: Storage,
  environment: QaTimingEnvironment,
): QaTimingSession => {
  const raw =
    storage.getItem(QA_TIMING_STORAGE_KEY) ??
    storage.getItem(LEGACY_QA_TIMING_STORAGE_KEY);

  if (raw === null) {
    return createQaTimingSession(environment);
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (isQaTimingSession(parsed)) {
      return parsed;
    }

    return isQaTimingSessionV2(parsed)
      ? migrateQaTimingSessionV2(parsed)
      : createQaTimingSession(environment);
  } catch {
    return createQaTimingSession(environment);
  }
};

export const persistQaTimingSession = (
  storage: Storage,
  session: QaTimingSession,
): void => {
  storage.setItem(QA_TIMING_STORAGE_KEY, JSON.stringify(session));
};

export const appendQaTimingSample = (
  session: QaTimingSession,
  sample: QaTimingSample,
): QaTimingSession => ({
  ...session,
  samples: [...session.samples, sample],
});

export const updateQaChecklist = (
  session: QaTimingSession,
  key: QaChecklistKey,
  value: boolean,
): QaTimingSession => ({
  ...session,
  checklist: {
    ...session.checklist,
    [key]: value,
  },
});

export const updateQaTimingNotes = (
  session: QaTimingSession,
  notes: string,
): QaTimingSession => ({
  ...session,
  notes,
});

export const updateQaDeviceLabel = (
  session: QaTimingSession,
  deviceLabel: string,
): QaTimingSession => ({
  ...session,
  deviceLabel,
});

export const updateQaCompactDeviceLabel = (
  session: QaTimingSession,
  compactDeviceLabel: string,
): QaTimingSession => ({
  ...session,
  compactDeviceLabel,
});

export const updateQaInputMethodLabel = (
  session: QaTimingSession,
  inputMethodLabel: string,
): QaTimingSession => ({
  ...session,
  inputMethodLabel,
});

export const updateQaPhysicalContext = (
  session: QaTimingSession,
  key: keyof QaPhysicalContext,
  value: boolean,
): QaTimingSession => ({
  ...session,
  physicalContext: {
    ...session.physicalContext,
    [key]: value,
  },
});

export const updateQaSpotCheck = (
  session: QaTimingSession,
  key: keyof QaSpotChecks,
  value: QaSpotCheckStatus,
): QaTimingSession => ({
  ...session,
  spotChecks: {
    ...session.spotChecks,
    [key]: value,
  },
});

export const resetQaTimingSamples = (
  session: QaTimingSession,
): QaTimingSession => ({
  ...session,
  samples: [],
});

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

const isRepresentativeTimingSample = (
  sample: QaTimingSample,
  lineTotalMinor?: number,
): boolean =>
  sample.quantity === 1 &&
  sample.budgetMinor === QA_FIXTURE_BUDGET_MINOR &&
  sample.safetyBufferMinor === QA_FIXTURE_BUFFER_MINOR &&
  (lineTotalMinor === undefined || sample.lineTotalMinor === lineTotalMinor);

export const summarizeQaTimingSamples = (
  samples: readonly QaTimingSample[],
  lineTotalMinor: number,
): QaTimingSummary => {
  const durations = samples
    .filter((sample) => isRepresentativeTimingSample(sample, lineTotalMinor))
    .map((sample) => sample.durationMs);

  const medianMs = median(durations);
  const p75Ms = percentile(durations, 0.75);
  const maxMs =
    durations.length === 0 ? null : Math.max(...durations);

  const status =
    medianMs === null || durations.length < QA_TARGET_SAMPLE_COUNT
      ? "pending"
      : medianMs <= 2_500
        ? "target-met"
        : medianMs <= 3_000
          ? "release-floor"
          : "fail";

  return {
    count: durations.length,
    medianMs,
    p75Ms,
    maxMs,
    status,
  };
};

export const qaChecklistComplete = (
  checklist: QaTimingChecklist,
): boolean => Object.values(checklist).every(Boolean);

const targetSampleCount = (
  samples: readonly QaTimingSample[],
): number =>
  samples.filter(
    (sample) =>
      isRepresentativeTimingSample(sample) &&
      (sample.lineTotalMinor === QA_TARGET_PRICE_479 ||
        sample.lineTotalMinor === QA_TARGET_PRICE_1250),
  ).length;

const isPhonePortraitEnvironment = (
  environment: QaTimingEnvironment,
): boolean =>
  environment.viewportWidth >= 340 &&
  environment.viewportWidth <= 430 &&
  environment.viewportHeight > environment.viewportWidth;

export const summarizeQaEmpiricalGate = (
  session: QaTimingSession,
): QaEmpiricalGateSummary => {
  const eur479 = summarizeQaTimingSamples(
    session.samples,
    QA_TARGET_PRICE_479,
  );
  const eur1250 = summarizeQaTimingSamples(
    session.samples,
    QA_TARGET_PRICE_1250,
  );
  const checklistComplete = qaChecklistComplete(session.checklist);
  const deviceLabelPresent = session.deviceLabel.trim().length > 0;
  const compactDeviceLabelPresent =
    session.compactDeviceLabel.trim().length > 0;
  const inputMethodPresent = session.inputMethodLabel.trim().length > 0;
  const physicalContextComplete =
    session.physicalContext.oneHanded &&
    session.physicalContext.brightStoreLikeLighting &&
    session.physicalContext.defaultTextSize;
  const spotCheckValues = Object.values(session.spotChecks);
  const secondarySpotChecksRecorded = spotCheckValues.filter(
    (value) => value !== "not-run",
  ).length;
  const secondarySpotCheckFailures = spotCheckValues.filter(
    (value) => value === "fail",
  ).length;
  const lightAppearanceRecorded = session.environment.colorScheme === "light";
  const phonePortraitViewport = isPhonePortraitEnvironment(
    session.environment,
  );
  const ignoredSampleCount =
    session.samples.length - targetSampleCount(session.samples);

  const evidenceComplete =
    eur479.count >= QA_TARGET_SAMPLE_COUNT &&
    eur1250.count >= QA_TARGET_SAMPLE_COUNT &&
    checklistComplete &&
    deviceLabelPresent &&
    compactDeviceLabelPresent &&
    inputMethodPresent &&
    physicalContextComplete &&
    lightAppearanceRecorded &&
    phonePortraitViewport;

  let status: QaEmpiricalGateSummary["status"] =
    secondarySpotCheckFailures > 0 ? "fail" : "pending";

  if (evidenceComplete && secondarySpotCheckFailures === 0) {
    if (eur479.status === "fail" || eur1250.status === "fail") {
      status = "fail";
    } else if (
      eur479.status === "release-floor" ||
      eur1250.status === "release-floor"
    ) {
      status = "release-floor";
    } else if (
      eur479.status === "target-met" &&
      eur1250.status === "target-met"
    ) {
      status = "target-met";
    }
  }

  return {
    eur479,
    eur1250,
    checklistComplete,
    deviceLabelPresent,
    compactDeviceLabelPresent,
    inputMethodPresent,
    physicalContextComplete,
    lightAppearanceRecorded,
    phonePortraitViewport,
    secondarySpotChecksRecorded,
    secondarySpotCheckFailures,
    ignoredSampleCount,
    status,
    releaseEligible:
      status === "target-met" || status === "release-floor",
  };
};
