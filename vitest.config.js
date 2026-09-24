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
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 90,
        lines: 80,
        "src/domain/**": {
          statements: 85,
          branches: 75,
          functions: 100,
          lines: 85,
          perFile: {
            statements: 70,
            branches: 55,
            functions: 90,
            lines: 70,
          },
        },
        "src/application/**": {
          statements: 80,
          branches: 72,
          functions: 94,
          lines: 80,
          perFile: {
            statements: 60,
            branches: 60,
            functions: 50,
            lines: 60,
          },
        },
        "src/infrastructure/storage/**": {
          statements: 80,
          branches: 65,
          functions: 90,
          lines: 80,
          perFile: {
            statements: 45,
            branches: 45,
            functions: 50,
            lines: 45,
          },
        },
      },
    },
  },
});
