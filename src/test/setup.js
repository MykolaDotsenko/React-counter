import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  window.localStorage.clear();

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
