import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function createTestImage(name) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64"),
  };
}

test.describe("Post Composer Edge Cases", () => {
  test("character limit enforcement — counter turns red and submit disabled past 300 chars", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const contentEditable = composer.locator(
      "rich-text-input [contenteditable]",
    );
    const postButton = composer.locator(".rounded-button-primary", {
      hasText: "Post",
    });
    const wordCount = composer.locator(".word-count");
    const wordCountText = composer.locator(".word-count-text");

    // Fill 298 chars — counter should show 2, no overflow
    await contentEditable.fill("a".repeat(298));
    await expect(wordCountText).toHaveText("2");
    await expect(wordCount).not.toHaveClass(/overflow/);
    await expect(postButton).toBeEnabled();

    // Fill 305 chars — counter should show -5, overflow class, button disabled
    await contentEditable.fill("a".repeat(305));
    await expect(wordCountText).toHaveText("-5");
    await expect(wordCount).toHaveClass(/overflow/);
    await expect(postButton).toBeDisabled();

    // Fill exactly 300 chars — counter should show 0, no overflow, button enabled
    await contentEditable.fill("a".repeat(300));
    await expect(wordCountText).toHaveText("0");
    await expect(wordCount).not.toHaveClass(/overflow/);
    await expect(postButton).toBeEnabled();
  });

  test("multiple image upload — add images, remove one, verify correct images remain", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Upload 3 images at once
    const fileInput = composer.locator('input[type="file"]');
    await fileInput.setInputFiles([
      createTestImage("image1.png"),
      createTestImage("image2.png"),
      createTestImage("image3.png"),
    ]);

    // Verify 3 image previews appear
    await expect(composer.locator(".image-preview-item")).toHaveCount(3, {
      timeout: 10000,
    });

    // All 3 should show no-alt indicator
    await expect(composer.locator(".alt-indicator.no-alt")).toHaveCount(3);

    // Remove the second image (index 1)
    await composer.locator(".image-preview-remove-button").nth(1).click();

    // Verify 2 image previews remain
    await expect(composer.locator(".image-preview-item")).toHaveCount(2);

    // Upload a 4th image to verify we can still add more
    await fileInput.setInputFiles([createTestImage("image4.png")]);

    // Verify 3 image previews now
    await expect(composer.locator(".image-preview-item")).toHaveCount(3, {
      timeout: 10000,
    });
  });

  test("image alt text editing — add and modify alt text on uploaded images", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Upload an image
    const fileInput = composer.locator('input[type="file"]');
    await fileInput.setInputFiles(createTestImage("photo.png"));

    await expect(composer.locator(".image-preview-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Initially shows no-alt indicator
    await expect(composer.locator(".alt-indicator.no-alt")).toBeVisible();

    // Click image to open alt text dialog
    await composer.locator(".image-preview-item img").click();

    const altDialog = page.locator(
      "image-alt-text-dialog .image-alt-text-dialog",
    );
    await expect(altDialog).toBeVisible({ timeout: 10000 });

    // Add alt text
    await altDialog
      .locator(".image-alt-text-dialog-textarea")
      .fill("A sunset photo");
    await altDialog
      .locator(".rounded-button-primary", { hasText: "Save" })
      .click();

    // Verify has-alt indicator
    await expect(composer.locator(".alt-indicator.has-alt")).toBeVisible();

    // Click image again to modify alt text
    await composer.locator(".image-preview-item img").click();

    const altDialog2 = page.locator(
      "image-alt-text-dialog .image-alt-text-dialog",
    );
    await expect(altDialog2).toBeVisible({ timeout: 10000 });

    // Verify existing alt text is loaded
    await expect(
      altDialog2.locator(".image-alt-text-dialog-textarea"),
    ).toHaveValue("A sunset photo");

    // Modify alt text
    await altDialog2
      .locator(".image-alt-text-dialog-textarea")
      .fill("A beautiful sunset over the ocean");
    await altDialog2
      .locator(".rounded-button-primary", { hasText: "Save" })
      .click();

    // Verify still has-alt
    await expect(composer.locator(".alt-indicator.has-alt")).toBeVisible();
  });

  test("reply composer context — parent post shown in composer when replying", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const postUri = "at://did:plc:author1/app.bsky.feed.post/post1";
    const post = createPost({
      uri: postUri,
      text: "This is the parent post content",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addPosts([post]);
    mockServer.addTimelinePosts([post]);
    mockServer.setPostThread(postUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post,
      parent: null,
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);

    // Navigate to thread view
    await page.goto("/profile/author1.bsky.social/post/post1");

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });

    // Click reply prompt to open composer
    await view.locator(".post-thread-reply-prompt").click();

    const composer = page.locator("post-composer");
    await expect(composer.locator("dialog")).toBeVisible({ timeout: 10000 });

    // Verify parent post context is shown in the composer
    const replyContext = composer.locator(".reply-to");
    await expect(replyContext).toBeVisible();
    await expect(replyContext).toContainText("This is the parent post content");
    await expect(replyContext).toContainText("Author One");

    // Verify the submit button says "Reply" not "Post"
    await expect(
      composer.locator("button.rounded-button-primary", { hasText: "Reply" }),
    ).toBeVisible();

    // Verify placeholder says "Write your reply"
    await expect(
      composer.locator(".rich-text-input-placeholder"),
    ).toContainText("Write your reply");
  });

  test("post creation error handling — failed creation shows error feedback", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    // Override createRecord to return a 500 error (LIFO — checked before mockServer's handler)
    await page.route("**/xrpc/com.atproto.repo.createRecord*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "InternalServerError",
          message: "Something went wrong",
        }),
      }),
    );

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("This post will fail to send");

    // Click Post
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Verify error toast appears
    const errorToast = page.locator(".toast.error");
    await expect(errorToast).toBeVisible({ timeout: 10000 });
    await expect(errorToast).toContainText("Failed to send post");

    // Verify composer remains open (not closed on error)
    await expect(composer).toBeVisible();
  });

  test("typeahead in post composer — mention suggestions appear and can be selected", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const bob = createProfile({
      did: "did:plc:bob456",
      handle: "bob.bsky.social",
      displayName: "Bob Smith",
    });
    const carol = createProfile({
      did: "did:plc:carol789",
      handle: "carol.bsky.social",
      displayName: "Carol Jones",
    });
    mockServer.addTypeaheadProfiles([bob, carol]);
    mockServer.addProfile(bob);
    mockServer.addProfile(carol);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("Hey @bo");

    // Wait for typeahead to appear
    const typeahead = page.locator(".mention-typeahead");
    await expect(typeahead).toBeVisible({ timeout: 10000 });

    // Verify suggestions are shown
    await expect(page.locator(".mention-suggestion")).toHaveCount(2);
    await expect(
      page.locator(".mention-suggestion-handle").first(),
    ).toContainText("@bob.bsky.social");

    // Navigate down with arrow key and select with Enter
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".mention-suggestion.selected")).toHaveCount(1);
    await page.keyboard.press("Enter");

    // Typeahead should close after selection
    await expect(typeahead).not.toBeVisible({ timeout: 5000 });

    // The mention should be inserted in the text
    await expect(richTextInput).toContainText("@bob.bsky.social");
  });
});
