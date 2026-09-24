import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: true,
    include: ["tests/**/*.test.{js,jsx,ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/domain/**/*.{ts,tsx}",
        "src/application/**/*.{ts,tsx}",
        "src/infrastructure/storage/**/*.{ts,tsx}",
      ],
      reporter: ["text", "json-summary"],
      reportOnFailure: true,
      skipFull: true,
    },
  },
});
