import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createGroupConvo, createProfile } from "../../../shared/factories.js";

test.describe("Mute conversation flow", () => {
  test("should mute a group chat from the group settings screen and show a bell-off in the list", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice],
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    const toggle = view.locator('[data-testid="group-settings-mute-toggle"]');
    await expect(toggle).toHaveAttribute("data-teststate", "unmuted", {
      timeout: 10000,
    });

    await toggle.click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "Group chat muted",
      { timeout: 10000 },
    );
    await expect(toggle).toHaveAttribute("data-teststate", "muted");

    await page.goto("/messages");
    const chatView = page.locator("#chat-view");
    const row = chatView.locator('[data-testid="convo-item-group"]').first();
    await expect(row).toHaveAttribute("data-teststate", "muted", {
      timeout: 10000,
    });
    await expect(row.locator('[data-testid="convo-muted-icon"]')).toBeVisible();
  });

  test("should unmute a previously muted group chat from the settings screen", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const alice = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice],
      muted: true,
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    const toggle = view.locator('[data-testid="group-settings-mute-toggle"]');
    await expect(toggle).toHaveAttribute("data-teststate", "muted", {
      timeout: 10000,
    });

    await toggle.click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "Group chat unmuted",
      { timeout: 10000 },
    );
    await expect(toggle).toHaveAttribute("data-teststate", "unmuted");
  });
});
