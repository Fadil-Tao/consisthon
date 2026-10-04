import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3101",
    timezoneId: "Asia/Makassar",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "pnpm db:migrate && pnpm dev --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TURSO_DATABASE_URL: `file:./data/e2e-${Date.now()}.db`,
      NEXT_DIST_DIR: ".next-e2e",
      ENABLE_DEMO: "true",
      BETTER_AUTH_URL: "http://localhost:3101",
      BETTER_AUTH_SECRET: "consisthon-isolated-e2e-secret-32-characters",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      S3_BUCKET: "",
    },
  },
});
