import type { MinorUnits } from "../domain/money";
import {
  createActiveTrip,
  createCartItem,
  reduceTrip,
  type ActiveTrip,
  type CompletedTrip,
  type DomainError,
  type IsoTimestamp,
  type TripCommand,
} from "../domain/shopping-trip";

export interface PersistenceProblem {
  readonly code: string;
  readonly storageKey?: string;
  readonly schemaVersion?: number;
}

export interface ActiveTripPersistencePort {
  bootstrap(): ActiveTripBootstrapResult;
  save(
    trip: ActiveTrip,
    savedAt: IsoTimestamp,
  ): ActiveTripSaveResult;
}

export type ActiveTripBootstrapResult =
  | {
      readonly ok: true;
      readonly activeTrip: ActiveTrip | null;
    }
  | {
      readonly ok: false;
      readonly activeTrip: ActiveTrip | null;
      readonly issue: PersistenceProblem;
      readonly recoveryRequired: boolean;
      readonly recoveryRaw?: string;
    };

export type ActiveTripSaveResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly issue: PersistenceProblem;
    };

export interface Clock {
  now(): IsoTimestamp;
}

export interface IdGenerator {
  tripId(): string;
  itemId(): string;
}

export type AppLifecycle = "booting" | "idle" | "active" | "recovery";

export type PersistenceHealth =
  | {
      readonly status: "healthy";
    }
  | {
      readonly status: "degraded";
      readonly issue: PersistenceProblem;
      readonly since: IsoTimestamp;
    };

export interface UndoState {
  readonly previousTrip: ActiveTrip;
  readonly description: "add" | "edit" | "remove";
}

export interface RecoveryState {
  readonly issue: PersistenceProblem;
  readonly raw?: string;
}

export interface ShoppingAppState {
  readonly lifecycle: AppLifecycle;
  readonly activeTrip: ActiveTrip | null;
  readonly completedTrips: readonly CompletedTrip[];
  readonly persistence: PersistenceHealth;
  readonly undo: UndoState | null;
  readonly recovery: RecoveryState | null;
}

export interface StartTripInput {
  readonly budgetMinor: MinorUnits;
  readonly safetyBufferMinor?: MinorUnits;
}

export interface AddManualItemInput {
  readonly unitPriceMinor: MinorUnits;
  readonly quantity: number;
}

type ActiveTripCommand = Exclude<
  TripCommand,
  { readonly type: "complete-trip" } | { readonly type: "set-actual-checkout" }
>;

export type ApplicationError =
  | {
      readonly kind: "application";
      readonly code:
        | "not-ready"
        | "active-trip-exists"
        | "recovery-required"
        | "no-active-trip";
    }
  | DomainError;

export type Durability = "persisted" | "memory-only" | "unchanged";

export type AppCommandResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly durability: Durability;
      readonly state: ShoppingAppState;
    }
  | {
      readonly ok: false;
      readonly error: ApplicationError;
      readonly state: ShoppingAppState;
    };

export interface ShoppingAppController {
  readonly getSnapshot: () => ShoppingAppState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly bootstrap: () => ShoppingAppState;
  readonly startTrip: (input: StartTripInput) => AppCommandResult;
  readonly addManualItem: (input: AddManualItemInput) => AppCommandResult;
  readonly retryPersistence: () => AppCommandResult;
  readonly dispatch: (command: ActiveTripCommand) => AppCommandResult;
}

