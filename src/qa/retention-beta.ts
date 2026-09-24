export const RETENTION_BETA_STORAGE_KEY =
  "budget-cart:qa:retention-v1";

export const RETENTION_BETA_EVENT_LIMIT = 5_000;

export type RetentionBetaTripSource = "new" | "repeat" | "resume";

export type RetentionBetaEvent =
  | {
      readonly type: "trip_started";
      readonly at: string;
      readonly tripOrdinal: number;
      readonly source: RetentionBetaTripSource;
    }
  | {
      readonly type: "item_milestone";
      readonly at: string;
      readonly tripOrdinal: number;
      readonly itemCount: 1 | 5 | 10;
    }
  | {
      readonly type: "trip_restored";
      readonly at: string;
      readonly tripOrdinal: number;
    }
  | {
      readonly type: "manual_entry_completed";
      readonly at: string;
      readonly tripOrdinal: number;
      readonly durationMs: number;
    }
  | {
      readonly type: "manual_entry_abandoned";
      readonly at: string;
      readonly tripOrdinal: number;
    }
  | {
      readonly type: "remembered_item_used";
      readonly at: string;
      readonly tripOrdinal: number;
    }
  | {
      readonly type: "current_price_override_started";
      readonly at: string;
      readonly tripOrdinal: number;
    }
  | {
      readonly type: "trip_finished";
      readonly at: string;
      readonly tripOrdinal: number;
    };

export interface RetentionBetaSession {
  readonly version: 1;
  readonly variant: "repeat-acceleration";
  readonly createdAt: string;
  readonly events: readonly RetentionBetaEvent[];
}

export interface RetentionBetaSummary {
  readonly tripsStarted: number;
  readonly tripsFinished: number;
  readonly secondTripStarted: boolean;
  readonly thirdTripStarted: boolean;
  readonly secondTripWithin7Days: boolean;
  readonly secondTripWithin14Days: boolean;
  readonly secondTripWithin30Days: boolean;
  readonly daysToSecondTrip: number | null;
  readonly repeatTripStarts: number;
  readonly tripRestores: number;
  readonly firstItemTrips: number;
  readonly fifthItemTrips: number;
  readonly tenthItemTrips: number;
  readonly manualEntriesCompleted: number;
  readonly manualEntriesAbandoned: number;
  readonly medianManualEntryMs: number | null;
  readonly rememberedItemUses: number;
  readonly currentPriceOverrides: number;
}

export interface RetentionBetaExport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly privacy: {
    readonly networkTransmission: false;
    readonly containsMoney: false;
    readonly containsItemNames: false;
    readonly containsStoreHistory: false;
  };
  readonly session: RetentionBetaSession;
  readonly summary: RetentionBetaSummary;
}

const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const isTripOrdinal = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 1;

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

const isEvent = (value: unknown): value is RetentionBetaEvent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RetentionBetaEvent>;
  const record = value as Record<string, unknown>;

  if (
    !isIsoTimestamp(candidate.at) ||
    !isTripOrdinal(candidate.tripOrdinal)
  ) {
    return false;
  }

  switch (candidate.type) {
    case "trip_started":
      return (
        hasExactKeys(record, ["type", "at", "tripOrdinal", "source"]) &&
        (candidate.source === "new" ||
          candidate.source === "repeat" ||
          candidate.source === "resume")
      );
    case "item_milestone":
      return (
        hasExactKeys(record, ["type", "at", "tripOrdinal", "itemCount"]) &&
        (candidate.itemCount === 1 ||
          candidate.itemCount === 5 ||
          candidate.itemCount === 10)
      );
    case "manual_entry_completed":
      return (
        hasExactKeys(record, ["type", "at", "tripOrdinal", "durationMs"]) &&
        typeof candidate.durationMs === "number" &&
        Number.isFinite(candidate.durationMs) &&
        candidate.durationMs >= 0
      );
    case "trip_restored":
    case "manual_entry_abandoned":
    case "remembered_item_used":
    case "current_price_override_started":
    case "trip_finished":
      return hasExactKeys(record, ["type", "at", "tripOrdinal"]);
    default:
      return false;
  }
};

