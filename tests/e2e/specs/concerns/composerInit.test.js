import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";
import {
  TEST_PLUGIN_MANIFEST,
  getPostComposerInitPluginSource,
} from "../../testPlugin.js";

function installComposerInitPlugin(mockServer) {
  mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];
  mockServer.localPluginSource = getPostComposerInitPluginSource();
}

test.describe("Composer init plugin flow", () => {
  test("plugin seeds the composer with text when opening a new post", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    installComposerInitPlugin(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await expect(richTextInput).toContainText("— from test plugin (post)", {
      timeout: 10000,
    });
  });

  test("plugin sees kind=reply when opening a reply composer", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    installComposerInitPlugin(mockServer);
    const rootPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Original post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addPosts([rootPost]);
    mockServer.setPostThread(rootPost.uri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: rootPost,
      parent: null,
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/author1.bsky.social/post/post1`);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });
    await view.locator(".post-thread-reply-prompt").click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await expect(richTextInput).toContainText("— from test plugin (reply)", {
      timeout: 10000,
    });
  });

  test("seeded text is sent with the post", async ({ page }) => {
    const mockServer = new MockServer();
    installComposerInitPlugin(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await expect(richTextInput).toContainText("— from test plugin (post)", {
      timeout: 10000,
    });

    await richTextInput.click();
    await page.keyboard.type("Hello world");

    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    await expect(composer).not.toBeVisible({ timeout: 10000 });

    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Hello world");
    await expect(profileView).toContainText("— from test plugin (post)");
  });
});
