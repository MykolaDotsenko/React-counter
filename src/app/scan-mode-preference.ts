import type { ScanMode } from "../features/shopping/scan-targets";

export const SCAN_MODE_STORAGE_KEY = "shopping-budget:scan-mode";

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readScanModePreference = (fallback: ScanMode): ScanMode => {
  try {
    const stored = storage()?.getItem(SCAN_MODE_STORAGE_KEY);
    return stored === "barcode" || stored === "price" ? stored : fallback;
  } catch {
    return fallback;
  }
};

export const writeScanModePreference = (mode: ScanMode): void => {
  try {
    storage()?.setItem(SCAN_MODE_STORAGE_KEY, mode);
  } catch {
    return;
  }
};
