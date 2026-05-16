import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import { createProfile } from "../../../factories.js";

const alice = createProfile({
  did: "did:plc:alice1",
  handle: "alice.bsky.social",
  displayName: "Alice",
  viewer: { blocking: "at://did:plc:user/app.bsky.graph.block/blockalice" },
});

const bob = createProfile({
  did: "did:plc:bob1",
  handle: "bob.bsky.social",
  displayName: "Bob",
  viewer: { blocking: "at://did:plc:user/app.bsky.graph.block/blockbob" },
});

test.describe("Settings Blocked Accounts view", () => {
  test("should display header and description", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/blocked-accounts");

    const view = page.locator("#settings-blocked-accounts-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="page-description"]'),
    ).toBeVisible();
  });

  test("should display empty state when no accounts are blocked", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/blocked-accounts");

    const view = page.locator("#settings-blocked-accounts-view");
    await expect(
      view.locator('[data-testid="blocked-account-empty"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should list blocked accounts", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.blockedProfiles = [alice, bob];
    mockServer.addProfile(alice);
    mockServer.addProfile(bob);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/blocked-accounts");

    const view = page.locator("#settings-blocked-accounts-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
  });
});
