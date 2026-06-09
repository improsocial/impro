import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const E2E_BUILD_DIR = path.join(os.tmpdir(), "impro-e2e-build");

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
    env: { PLAYWRIGHT: "1", BUILD_DIR: E2E_BUILD_DIR },
  },
});
