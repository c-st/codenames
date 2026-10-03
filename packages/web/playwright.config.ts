import { defineConfig, devices } from "@playwright/test";

// Override to run a second checkout's suite alongside another dev server.
const apiPort = process.env.E2E_API_PORT ?? "8787";
const webPort = process.env.E2E_WEB_PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
  webServer: [
    {
      command: `../api/node_modules/.bin/wrangler dev --config ../api/wrangler.toml --env local --var ROOM_IDLE_TTL_SECONDS:60 --ip 127.0.0.1 --port ${apiPort}`,
      url: `http://localhost:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `CODENAMES_E2E=true NEXT_PUBLIC_API_URL=ws://localhost:${apiPort} ./node_modules/.bin/next dev --hostname localhost --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
