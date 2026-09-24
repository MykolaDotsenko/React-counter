import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-ocr/index.html",
  title: "Shopping Budget Companion — Shelf-label OCR Benchmark",
  description:
    "Experimental shelf-label OCR benchmark for measuring price-candidate accuracy, latency, correction and fallback cost.",
});
