import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";
import { createProfile } from "../../../factories.js";

const alice = createProfile({
  did: "did:plc:alice1",
  handle: "alice.bsky.social",
  displayName: "Alice",
  viewer: { muted: true },
});

const bob = createProfile({
  did: "did:plc:bob1",
  handle: "bob.bsky.social",
  displayName: "Bob",
  viewer: { muted: true },
});

test.describe("Settings Muted Accounts view", () => {
  test("should display header and description", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-accounts");

    const view = page.locator("#settings-muted-accounts-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="page-description"]'),
    ).toBeVisible();
  });

  test("should display empty state when no accounts are muted", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-accounts");

    const view = page.locator("#settings-muted-accounts-view");
    await expect(view.locator('[data-testid="feed-end-message"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should list muted accounts", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.mutedProfiles = [alice, bob];
    mockServer.addProfile(alice);
    mockServer.addProfile(bob);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-accounts");

    const view = page.locator("#settings-muted-accounts-view");
    await expect(view.locator(".profile-list-item")).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(view).toContainText("Alice");
    await expect(view).toContainText("Bob");
  });
});
