import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-visual/index.html",
  title: "Shopping Budget Companion — Visual Product Benchmark",
  description:
    "Experimental visual product recognition benchmark for measuring ranked candidate accuracy, latency, correction and fallback cost.",
});
