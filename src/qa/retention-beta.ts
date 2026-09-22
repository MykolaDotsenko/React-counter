export const RETENTION_BETA_STORAGE_KEY =
  "budget-cart:qa:retention-v1";

export const RETENTION_BETA_EVENT_LIMIT = 5_000;

export type RetentionBetaTripSource = "new" | "repeat";

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

const isEvent = (value: unknown): value is RetentionBetaEvent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RetentionBetaEvent>;

  if (
    !isIsoTimestamp(candidate.at) ||
    !isTripOrdinal(candidate.tripOrdinal)
  ) {
    return false;
  }

  switch (candidate.type) {
    case "trip_started":
      return candidate.source === "new" || candidate.source === "repeat";
    case "item_milestone":
      return (
        candidate.itemCount === 1 ||
        candidate.itemCount === 5 ||
        candidate.itemCount === 10
      );
    case "manual_entry_completed":
      return (
        typeof candidate.durationMs === "number" &&
        Number.isFinite(candidate.durationMs) &&
        candidate.durationMs >= 0
      );
    case "trip_restored":
    case "manual_entry_abandoned":
    case "remembered_item_used":
    case "current_price_override_started":
    case "trip_finished":
      return true;
    default:
      return false;
  }
};

const isSession = (value: unknown): value is RetentionBetaSession => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RetentionBetaSession>;

  return (
    candidate.version === 1 &&
    candidate.variant === "repeat-acceleration" &&
    isIsoTimestamp(candidate.createdAt) &&
    Array.isArray(candidate.events) &&
    candidate.events.length <= RETENTION_BETA_EVENT_LIMIT &&
    candidate.events.every(isEvent)
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
    (event): event is Extract<
      RetentionBetaEvent,
      { readonly type: "trip_started" }
    > => event.type === "trip_started",
  );
  const manualDurations = session.events.flatMap((event) =>
    event.type === "manual_entry_completed" ? [event.durationMs] : [],
  );
  const firstTripStart = started.find((event) => event.tripOrdinal === 1);
  const secondTripStart = started.find((event) => event.tripOrdinal === 2);
  const daysToSecondTrip =
    firstTripStart === undefined || secondTripStart === undefined
      ? null
      : Math.max(
          0,
          (Date.parse(secondTripStart.at) - Date.parse(firstTripStart.at)) /
            86_400_000,
        );

  return {
    tripsStarted: uniqueTripCount(
      session.events,
      (event) => event.type === "trip_started",
    ),
    tripsFinished: uniqueTripCount(
      session.events,
      (event) => event.type === "trip_finished",
    ),
    secondTripStarted: started.some((event) => event.tripOrdinal >= 2),
    thirdTripStarted: started.some((event) => event.tripOrdinal >= 3),
    secondTripWithin7Days:
      daysToSecondTrip !== null && daysToSecondTrip <= 7,
    secondTripWithin14Days:
      daysToSecondTrip !== null && daysToSecondTrip <= 14,
    secondTripWithin30Days:
      daysToSecondTrip !== null && daysToSecondTrip <= 30,
    daysToSecondTrip,
    repeatTripStarts: started.filter((event) => event.source === "repeat")
      .length,
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
) => {
  if (!isIsoTimestamp(generatedAt)) {
    throw new RangeError("Retention beta export requires canonical ISO time");
  }

  return Object.freeze({
    schemaVersion: 1,
    generatedAt,
    privacy: {
      networkTransmission: false,
      containsMoney: false,
      containsItemNames: false,
      containsStoreHistory: false,
    },
    session,
    summary: summarizeRetentionBeta(session),
  });
};
