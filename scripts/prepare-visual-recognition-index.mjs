import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-visual/index.html",
  title: "Shopping Budget Companion — Visual Recognition Benchmark",
  description:
    "Experimental privacy-safe local visual product recognition benchmark for measuring controlled candidate accuracy, latency, correction and fallback cost.",
});
