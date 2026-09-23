import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const evidenceEnabled =
    process.env.VITE_SHOPPING_QA_TIMING === "1" ||
    process.env.VITE_SHOPPING_BETA_EVIDENCE === "1";

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
          ],
          globPatterns: [
            "**/*.{js,css,html,svg,png,webmanifest}",
          ],
        },
      }),
    ],
    resolve: {
      alias: {
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
