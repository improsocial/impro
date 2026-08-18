import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../../shared/factories.js";

test.describe("Sidebar search", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    mockServer.addTypeaheadProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    mockServer.addSearchProfiles([
      createProfile({
        did: "did:plc:profile1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    ]);
    await mockServer.setup(page);
    await login(page);
  });

  test("shows typeahead results in the right column", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const input = page.locator('[data-testid="sidebar-search-input"]');
    await expect(input).toBeVisible();
    await input.fill("ali");

    const typeahead = page.locator('[data-testid="sidebar-search-typeahead"]');
    await expect(typeahead).toBeVisible();
    await expect(
      typeahead.locator('[data-testid="sidebar-search-typeahead-result"]'),
    ).toHaveCount(1);
    await expect(typeahead).toContainText("@alice.bsky.social");
  });

  test("navigates to the search page on Enter", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="sidebar-search-input"]').fill("ali");
    await page.locator('[data-testid="sidebar-search-input"]').press("Enter");

    await expect(page).toHaveURL(/\/search\?q=ali/);
    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#search-view .search-input")).toHaveValue("ali");
    await page.locator('#search-view [data-testid="tab-profiles"]').click();
    await expect(page.locator("#search-view .profile-list-item")).toHaveCount(
      1,
      { timeout: 10000 },
    );
  });

  test("navigates to a profile from a typeahead result", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="sidebar-search-input"]').fill("ali");
    await page
      .locator('[data-testid="sidebar-search-typeahead-result"]')
      .first()
      .click();

    await expect(page).toHaveURL(/\/profile\/alice\.bsky\.social/);
    await expect(
      page.locator('[data-testid="sidebar-search-input"]'),
    ).toHaveValue("");
    await expect(
      page.locator('[data-testid="sidebar-search-typeahead"]'),
    ).toHaveCount(0);
  });

  test("is hidden on the search page itself", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("#search-view")).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-testid="sidebar-search-input"]'),
    ).toHaveCount(0);
  });
});
