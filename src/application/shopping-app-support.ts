import type { PriceMemoryRecord } from "../domain/price-memory";
import type {
  CompletedTrip,
  IsoTimestamp,
} from "../domain/shopping-trip";
import type {
  AppCommandResult,
  ApplicationError,
  Durability,
  PersistenceHealth,
  PersistenceProblem,
  RecoveryState,
  ShoppingAppState,
} from "./shopping-app-contracts";

export const EMPTY_COMPLETED_TRIPS = Object.freeze(
  [],
) as readonly CompletedTrip[];
export const EMPTY_PRICE_MEMORIES = Object.freeze(
  [],
) as readonly PriceMemoryRecord[];

export const HEALTHY_PERSISTENCE = Object.freeze({
  status: "healthy",
}) as PersistenceHealth;

export const freezeState = (
  state: ShoppingAppState,
): ShoppingAppState => Object.freeze(state);

export const applicationError = (
  code: Extract<ApplicationError, { kind: "application" }>["code"],
): ApplicationError => ({
  kind: "application",
  code,
});

export const initialState = (): ShoppingAppState =>
  freezeState({
    lifecycle: "booting",
    activeTrip: null,
    completedSummary: null,
    completedTrips: EMPTY_COMPLETED_TRIPS,
    completionCleanupPending: false,
    persistence: HEALTHY_PERSISTENCE,
    priceMemories: EMPTY_PRICE_MEMORIES,
    priceMemoryPersistence: HEALTHY_PERSISTENCE,
    undo: null,
    recovery: null,
  });

export const degradedPersistence = (
  issue: PersistenceProblem,
  since: IsoTimestamp,
): PersistenceHealth =>
  Object.freeze({
    status: "degraded",
    issue,
    since,
  });

export const recoveryState = (
  issue: PersistenceProblem,
  raw: string | undefined,
): RecoveryState =>
  Object.freeze({
    issue,
    ...(raw === undefined ? {} : { raw }),
  });

export const success = (
  state: ShoppingAppState,
  changed: boolean,
  durability: Durability,
): AppCommandResult => ({
  ok: true,
  changed,
  durability,
  state,
});

export const failure = (
  state: ShoppingAppState,
  error: ApplicationError,
): AppCommandResult => ({
  ok: false,
  error,
  state,
});

export const upsertCompletedTrip = (
  trips: readonly CompletedTrip[],
  trip: CompletedTrip,
): readonly CompletedTrip[] => {
  const index = trips.findIndex((candidate) => candidate.id === trip.id);

  if (index < 0) {
    return Object.freeze([...trips, trip]);
  }

  return Object.freeze(
    trips.map((candidate, candidateIndex) =>
      candidateIndex === index ? trip : candidate,
    ),
  );
};
