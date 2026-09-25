import { afterEach, describe, expect, it, vi } from "vitest";

import { settleMotion } from "../src/features/shopping/shopping-motion";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
});

const setReducedMotion = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe("settleMotion", () => {
  it("animates presentation-only state when motion is allowed", () => {
    setReducedMotion(false);
    const animate = vi.fn();

    settleMotion({ animate } as unknown as Element, 180);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[1]).toMatchObject({
      duration: 180,
      easing: "ease-out",
    });
  });

  it("does not animate when reduced motion is requested", () => {
    setReducedMotion(true);
    const animate = vi.fn();

    settleMotion({ animate } as unknown as Element);

    expect(animate).not.toHaveBeenCalled();
  });

  it("fails safely when Web Animations is unavailable", () => {
    setReducedMotion(false);

    expect(() => settleMotion({} as Element)).not.toThrow();
  });
});
