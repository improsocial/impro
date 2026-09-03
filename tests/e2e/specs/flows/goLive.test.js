import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../testData.js";
import { MockServer } from "../../mockServer.js";

const STREAM_URL = "https://www.twitch.tv/streamer";

async function openProfileMenu(page) {
  const view = page.locator("#profile-view");
  await expect(view.locator('[data-testid="profile-name"]')).toBeVisible({
    timeout: 10000,
  });
  await view.locator(".ellipsis-button").click();
  return page.locator(".profile-context-menu");
}

test.describe("Go Live flow", () => {
  test("create → badge appears → edit → remove", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.addProfile({
      ...userProfile,
      followersCount: 5,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.setExternalLinkCard(STREAM_URL, {
      title: "Cool Stream",
      description: "Streaming live",
    });
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    // 1. Menu shows "Go live" (off state) for the current user.
    let menu = await openProfileMenu(page);
    let goLiveItem = menu.locator(
      '[data-testid="menu-action-profile-go-live"]',
    );
    await expect(goLiveItem).toHaveAttribute("data-teststate", "off");
    await expect(goLiveItem).toContainText("Go live");
    await goLiveItem.click();

    // 2. Dialog opens; type URL; preview lands after debounce.
    const dialog = page.locator('[data-testid="go-live-dialog"]');
    await expect(dialog).toBeVisible();
    const urlInput = dialog.locator('[data-testid="link-input"]');
    await urlInput.fill(STREAM_URL);
    await expect(dialog.locator('[data-testid="link-preview"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(dialog.locator('[data-testid="link-preview"]')).toContainText(
      "Cool Stream",
    );

    // 3. Submit → toast → dialog closes → badge on the profile avatar.
    await dialog.locator('[data-testid="go-live-submit"]').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('[data-testid="live-badge"]')).toBeVisible();
    expect(mockServer.putStatusCalls).toHaveLength(1);
    expect(mockServer.putStatusCalls[0].record.embed.external.uri).toBe(
      STREAM_URL,
    );
    const originalCreatedAt = mockServer.putStatusCalls[0].record.createdAt;

    // 4. Reopen menu → label flips to "Edit live status".
    menu = await openProfileMenu(page);
    goLiveItem = menu.locator('[data-testid="menu-action-profile-go-live"]');
    await expect(goLiveItem).toHaveAttribute("data-teststate", "live");
    await expect(goLiveItem).toContainText("Edit live status");
    await goLiveItem.click();

    // 5. Edit dialog opens with URL prefilled; change URL and Save.
    const editDialog = page.locator('[data-testid="edit-live-dialog"]');
    await expect(editDialog).toBeVisible();
    const editInput = editDialog.locator('[data-testid="link-input"]');
    await expect(editInput).toHaveValue(STREAM_URL);
    const NEW_STREAM_URL = "https://www.twitch.tv/streamer-updated";
    mockServer.setExternalLinkCard(NEW_STREAM_URL, {
      title: "Updated Stream",
      description: "",
    });
    await editInput.fill(NEW_STREAM_URL);
    // Wait for debounce + preview
    await expect(
      editDialog.locator('[data-testid="link-preview"]'),
    ).toContainText("Updated Stream", { timeout: 5000 });
    await editDialog.locator('[data-testid="edit-live-save"]').click();
    await expect(editDialog).not.toBeVisible();
    expect(mockServer.putStatusCalls).toHaveLength(2);
    // createdAt is threaded through unchanged
    expect(mockServer.putStatusCalls[1].record.createdAt).toBe(
      originalCreatedAt,
    );
    expect(mockServer.putStatusCalls[1].record.embed.external.uri).toBe(
      NEW_STREAM_URL,
    );

    // 6. Reopen menu → still live → remove.
    menu = await openProfileMenu(page);
    await menu.locator('[data-testid="menu-action-profile-go-live"]').click();
    await expect(
      page.locator('[data-testid="edit-live-dialog"]'),
    ).toBeVisible();
    await page.locator('[data-testid="edit-live-remove"]').click();

    // Confirm modal
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await expect(
      page.locator('[data-testid="edit-live-dialog"]'),
    ).not.toBeVisible();
    expect(mockServer.deleteStatusCalls).toHaveLength(1);

    // 7. Badge gone, menu back to "Go live".
    await expect(page.locator('[data-testid="live-badge"]')).toHaveCount(0);
    menu = await openProfileMenu(page);
    await expect(
      menu.locator('[data-testid="menu-action-profile-go-live"]'),
    ).toHaveAttribute("data-teststate", "off");
  });

  test("retries on InvalidSwap and still succeeds on a single submit", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addProfile({ ...userProfile });
    mockServer.setExternalLinkCard(STREAM_URL, {
      title: "Cool Stream",
      description: "",
    });
    // Prior status exists on the PDS, first putStatusRecord will race and
    // fail once with InvalidSwap; the CAS loop then re-reads and succeeds.
    mockServer.setStatusRecord(
      {
        $type: "app.bsky.actor.status",
        status: "app.bsky.actor.status#live",
        createdAt: "2025-01-01T00:00:00.000Z",
        durationMinutes: 60,
      },
      { cid: "bafyreiseedstatus" },
    );
    mockServer.simulateInvalidSwap({ times: 1 });
    await mockServer.setup(page);
    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const menu = await openProfileMenu(page);
    await menu.locator('[data-testid="menu-action-profile-go-live"]').click();
    const dialog = page.locator('[data-testid="go-live-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="link-input"]').fill(STREAM_URL);
    await expect(dialog.locator('[data-testid="link-preview"]')).toBeVisible({
      timeout: 5000,
    });
    await dialog.locator('[data-testid="go-live-submit"]').click();
    await expect(dialog).not.toBeVisible();
    // Two put attempts: the InvalidSwap failure and the successful retry.
    expect(mockServer.putStatusCalls).toHaveLength(2);
  });
});
