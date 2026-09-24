import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-barcode-paired/index.html",
  title: "Shopping Budget Companion — Barcode Paired Analyzer",
  description:
    "Local facilitator tool for validating and comparing paired manual timing and barcode benchmark evidence.",
});
