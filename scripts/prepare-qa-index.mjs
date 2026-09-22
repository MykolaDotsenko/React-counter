import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-qa/index.html",
  title: "Shopping Budget Companion — Empirical Timing QA",
  description:
    "Internal Shopping Budget Companion empirical timing and one-hand usability QA.",
});
