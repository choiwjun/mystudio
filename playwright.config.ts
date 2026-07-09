import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const host = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `${host}/login`,
    reuseExistingServer: !process.env["CI"],
    timeout: 300_000,
    env: {
      NEXTAUTH_SECRET: "paperclip-e2e-secret",
    },
  },
  use: {
    baseURL: host,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
