import { describe, expect, it } from "vitest";

import {
  SESSION_ONLY_ISSUE,
  SESSION_ONLY_PERSISTENCE_PORT,
  SESSION_ONLY_PRICE_MEMORY_PORT,
} from "../src/application/session-only-persistence";
import { mvpMinorUnits } from "../src/domain/money";
import {
  createActiveTrip,
  isoTimestamp,
  reduceTrip,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";

const NOW = "2026-09-22T10:00:00.000Z";

const must = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) {
    throw new Error("Expected success");
  }

  return result.value;
};

const now: IsoTimestamp = must(isoTimestamp(NOW));
const active = must(
  createActiveTrip({
    id: "trip",
    budgetMinor: must(mvpMinorUnits(1_000)),
    startedAt: NOW,
  }),
);
const completed = must(
  reduceTrip(active, { type: "complete-trip", completedAt: now }),
);

describe("session-only ports", () => {
  it("refuse every shopping write with the session-only issue", () => {
    if (completed.status !== "completed") {
      throw new Error("Expected completed trip");
    }

    const port = SESSION_ONLY_PERSISTENCE_PORT;
    const refusal = { ok: false, issue: SESSION_ONLY_ISSUE };

    expect(port.save(active, now)).toEqual(refusal);
    expect(port.saveCompleted(completed, now)).toEqual(refusal);
    expect(port.replaceCompletedHistory([], now)).toEqual(refusal);
    expect(port.clearCompletedActive()).toEqual(refusal);
    expect(port.setAsideDamagedHistory(now)).toEqual(refusal);
    expect(port.setAsideUnreadableActiveTrip(now)).toEqual(refusal);
    expect(port.complete(completed, now)).toEqual({
      ok: false,
      stage: "history-write",
      issue: SESSION_ONLY_ISSUE,
      historyPersisted: false,
    });
  });

  it("never reports stored data as readable", () => {
    expect(SESSION_ONLY_PERSISTENCE_PORT.bootstrap()).toMatchObject({
      ok: false,
      activeTrip: null,
      completedTrips: [],
      recoveryRequired: false,
      issue: SESSION_ONLY_ISSUE,
    });
    expect(SESSION_ONLY_PERSISTENCE_PORT.readCompletedHistory()).toEqual({
      ok: false,
      completedTrips: [],
      issue: SESSION_ONLY_ISSUE,
    });
  });

  it("refuse Price Memory writes as well", () => {
    expect(SESSION_ONLY_PRICE_MEMORY_PORT.save([], now)).toEqual({
      ok: false,
      issue: SESSION_ONLY_ISSUE,
    });
    expect(SESSION_ONLY_PRICE_MEMORY_PORT.bootstrap()).toEqual({
      ok: false,
      records: [],
      issue: SESSION_ONLY_ISSUE,
    });
  });
});
