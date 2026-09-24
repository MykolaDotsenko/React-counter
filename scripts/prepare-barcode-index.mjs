import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-barcode/index.html",
  title: "Shopping Budget Companion — Barcode Benchmark",
  description:
    "Experimental local-only barcode interaction benchmark for measuring native camera scan speed, correction and fallback cost.",
});
