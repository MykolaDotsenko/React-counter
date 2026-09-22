import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-beta/index.html",
  title: "Shopping Budget Companion — Retention Beta",
  description:
    "Internal Shopping Budget Companion real-store retention beta with privacy-safe local evidence.",
});
