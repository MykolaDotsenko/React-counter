const guardedEvidenceBuild =
  import.meta.env.VITE_SHOPPING_QA_TIMING === "1" ||
  import.meta.env.VITE_SHOPPING_BETA_EVIDENCE === "1" ||
  import.meta.env.VITE_SHOPPING_COHORT_ANALYSIS === "1" ||
  import.meta.env.VITE_SHOPPING_BARCODE_BENCHMARK === "1" ||
  import.meta.env.VITE_SHOPPING_VISUAL_BENCHMARK === "1" ||
  import.meta.env.VITE_SHOPPING_OCR_BENCHMARK === "1" ||
  import.meta.env.VITE_SHOPPING_OCR_TESSERACT_BENCHMARK === "1" ||
  import.meta.env.VITE_SHOPPING_BARCODE_PAIRED_ANALYZER === "1" ||
  import.meta.env.VITE_SHOPPING_OCR_PAIRED_ANALYZER === "1";

export const surfaceScopeFor = (
  baseUrl: string,
  documentUrl: string,
): string => `surface:${new URL(baseUrl, documentUrl).pathname}`;

export const surfaceStorageScope = (): string | null => {
  if (!guardedEvidenceBuild || typeof window === "undefined") {
    return null;
  }

  return surfaceScopeFor(import.meta.env.BASE_URL, window.location.href);
};
