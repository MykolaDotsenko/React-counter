import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-ocr-paired/index.html",
  title: "Shopping Budget Companion — OCR Paired Analyzer",
  description:
    "Local facilitator tool for validating and comparing paired manual timing and shelf-label OCR evidence.",
});
