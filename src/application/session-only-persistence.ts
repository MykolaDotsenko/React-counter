import type { PriceMemoryPersistencePort } from "./price-memory-port";
import type {
  PersistenceProblem,
  ShoppingPersistencePort,
} from "./shopping-app-contracts";

/**
 * The shopper explicitly chose to keep shopping without durable storage after
 * stored data could not be read. Every write is refused, so records that the
 * app could not read are never overwritten by this session.
 */
export const SESSION_ONLY_ISSUE: PersistenceProblem = Object.freeze({
  code: "session-only",
});

const refused = Object.freeze({
  ok: false as const,
  issue: SESSION_ONLY_ISSUE,
});

export const SESSION_ONLY_PERSISTENCE_PORT: ShoppingPersistencePort =
  Object.freeze({
    bootstrap() {
      return {
        ok: false as const,
        activeTrip: null,
        completedTrips: Object.freeze([]),
        completionCleanupPending: false,
        issue: SESSION_ONLY_ISSUE,
        recoveryRequired: false,
      };
    },
    readCompletedHistory() {
      return {
        ok: false as const,
        completedTrips: Object.freeze([]),
        issue: SESSION_ONLY_ISSUE,
      };
    },
    setAsideDamagedHistory() {
      return refused;
    },
    setAsideUnreadableActiveTrip() {
      return refused;
    },
    save() {
      return refused;
    },
    complete() {
      return {
        ok: false as const,
        stage: "history-write" as const,
        issue: SESSION_ONLY_ISSUE,
        historyPersisted: false,
      };
    },
    saveCompleted() {
      return refused;
    },
    replaceCompletedHistory() {
      return refused;
    },
    clearCompletedActive() {
      return refused;
    },
  });

export const SESSION_ONLY_PRICE_MEMORY_PORT: PriceMemoryPersistencePort =
  Object.freeze({
    bootstrap() {
      return {
        ok: false as const,
        records: Object.freeze([]),
        issue: SESSION_ONLY_ISSUE,
      };
    },
    save() {
      return refused;
    },
  });