const eventsDoNotPredateSession = (
  createdAt: string,
  events: readonly RetentionBetaEvent[],
): boolean => {
  const createdAtMs = Date.parse(createdAt);

  return events.every(
    (event) => Date.parse(event.at) >= createdAtMs,
  );
};

const observationEndCoversSession = (
  session: RetentionBetaSession,
  generatedAt: string,
): boolean => {
  const generatedAtMs = Date.parse(generatedAt);
  const latestEvidenceMs = Math.max(
    Date.parse(session.createdAt),
    ...session.events.map((event) => Date.parse(event.at)),
  );

  return generatedAtMs >= latestEvidenceMs;
};

const isSession = (value: unknown): value is RetentionBetaSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RetentionBetaSession>;
  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, ["version", "variant", "createdAt", "events"]) &&
    candidate.version === 1 &&
    candidate.variant === "repeat-acceleration" &&
    isIsoTimestamp(candidate.createdAt) &&
    Array.isArray(candidate.events) &&
    candidate.events.length <= RETENTION_BETA_EVENT_LIMIT &&
    candidate.events.every(isEvent) &&
    eventsDoNotPredateSession(
      candidate.createdAt,
      candidate.events,
    )
  );
};

export const createRetentionBetaSession = (
  createdAt: string,
): RetentionBetaSession => {
  if (!isIsoTimestamp(createdAt)) {
    throw new RangeError("Retention beta session requires canonical ISO time");
  }

  return Object.freeze({
    version: 1,
    variant: "repeat-acceleration",
    createdAt,
    events: Object.freeze([]),
  });
};

const sameMilestone = (
  left: RetentionBetaEvent,
  right: RetentionBetaEvent,
): boolean =>
  left.type === "item_milestone" &&
  right.type === "item_milestone" &&
  left.tripOrdinal === right.tripOrdinal &&
  left.itemCount === right.itemCount;

export const appendRetentionBetaEvent = (
  session: RetentionBetaSession,
  event: RetentionBetaEvent,
): RetentionBetaSession => {
  if (!isEvent(event)) {
    throw new RangeError("Invalid retention beta event");
  }

  if (
    event.type === "item_milestone" &&
    session.events.some((candidate) => sameMilestone(candidate, event))
  ) {
    return session;
  }

  const events = [...session.events, event].slice(
    -RETENTION_BETA_EVENT_LIMIT,
  );

  return Object.freeze({
    ...session,
    events: Object.freeze(events),
  });
};

