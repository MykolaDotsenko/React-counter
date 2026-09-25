export const focusNextScreen = (): void => {
  queueMicrotask(() => {
    document.querySelector<HTMLElement>("main h1[tabindex]")?.focus();
  });
};
