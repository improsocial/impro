import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createGroupConvo, createProfile } from "../../../shared/factories.js";

test.describe("Leave group chat from settings", () => {
  test("should leave a group chat from settings and route back to /messages", async ({
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
    await view.locator('[data-testid="group-settings-leave-button"]').click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await expect(
      confirmModal.locator('[data-testid="modal-message"]'),
    ).toContainText("Cool Group");
    await confirmModal.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page).toHaveURL(/\/messages$/, { timeout: 10000 });
    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "Left group chat",
    );

    const chatView = page.locator("#chat-view");
    await expect(chatView.locator(".convo-item")).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("should not leave if the confirm modal is cancelled", async ({
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
    await view.locator('[data-testid="group-settings-leave-button"]').click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await confirmModal.locator('[data-testid="modal-cancel-button"]').click();

    await expect(page).toHaveURL(/\/messages\/convo-1\/settings$/);
  });

  test("should surface an owner-cannot-leave error as a toast", async ({
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

    await page.route("**/xrpc/chat.bsky.convo.leaveConvo*", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "OwnerCannotLeave",
          message: "Owner must lock the group before leaving.",
        }),
      }),
    );

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    await view.locator('[data-testid="group-settings-leave-button"]').click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await confirmModal.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "Owner must lock the group before leaving.",
      { timeout: 10000 },
    );
    await expect(page).toHaveURL(/\/messages\/convo-1\/settings$/);
  });
});