export interface ShoppingAppControllerDependencies {
  readonly persistence: ActiveTripPersistencePort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const EMPTY_COMPLETED_TRIPS = Object.freeze([]) as readonly CompletedTrip[];

const HEALTHY_PERSISTENCE = Object.freeze({
  status: "healthy",
}) as PersistenceHealth;

const freezeState = (state: ShoppingAppState): ShoppingAppState =>
  Object.freeze(state);

const applicationError = (
  code: Extract<ApplicationError, { kind: "application" }>["code"],
): ApplicationError => ({
  kind: "application",
  code,
});

const initialState = (): ShoppingAppState =>
  freezeState({
    lifecycle: "booting",
    activeTrip: null,
    completedTrips: EMPTY_COMPLETED_TRIPS,
    persistence: HEALTHY_PERSISTENCE,
    undo: null,
    recovery: null,
  });

const degradedPersistence = (
  issue: PersistenceProblem,
  since: IsoTimestamp,
): PersistenceHealth =>
  Object.freeze({
    status: "degraded",
    issue,
    since,
  });

const recoveryState = (
  issue: PersistenceProblem,
  raw: string | undefined,
): RecoveryState =>
  Object.freeze({
    issue,
    ...(raw === undefined ? {} : { raw }),
  });

const success = (
  state: ShoppingAppState,
  changed: boolean,
  durability: Durability,
): AppCommandResult => ({
  ok: true,
  changed,
  durability,
  state,
});

const failure = (
  state: ShoppingAppState,
  error: ApplicationError,
): AppCommandResult => ({
  ok: false,
  error,
  state,
});

export const createShoppingAppController = ({
  persistence,
  clock,
  ids,
}: ShoppingAppControllerDependencies): ShoppingAppController => {
  let state = initialState();
  const listeners = new Set<() => void>();

  const publish = (nextState: ShoppingAppState): ShoppingAppState => {
    state = freezeState(nextState);

    for (const listener of listeners) {
      listener();
    }

    return state;
  };

  const getSnapshot = (): ShoppingAppState => state;

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const bootstrap = (): ShoppingAppState => {
    if (
      state.lifecycle !== "booting" &&
      state.lifecycle !== "recovery"
    ) {
      return state;
    }

    const result = persistence.bootstrap();

    if (result.ok) {
      return publish({
        lifecycle: result.activeTrip === null ? "idle" : "active",
        activeTrip: result.activeTrip,
        completedTrips: EMPTY_COMPLETED_TRIPS,
        persistence: HEALTHY_PERSISTENCE,
        undo: null,
        recovery: null,
      });
    }

    const since = clock.now();
    const persistenceHealth = degradedPersistence(result.issue, since);

    if (result.recoveryRequired) {
      return publish({
        lifecycle: "recovery",
        activeTrip: null,
        completedTrips: EMPTY_COMPLETED_TRIPS,
        persistence: persistenceHealth,
        undo: null,
        recovery: recoveryState(
          result.issue,
          result.recoveryRaw,
        ),
      });
    }

    return publish({
      lifecycle: result.activeTrip === null ? "idle" : "active",
      activeTrip: result.activeTrip,
      completedTrips: EMPTY_COMPLETED_TRIPS,
      persistence: persistenceHealth,
      undo: null,
      recovery: null,
    });
  };

  const startTrip = (input: StartTripInput): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip !== null) {
      return failure(state, applicationError("active-trip-exists"));
    }

    const now = clock.now();
    const tripResult = createActiveTrip({
      id: ids.tripId(),
      budgetMinor: input.budgetMinor,
      ...(input.safetyBufferMinor === undefined
        ? {}
        : { safetyBufferMinor: input.safetyBufferMinor }),
      startedAt: now,
    });

    if (!tripResult.ok) {
      return failure(state, tripResult.error);
    }

    const saveResult = persistence.save(tripResult.value, now);
    const nextState = publish({
      lifecycle: "active",
      activeTrip: tripResult.value,
      completedTrips: state.completedTrips,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, now),
      undo: null,
      recovery: null,
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  const addManualItem = (
    input: AddManualItemInput,
  ): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    const now = clock.now();
    const itemResult = createCartItem({
      id: ids.itemId(),
      unitPriceMinor: input.unitPriceMinor,
      quantity: input.quantity,
      priceSource: { kind: "manual" },
      priceConfidence: {
        kind: "confirmed",
        confirmedAt: now,
      },
      createdAt: now,
    });

    if (!itemResult.ok) {
      return failure(state, itemResult.error);
    }

    return dispatch({
      type: "add-item",
      item: itemResult.value,
    });
  };

  const retryPersistence = (): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    if (state.persistence.status === "healthy") {
      return success(state, false, "unchanged");
    }

    const since = state.persistence.since;
    const now = clock.now();
    const saveResult = persistence.save(state.activeTrip, now);

    const nextState = publish({
      ...state,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, since),
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  const dispatch = (command: ActiveTripCommand): AppCommandResult => {
    if (state.lifecycle === "booting") {
      return failure(state, applicationError("not-ready"));
    }

    if (state.lifecycle === "recovery") {
      return failure(state, applicationError("recovery-required"));
    }

    if (state.activeTrip === null) {
      return failure(state, applicationError("no-active-trip"));
    }

    const currentTrip = state.activeTrip;
    const tripResult = reduceTrip(currentTrip, command);

    if (!tripResult.ok) {
      return failure(state, tripResult.error);
    }

    if (tripResult.value.status !== "active") {
      return failure(state, applicationError("no-active-trip"));
    }

    if (tripResult.value === currentTrip) {
      return success(state, false, "unchanged");
    }

    const now = clock.now();
    const saveResult = persistence.save(tripResult.value, now);
    const nextState = publish({
      ...state,
      lifecycle: "active",
      activeTrip: tripResult.value,
      persistence: saveResult.ok
        ? HEALTHY_PERSISTENCE
        : degradedPersistence(saveResult.issue, now),
      recovery: null,
    });

    return success(
      nextState,
      true,
      saveResult.ok ? "persisted" : "memory-only",
    );
  };

  return Object.freeze({
    getSnapshot,
    subscribe,
    bootstrap,
    startTrip,
    addManualItem,
    retryPersistence,
    dispatch,
  });
};
