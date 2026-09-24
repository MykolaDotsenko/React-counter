import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-ocr-tesseract/index.html",
  title: "Shopping Budget Companion — Tesseract OCR Benchmark",
  description:
    "Concrete local-first Tesseract.js shelf-label OCR experiment built on the guarded OCR benchmark.",
});
