import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const evidenceEnabled =
    process.env.VITE_SHOPPING_QA_TIMING === "1" ||
    process.env.VITE_SHOPPING_BETA_EVIDENCE === "1";

  return {
    plugins: [react()],
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
