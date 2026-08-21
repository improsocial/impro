import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Same-path navigation", () => {
  test("clicking a link to the current page keeps the view visible", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    await page.goto("/settings/notifications");
    const section = page.locator(
      '[data-testid="settings-section-push-notifications"]',
    );
    await expect(section).toBeVisible({ timeout: 10000 });

    // No view links to itself in static markup, but transient UI (e.g. the
    // push re-auth toast) can — inject one to click.
    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.href = "/settings/notifications";
      anchor.textContent = "self";
      anchor.dataset.testid = "self-link";
      document.querySelector(".page-visible").appendChild(anchor);
    });
    await page.locator('[data-testid="self-link"]').click();

    await expect(section).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/notifications$/);
  });
});
