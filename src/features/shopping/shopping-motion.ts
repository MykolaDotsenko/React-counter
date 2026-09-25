export const settleMotion = (element: Element | null): void => {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element?.animate?.([{ opacity: 0.8 }, { opacity: 1 }], { duration: 160 });
  }
};
