import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../../shared/factories.js";

test.describe("New chat from sidebar flow", () => {
  function createMessageableProfile() {
    return createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
      associated: { chat: { allowIncoming: "all" } },
    });
  }

  test("should start a chat from the sidebar new chat button and land on the conversation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createMessageableProfile();
    mockServer.addProfile(alice);
    mockServer.addTypeaheadProfiles([alice]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages");

    const newChatButton = page.locator(
      '[data-testid="sidebar-new-chat-button"]',
    );
    await expect(newChatButton).toBeVisible({ timeout: 10000 });
    await newChatButton.click();

    const dialog = page.locator('[data-testid="new-chat-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await dialog.locator('[data-testid="new-chat-search-input"]').fill("ali");

    const result = dialog.locator('[data-testid="profile-list-item-button"]');
    await expect(result).toHaveCount(1, { timeout: 10000 });
    await expect(result).toHaveAttribute("data-teststate", "enabled");
    await expect(result).toContainText("Alice");
    await result.click();

    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/messages\/convo-new-/, {
      timeout: 10000,
    });
    const chatDetailView = page.locator("#chat-detail-view");
    await expect(
      chatDetailView.locator('[data-testid="header-title"]'),
    ).toContainText("Alice", { timeout: 10000 });
  });
});