export const loadRetentionBetaSession = (
  storage: Pick<Storage, "getItem">,
  now: string,
): RetentionBetaSession => {
  const fallback = createRetentionBetaSession(now);
  let raw: string | null;

  try {
    raw = storage.getItem(RETENTION_BETA_STORAGE_KEY);
  } catch {
    return fallback;
  }

  if (raw === null) {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const persistRetentionBetaSession = (
  storage: Pick<Storage, "setItem">,
  session: RetentionBetaSession,
): void => {
  storage.setItem(
    RETENTION_BETA_STORAGE_KEY,
    JSON.stringify(session),
  );
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

const uniqueTripCount = (
  events: readonly RetentionBetaEvent[],
  predicate: (event: RetentionBetaEvent) => boolean,
): number =>
  new Set(
    events
      .filter(predicate)
      .map((event) => event.tripOrdinal),
  ).size;

type TripStartedEvent = Extract<
  RetentionBetaEvent,
  { readonly type: "trip_started" }
>;

const earliestTripStart = (
  started: readonly TripStartedEvent[],
  tripOrdinal: number,
): TripStartedEvent | undefined =>
  started
    .filter((event) => event.tripOrdinal === tripOrdinal)
    .reduce<TripStartedEvent | undefined>(
      (earliest, candidate) =>
        earliest === undefined ||
        Date.parse(candidate.at) < Date.parse(earliest.at)
          ? candidate
          : earliest,
      undefined,
    );

const hasSequentialStartsThrough = (
  started: readonly TripStartedEvent[],
  targetOrdinal: number,
): boolean => {
  let previousStartedAt = -Infinity;

  for (let ordinal = 1; ordinal <= targetOrdinal; ordinal += 1) {
    const current = earliestTripStart(started, ordinal);

    if (current === undefined) {
      return false;
    }

    const currentStartedAt = Date.parse(current.at);

    if (currentStartedAt < previousStartedAt) {
      return false;
    }

    previousStartedAt = currentStartedAt;
  }

  return true;
};

const contiguousStartedTripCount = (
  started: readonly TripStartedEvent[],
): number => {
  const highestObservedOrdinal = started.reduce(
    (highest, event) => Math.max(highest, event.tripOrdinal),
    0,
  );

  let count = 0;

  for (
    let ordinal = 1;
    ordinal <= highestObservedOrdinal;
    ordinal += 1
  ) {
    if (!hasSequentialStartsThrough(started, ordinal)) {
      break;
    }

    count = ordinal;
  }

  return count;
};

const completedStartedTripCount = (
  events: readonly RetentionBetaEvent[],
  started: readonly TripStartedEvent[],
): number => {
  const completedOrdinals = new Set<number>();

  for (const start of started) {
    const startedAt = Date.parse(start.at);
    const completed = events.some(
      (event) =>
        event.type === "trip_finished" &&
        event.tripOrdinal === start.tripOrdinal &&
        Date.parse(event.at) >= startedAt,
    );

    if (completed) {
      completedOrdinals.add(start.tripOrdinal);
    }
  }

  return completedOrdinals.size;
};

export const nextRetentionTripOrdinal = (
  session: RetentionBetaSession,
): number => {
  const ordinals = session.events.map((event) => event.tripOrdinal);

  return ordinals.length === 0 ? 1 : Math.max(...ordinals) + 1;
};

export const currentRetentionTripOrdinal = (
  session: RetentionBetaSession,
): number | null => {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];

    if (event?.type !== "trip_started") {
      continue;
    }

    const finishedLater = session.events
      .slice(index + 1)
      .some(
        (candidate) =>
          candidate.type === "trip_finished" &&
          candidate.tripOrdinal === event.tripOrdinal,
      );

    if (!finishedLater) {
      return event.tripOrdinal;
    }
  }

  return null;
};

export const summarizeRetentionBeta = (
  session: RetentionBetaSession,
): RetentionBetaSummary => {
  const started = session.events.filter(
    (event): event is TripStartedEvent =>
      event.type === "trip_started",
  );
  const manualDurations = session.events.flatMap((event) =>
    event.type === "manual_entry_completed" ? [event.durationMs] : [],
  );
  const tripsStarted = contiguousStartedTripCount(started);
  const secondTripStarted = hasSequentialStartsThrough(started, 2);
  const thirdTripStarted = hasSequentialStartsThrough(started, 3);
  const firstTripStart = earliestTripStart(started, 1);
  const secondTripStart = earliestTripStart(started, 2);
  const daysToSecondTrip =
    !secondTripStarted ||
    firstTripStart === undefined ||
    secondTripStart === undefined
      ? null
      : (Date.parse(secondTripStart.at) - Date.parse(firstTripStart.at)) /
        86_400_000;

  return {
    tripsStarted,
    tripsFinished: completedStartedTripCount(
      session.events,
      started,
    ),
    secondTripStarted,
    thirdTripStarted,
    secondTripWithin7Days:
      daysToSecondTrip !== null && daysToSecondTrip <= 7,
    secondTripWithin14Days:
      daysToSecondTrip !== null && daysToSecondTrip <= 14,
    secondTripWithin30Days:
      daysToSecondTrip !== null && daysToSecondTrip <= 30,
    daysToSecondTrip,
    repeatTripStarts: started.filter(
      (event) =>
        event.source === "repeat" &&
        event.tripOrdinal >= 2 &&
        hasSequentialStartsThrough(started, event.tripOrdinal),
    ).length,
    tripRestores: session.events.filter(
      (event) => event.type === "trip_restored",
    ).length,
    firstItemTrips: uniqueTripCount(
      session.events,
      (event) =>
        event.type === "item_milestone" && event.itemCount === 1,
    ),
    fifthItemTrips: uniqueTripCount(
      session.events,
      (event) =>
        event.type === "item_milestone" && event.itemCount === 5,
    ),
    tenthItemTrips: uniqueTripCount(
      session.events,
      (event) =>
        event.type === "item_milestone" && event.itemCount === 10,
    ),
    manualEntriesCompleted: manualDurations.length,
    manualEntriesAbandoned: session.events.filter(
      (event) => event.type === "manual_entry_abandoned",
    ).length,
    medianManualEntryMs: median(manualDurations),
    rememberedItemUses: session.events.filter(
      (event) => event.type === "remembered_item_used",
    ).length,
    currentPriceOverrides: session.events.filter(
      (event) => event.type === "current_price_override_started",
    ).length,
  };
};

export const buildRetentionBetaExport = (
  session: RetentionBetaSession,
  generatedAt: string,
): RetentionBetaExport => {
  if (!isIsoTimestamp(generatedAt)) {
    throw new RangeError("Retention beta export requires canonical ISO time");
  }

  if (!observationEndCoversSession(session, generatedAt)) {
    throw new RangeError(
      "Retention beta export time cannot predate session evidence",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    generatedAt,
    privacy: Object.freeze({
      networkTransmission: false,
      containsMoney: false,
      containsItemNames: false,
      containsStoreHistory: false,
    }),
    session,
    summary: summarizeRetentionBeta(session),
  });
};

export const parseRetentionBetaExport = (
  value: unknown,
): RetentionBetaExport | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !hasExactKeys(record, [
      "schemaVersion",
      "generatedAt",
      "privacy",
      "session",
      "summary",
    ]) ||
    record.schemaVersion !== 1 ||
    !isIsoTimestamp(record.generatedAt) ||
    !isSession(record.session)
  ) {
    return null;
  }

  if (!observationEndCoversSession(record.session, record.generatedAt)) {
    return null;
  }

  if (
    typeof record.privacy !== "object" ||
    record.privacy === null ||
    typeof record.summary !== "object" ||
    record.summary === null
  ) {
    return null;
  }

  const privacy = record.privacy as Record<string, unknown>;

  if (
    !hasExactKeys(privacy, [
      "networkTransmission",
      "containsMoney",
      "containsItemNames",
      "containsStoreHistory",
    ]) ||
    privacy.networkTransmission !== false ||
    privacy.containsMoney !== false ||
    privacy.containsItemNames !== false ||
    privacy.containsStoreHistory !== false
  ) {
    return null;
  }

  const importedSummary = record.summary as Record<string, unknown>;
  const summary = summarizeRetentionBeta(record.session);
  const summaryKeys = Object.keys(summary);

  if (
    !hasExactKeys(importedSummary, summaryKeys) ||
    !summaryKeys.every((key) =>
      Object.is(importedSummary[key], summary[key as keyof RetentionBetaSummary]),
    )
  ) {
    return null;
  }

  return Object.freeze({
    schemaVersion: 1,
    generatedAt: record.generatedAt,
    privacy: Object.freeze({
      networkTransmission: false,
      containsMoney: false,
      containsItemNames: false,
      containsStoreHistory: false,
    }),
    session: record.session,
    summary,
  });
};
