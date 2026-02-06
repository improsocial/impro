import { test as baseTest, expect } from "@playwright/test";

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    // Fail on any request not explicitly mocked
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://localhost")) {
        return route.continue();
      }
      throw new Error(
        `Unmocked network request: ${route.request().method()} ${url}`,
      );
    });

    await use(page);
  },
});

export { expect };
