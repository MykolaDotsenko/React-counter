export const APPEARANCE_STORAGE_KEY = "shopping-budget:appearance";

export const APPEARANCE_MODES = [
  "system",
  "light",
  "dark",
  "aurora",
] as const;

export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export interface AppearanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AppearanceDocumentTarget {
  readonly documentElement: HTMLElement;
  querySelector<E extends Element = Element>(selectors: string): E | null;
}

const THEME_COLORS = Object.freeze({
  light: "#f5f3ee",
  dark: "#111512",
  aurora: "#080b14",
});

export const isAppearanceMode = (
  value: string | null | undefined,
): value is AppearanceMode =>
  APPEARANCE_MODES.some((mode) => mode === value);

export const parseAppearanceMode = (
  value: string | null | undefined,
): AppearanceMode => (isAppearanceMode(value) ? value : "system");

export const readAppearancePreference = (
  storage: AppearanceStorage | null =
    typeof window === "undefined" ? null : window.localStorage,
): AppearanceMode => {
  if (storage === null) {
    return "system";
  }

  try {
    return parseAppearanceMode(storage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return "system";
  }
};

export const persistAppearancePreference = (
  mode: AppearanceMode,
  storage: AppearanceStorage | null =
    typeof window === "undefined" ? null : window.localStorage,
): boolean => {
  if (storage === null) {
    return false;
  }

  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
};

export const resolvedAppearance = (
  mode: AppearanceMode,
  prefersDark: boolean,
): Exclude<AppearanceMode, "system"> =>
  mode === "system" ? (prefersDark ? "dark" : "light") : mode;

export const appearanceThemeColor = (
  mode: AppearanceMode,
  prefersDark: boolean,
): string => THEME_COLORS[resolvedAppearance(mode, prefersDark)];

const systemPrefersDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export const applyAppearanceToDocument = (
  mode: AppearanceMode,
  target: AppearanceDocumentTarget | null =
    typeof document === "undefined" ? null : document,
  prefersDark = systemPrefersDark(),
): void => {
  if (target === null) {
    return;
  }

  target.documentElement.dataset.appearance = mode;

  const themeMeta = target.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  themeMeta?.setAttribute(
    "content",
    appearanceThemeColor(mode, prefersDark),
  );
};
