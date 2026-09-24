import { prepareGuardedBuildBranding } from "./guarded-build-branding.mjs";

await prepareGuardedBuildBranding({
  target: "dist-visual-clip/index.html",
  title: "Shopping Budget Companion — Transformers.js CLIP Benchmark",
  description:
    "Concrete local-first CLIP zero-shot retail recognition experiment built on the guarded visual-product benchmark.",
});
