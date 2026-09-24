import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-cohort/index.html",
  title: "Shopping Budget Companion — Retention Cohort Analyzer",
  description:
    "Local-only Shopping Budget Companion facilitator tool for validating and aggregating retention beta exports.",
});
