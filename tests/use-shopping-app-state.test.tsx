import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mvpMinorUnits, type Result } from "../src/domain/money";
import {
  isoTimestamp,
  type IsoTimestamp,
} from "../src/domain/shopping-trip";
import {
  createShoppingAppController,
  type Clock,
  type IdGenerator,
} from "../src/application/shopping-app-controller";
import { useShoppingAppState } from "../src/application/react/use-shopping-app-state";

const START = "2026-09-21T09:00:00.000Z";

const unwrap = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful Result");
  }

  return result.value;
};

const clock: Clock = {
  now: () => unwrap(isoTimestamp(START)) as IsoTimestamp,
};

const ids: IdGenerator = {
  tripId: () => "trip-react",
  itemId: () => "item-react",
};

describe("useShoppingAppState", () => {
  it("returns the exact controller snapshot and updates from one subscription", () => {
    const controller = createShoppingAppController({
      persistence: {
        bootstrap: () => ({
          ok: true,
          activeTrip: null,
        }),
        save: () => ({ ok: true }),
      },
      clock,
      ids,
    });

    const { result } = renderHook(() =>
      useShoppingAppState(controller),
    );

    expect(result.current).toBe(controller.getSnapshot());
    expect(result.current.lifecycle).toBe("booting");

    act(() => {
      controller.bootstrap();
    });

    expect(result.current).toBe(controller.getSnapshot());
    expect(result.current.lifecycle).toBe("idle");

    act(() => {
      controller.startTrip({
        budgetMinor: unwrap(mvpMinorUnits(5_000)),
      });
    });

    expect(result.current).toBe(controller.getSnapshot());
    expect(result.current.lifecycle).toBe("active");
    expect(result.current.activeTrip?.budgetMinor).toBe(5_000);
  });

  it("does not rerender when a rejected command leaves the snapshot unchanged", () => {
    const controller = createShoppingAppController({
      persistence: {
        bootstrap: () => ({
          ok: true,
          activeTrip: null,
        }),
        save: () => ({ ok: true }),
      },
      clock,
      ids,
    });

    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useShoppingAppState(controller);
    });

    act(() => {
      controller.bootstrap();
    });

    const afterBootstrapRenders = renders;
    const before = result.current;

    act(() => {
      controller.dispatch({
        type: "set-budget",
        budgetMinor: unwrap(mvpMinorUnits(6_000)),
      });
    });

    expect(result.current).toBe(before);
    expect(renders).toBe(afterBootstrapRenders);
  });
});
