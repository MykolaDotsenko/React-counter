import { defineConfig, devices } from "@playwright/test";

const stagedSite = process.env.PLAYWRIGHT_STAGED_SITE === "1";
const serverUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never" }],
      ]
    : "list",
  use: {
    baseURL: serverUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: stagedSite
      ? "python3 -m http.server 4173 --bind 127.0.0.1 --directory .playwright-site-root"
      : "npm run build -- --base=/ && npm run preview -- --host 127.0.0.1 --port 4173",
    url: serverUrl,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
