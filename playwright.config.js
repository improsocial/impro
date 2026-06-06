import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  outputDir: "./tests/e2e/.results",
  fullyParallel: true,
  retries: 2,
  use: {
    baseURL: "http://localhost:8081",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run build && PORT=8081 npm run serve:static",
    url: "http://localhost:8081",
    reuseExistingServer: false,
    env: { PLAYWRIGHT: "1" },
  },
});
