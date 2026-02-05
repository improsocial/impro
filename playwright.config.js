import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  outputDir: "./tests/e2e/.results",
  fullyParallel: true,
  retries: 0,
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
    command: "npm start -- --port=8081",
    url: "http://localhost:8081",
    reuseExistingServer: true,
  },
});
