const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const settleMotion = (
  element: Element | null,
  duration = 160,
): void => {
  if (
    element === null ||
    typeof element.animate !== "function" ||
    reducedMotion()
  ) {
    return;
  }

  element.animate(
    [
      { opacity: 0.76, transform: "translateY(3px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration, easing: "ease-out" },
  );
};
