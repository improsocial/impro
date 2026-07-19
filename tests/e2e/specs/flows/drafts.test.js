import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { OAUTH_SCOPES } from "../../../../src/oauthScopes.js";

async function openComposer(page) {
  const homeView = page.locator("#home-view");
  await expect(homeView).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid="sidebar-compose-button"]').click();
  const composer = page.locator("post-composer .post-composer");
  await expect(composer).toBeVisible({ timeout: 10000 });
  return composer;
}

test.describe("Post drafts flow", () => {
  test("save on cancel, restore from the drafts list, publish cleans up", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Compose some text, then cancel
    let composer = await openComposer(page);
    const draftText = "A thought worth keeping for later";
    await composer.locator(".rich-text-input").click();
    await composer.locator(".rich-text-input").type(draftText);
    await composer.locator(".post-composer-cancel-button").click();

    // The tri-state prompt offers saving as a draft
    const choiceModal = page.locator('[data-testid="choice-modal"]');
    await expect(choiceModal).toBeVisible({ timeout: 10000 });
    await choiceModal.locator('[data-testid="modal-choice-save"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Reopen the composer and pick the draft from the list
    composer = await openComposer(page);
    await composer.locator('[data-testid="composer-drafts-button"]').click();
    const draftsDialog = page.locator('[data-testid="drafts-dialog"]');
    await expect(draftsDialog).toBeVisible({ timeout: 10000 });
    const draftItem = draftsDialog.locator('[data-testid="draft-item"]');
    await expect(draftItem).toHaveCount(1, { timeout: 10000 });
    await expect(draftItem).toContainText(draftText);
    await draftItem.click();
    await expect(draftsDialog).not.toBeVisible({ timeout: 10000 });

    // The draft's text is restored into the composer
    await expect(composer.locator(".rich-text-input")).toContainText(
      draftText,
      { timeout: 10000 },
    );

    // A clean restored draft closes without a prompt
    await composer.locator(".post-composer-cancel-button").click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="choice-modal"]')).toHaveCount(0);

    // Restore again and publish; the draft is consumed
    composer = await openComposer(page);
    await composer.locator('[data-testid="composer-drafts-button"]').click();
    await expect(
      page.locator('[data-testid="drafts-dialog"] [data-testid="draft-item"]'),
    ).toHaveCount(1, { timeout: 10000 });
    await page
      .locator('[data-testid="drafts-dialog"] [data-testid="draft-item"]')
      .click();
    await expect(composer.locator(".rich-text-input")).toContainText(
      draftText,
      { timeout: 10000 },
    );
    await composer.locator('[data-testid="composer-submit-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // The published draft is deleted - the drafts list is empty now
    composer = await openComposer(page);
    await composer.locator('[data-testid="composer-drafts-button"]').click();
    await expect(
      page.locator('[data-testid="drafts-dialog"] [data-testid="empty-state"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("hides drafts and confirms discard when the session lacks the draft scopes", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    const scopeWithoutDrafts = OAUTH_SCOPES.split(" ")
      .filter((scope) => !scope.includes("app.bsky.draft."))
      .join(" ");
    await login(page, { scope: scopeWithoutDrafts });
    await page.goto("/");

    const composer = await openComposer(page);
    await composer.locator(".rich-text-input").click();
    await composer.locator(".rich-text-input").type("Ephemeral thought");
    await expect(
      composer.locator('[data-testid="composer-drafts-button"]'),
    ).toHaveCount(0);
    await composer.locator(".post-composer-cancel-button").click();

    // A plain discard confirmation replaces the save-draft choice prompt
    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="choice-modal"]')).toHaveCount(0);
    await confirmModal.locator('[data-testid="modal-confirm-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });
  });

  test("delete a draft from the list with confirmation", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.drafts.push({
      id: "draft-preexisting",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      draft: {
        $type: "app.bsky.draft.defs#draft",
        deviceId: "another-device",
        deviceName: "Web",
        posts: [
          { $type: "app.bsky.draft.defs#draftPost", text: "Delete me please" },
        ],
      },
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const composer = await openComposer(page);
    await composer.locator('[data-testid="composer-drafts-button"]').click();
    const draftsDialog = page.locator('[data-testid="drafts-dialog"]');
    const draftItem = draftsDialog.locator('[data-testid="draft-item"]');
    await expect(draftItem).toHaveCount(1, { timeout: 10000 });

    await draftItem.locator('[data-testid="draft-item-delete"]').click();
    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });
    await confirmModal.locator('[data-testid="modal-confirm-button"]').click();

    await expect(
      draftsDialog.locator('[data-testid="empty-state"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("video draft round-trips through the local byte store and re-uploads", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    // Stub video metadata loading - the fake buffer isn't a playable video, so
    // the real <video> element would fire `error` instead of `loadedmetadata`
    await page.addInitScript(() => {
      const proto = HTMLMediaElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "src");
      const origSet = desc.set;
      Object.defineProperty(proto, "src", {
        configurable: true,
        get: desc.get,
        set(val) {
          origSet.call(this, val);
          queueMicrotask(() => {
            if (this.tagName !== "VIDEO") return;
            Object.defineProperty(this, "videoWidth", {
              value: 1280,
              configurable: true,
            });
            Object.defineProperty(this, "videoHeight", {
              value: 720,
              configurable: true,
            });
            Object.defineProperty(this, "duration", {
              value: 5,
              configurable: true,
            });
            this.dispatchEvent(new Event("loadedmetadata"));
          });
        },
      });
    });

    await login(page);
    await page.goto("/");

    let composer = await openComposer(page);
    await composer.locator(".rich-text-input").click();
    await composer.locator(".rich-text-input").type("Video for later");
    await composer.locator(".media-picker-input").setInputFiles({
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake-video-data"),
    });
    await expect(composer.locator(".video-preview-item")).toBeVisible({
      timeout: 10000,
    });

    // Save as a draft from the cancel prompt
    await composer.locator(".post-composer-cancel-button").click();
    const choiceModal = page.locator('[data-testid="choice-modal"]');
    await expect(choiceModal).toBeVisible({ timeout: 10000 });
    await choiceModal.locator('[data-testid="modal-choice-save"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // The list row shows the video placeholder thumbnail
    composer = await openComposer(page);
    await composer.locator('[data-testid="composer-drafts-button"]').click();
    const draftItem = page.locator(
      '[data-testid="drafts-dialog"] [data-testid="draft-item"]',
    );
    await expect(draftItem).toHaveCount(1, { timeout: 10000 });
    await expect(
      draftItem.locator('[data-testid="draft-item-media"]'),
    ).toBeVisible();

    // Selecting restores the video through the normal upload pipeline
    await draftItem.click();
    await expect(composer.locator(".rich-text-input")).toContainText(
      "Video for later",
      { timeout: 10000 },
    );
    await expect(composer.locator(".video-preview-item")).toBeVisible({
      timeout: 10000,
    });
    await expect(composer.locator(".video-preview-overlay")).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("draft limit error keeps the composer open with a toast", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.draftLimitReached = true;
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const composer = await openComposer(page);
    await composer.locator(".rich-text-input").click();
    await composer.locator(".rich-text-input").type("One draft too many");
    await composer.locator(".post-composer-cancel-button").click();

    const choiceModal = page.locator('[data-testid="choice-modal"]');
    await expect(choiceModal).toBeVisible({ timeout: 10000 });
    await choiceModal.locator('[data-testid="modal-choice-save"]').click();

    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "maximum number of drafts",
      { timeout: 10000 },
    );
    await expect(composer).toBeVisible();
  });
});
