// A surface that unmounts once it is resolved lands focus on the next
// screen's heading rather than leaving it on <body>.
export const focusNextScreen = (): void => {
  queueMicrotask(() => {
    document.querySelector<HTMLElement>("main h1[tabindex]")?.focus();
  });
};
