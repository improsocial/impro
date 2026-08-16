import { test as baseTest, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const cssCoverageDir = process.env.CSS_COVERAGE_DIR;
const visualCaptureDir = process.env.VISUAL_CAPTURE_DIR;

function visualCapturePath(testInfo) {
  const fileName = path.basename(testInfo.file, ".test.js");
  const title = testInfo.title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return path.join(
    visualCaptureDir,
    testInfo.project.name,
    fileName,
    `${title || testInfo.testId}.png`,
  );
}

export const test = baseTest.extend({
  page: async ({ page, browserName }, use, testInfo) => {
    const collectCssCoverage = cssCoverageDir && browserName === "chromium";
    if (collectCssCoverage) {
      await page.coverage.startCSSCoverage({ resetOnNavigation: false });
    }
    // Fail on any request not explicitly mocked
    await page.context().route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://localhost")) {
        return route.continue();
      }
      throw new Error(
        `Unmocked network request: ${route.request().method()} ${url}`,
      );
    });

    await use(page);

    if (visualCaptureDir) {
      const screenshotPath = visualCapturePath(testInfo);
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: "disabled",
      });
    }

    if (collectCssCoverage) {
      const entries = await page.coverage.stopCSSCoverage();
      const styleEntries = entries.filter((entry) =>
        entry.url.includes("/css/"),
      );
      if (styleEntries.length > 0) {
        const fileName = `${testInfo.testId}-${testInfo.retry}.json`;
        fs.mkdirSync(cssCoverageDir, { recursive: true });
        fs.writeFileSync(
          path.join(cssCoverageDir, fileName),
          JSON.stringify(styleEntries),
        );
      }
    }
  },
});

export { expect };
