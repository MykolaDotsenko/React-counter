import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const cohortAnalysisEnabled =
    process.env.VITE_SHOPPING_COHORT_ANALYSIS === "1";
  const barcodeBenchmarkEnabled =
    process.env.VITE_SHOPPING_BARCODE_BENCHMARK === "1";
  const visualBenchmarkEnabled =
    process.env.VITE_SHOPPING_VISUAL_BENCHMARK === "1";
  const ocrBenchmarkEnabled =
    process.env.VITE_SHOPPING_OCR_BENCHMARK === "1";
  const evidenceEnabled =
    process.env.VITE_SHOPPING_QA_TIMING === "1" ||
    process.env.VITE_SHOPPING_BETA_EVIDENCE === "1" ||
    cohortAnalysisEnabled ||
    barcodeBenchmarkEnabled ||
    visualBenchmarkEnabled ||
    ocrBenchmarkEnabled;

  return {
    plugins: [
      react(),
      VitePWA({
        disable: evidenceEnabled,
        strategies: "generateSW",
        registerType: "prompt",
        injectRegister: "auto",
        includeAssets: [
          "favicon.svg",
          "pwa-icon-192.png",
          "pwa-icon-512.png",
        ],
        manifest: {
          id: "./",
          name: "Shopping Budget Companion",
          short_name: "Shop Budget",
          description:
            "Stay under your shopping limit with exact local-first budget tracking.",
          start_url: "./",
          scope: "./",
          display: "standalone",
          background_color: "#f5f3ee",
          theme_color: "#f5f3ee",
          icons: [
            {
              src: "pwa-icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigateFallback: "index.html",
          navigateFallbackDenylist: [
            /\/qa(?:\/|$)/,
            /\/beta(?:\/|$)/,
            /\/cohort(?:\/|$)/,
            /\/barcode-benchmark(?:\/|$)/,
            /\/visual-recognition-benchmark(?:\/|$)/,
            /\/shelf-label-ocr-benchmark(?:\/|$)/,
          ],
          globPatterns: [
            "**/*.{js,css,html,svg,png,webmanifest}",
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "#app-entry": path.resolve(
          rootDir,
          barcodeBenchmarkEnabled
            ? "src/qa/BarcodeBenchmarkApp.tsx"
            : visualBenchmarkEnabled
              ? "src/qa/VisualProductBenchmarkApp.tsx"
              : ocrBenchmarkEnabled
                ? "src/qa/ShelfLabelOcrBenchmarkApp.tsx"
                : cohortAnalysisEnabled
                  ? "src/qa/RetentionCohortAnalyzerApp.tsx"
                  : "src/App.tsx",
        ),
        "#shopping-evidence": path.resolve(
          rootDir,
          evidenceEnabled
            ? "src/qa/use-shopping-evidence-enabled.tsx"
            : "src/qa/use-shopping-evidence.tsx",
        ),
      },
    },
  };
});
