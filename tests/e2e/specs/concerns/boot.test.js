import { test, expect } from "../../base.js";
import { MockServer } from "../../mockServer.js";

test.describe("App boot states", () => {
  test("should show the boot error state when the app script fails to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.failAppScript();
    await mockServer.setup(page);

    await page.goto("/");

    await expect(page.locator('[data-testid="boot-error"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show the boot spinner during a slow load, then reveal the app", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.delayAppScript(2500);
    await mockServer.setup(page);

    // "commit" so assertions can watch the boot layer while the page loads
    await page.goto("/", { waitUntil: "commit" });

    const spinner = page.locator('[data-testid="boot-loading"]');
    await expect(spinner).toBeVisible({ timeout: 5000 });
    await expect(spinner).toBeHidden({ timeout: 10000 });
    await expect(page.locator("#app-root > *").first()).toBeVisible();
  });
});
