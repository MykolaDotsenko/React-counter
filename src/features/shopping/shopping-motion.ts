export const settleMotion = (element: Element | null): void => {
  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduce) {
    element?.animate?.([{ opacity: 0.8 }, { opacity: 1 }], { duration: 160 });
  }
};
