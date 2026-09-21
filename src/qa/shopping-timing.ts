export const QA_TIMING_STORAGE_KEY = "budget-cart:qa:timing-v1";

export const QA_TARGET_PRICE_479 = 479;
export const QA_TARGET_PRICE_1250 = 1_250;
export const QA_TARGET_SAMPLE_COUNT = 10;

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
  | "repeatedAddNoScroll";

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
}

export interface QaTimingSession {
  readonly version: 1;
  readonly environment: QaTimingEnvironment;
  readonly deviceLabel: string;
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
  version: 1,
  environment,
  deviceLabel: "",
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
    typeof candidate.repeatedAddNoScroll === "boolean"
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
    typeof candidate.completedAt === "string"
  );
};

const isQaTimingSession = (value: unknown): value is QaTimingSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QaTimingSession>;

  return (
    candidate.version === 1 &&
    isQaTimingEnvironment(candidate.environment) &&
    typeof candidate.deviceLabel === "string" &&
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
  const raw = storage.getItem(QA_TIMING_STORAGE_KEY);

  if (raw === null) {
    return createQaTimingSession(environment);
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isQaTimingSession(parsed)
      ? parsed
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

export const summarizeQaTimingSamples = (
  samples: readonly QaTimingSample[],
  lineTotalMinor: number,
): QaTimingSummary => {
  const durations = samples
    .filter(
      (sample) =>
        sample.lineTotalMinor === lineTotalMinor && sample.quantity === 1,
    )
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
