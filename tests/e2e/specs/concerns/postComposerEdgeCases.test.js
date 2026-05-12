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
    const fileInput = composer.locator(`.media-picker-input`);
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
    const fileInput = composer.locator(`.media-picker-input`);
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

  test("closing external link preview while preview image is loading does not throw", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const linkUrl = "https://example.com/article";
    mockServer.setExternalLinkCard(linkUrl, {
      title: "Example Article",
      description: "An interesting article",
      image: "https://example.com/preview-image.jpg",
    });
    await mockServer.setup(page);

    let resolveImageRoute;
    await page.route("**/preview-image.jpg", (route) => {
      resolveImageRoute = () =>
        route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: Buffer.from(pngBase64, "base64"),
        });
    });

    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type(linkUrl + " ");

    const linkPreview = composer.locator('[data-testid="external-link"]');
    await expect(linkPreview).toBeVisible({ timeout: 10000 });
    await expect(linkPreview).toContainText("Example Article");

    await composer.locator(".embed-preview-close-button").click();
    await expect(linkPreview).not.toBeVisible();

    resolveImageRoute();
    await page.waitForTimeout(500);

    expect(pageErrors).toHaveLength(0);
  });

  test("closing external link preview while metadata is loading does not throw", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const linkUrl = "https://example.com/slow-article";
    await mockServer.setup(page);

    let resolveCardybRoute;
    await page.route(
      (url) => url.toString().includes("cardyb.bsky.app/v1/extract"),
      (route) => {
        resolveCardybRoute = () =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              title: "Slow Article",
              description: "Takes a while to load",
            }),
          });
      },
    );

    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await login(page);
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type(linkUrl + " ");

    const linkPreview = composer.locator('[data-testid="external-link"]');
    await expect(linkPreview).toBeVisible({ timeout: 10000 });

    await composer.locator(".embed-preview-close-button").click();
    await expect(linkPreview).not.toBeVisible();

    resolveCardybRoute();
    await page.waitForTimeout(500);

    expect(pageErrors).toHaveLength(0);
  });

  test.describe("Video upload failure modes", () => {
    // Stub video metadata loading so we can exercise the upload state machine
    // without a real playable video buffer. Our test "video" file is just a few
    // bytes — the real <video> element would fire `error`, not `loadedmetadata`.
    async function stubVideoMetadataLoading(page) {
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
    }

    function fakeVideoFile(name = "clip.mp4") {
      return {
        name,
        mimeType: "video/mp4",
        buffer: Buffer.from("fake-video-data"),
      };
    }

    test("unreadable video file shows a toast and no preview", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);

      await login(page);
      await page.goto("/intent/compose");

      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 10000 });

      // No metadata stub — the browser will fire `error` on the bogus buffer.
      const videoInput = composer.locator(".media-picker-input");
      await videoInput.setInputFiles(fakeVideoFile());

      await expect(page.locator(".toast")).toContainText(
        "Could not read video file",
        { timeout: 5000 },
      );
      await expect(
        composer.locator(".post-composer-video-preview"),
      ).toHaveCount(0);
    });

    test("rejects upload when service reports canUpload=false", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.videoCanUpload = false;
      mockServer.videoUploadMessage = "Daily video limit reached";
      await stubVideoMetadataLoading(page);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/intent/compose");

      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 10000 });

      const videoInput = composer.locator(".media-picker-input");
      await videoInput.setInputFiles(fakeVideoFile());

      // Preview appears (metadata stub succeeded), then upload fails with the
      // service message and the overlay flips to the error state.
      const preview = composer.locator(".post-composer-video-preview");
      await expect(preview).toBeVisible({ timeout: 5000 });
      await expect(preview).toContainText("Daily video limit reached", {
        timeout: 10000,
      });
      await expect(page.locator(".toast")).toContainText(
        "Daily video limit reached",
      );
    });

    test("surfaces an error when video processing job fails", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.videoJobShouldFail = true;
      await stubVideoMetadataLoading(page);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/intent/compose");

      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 10000 });

      const videoInput = composer.locator(".media-picker-input");
      await videoInput.setInputFiles(fakeVideoFile());

      const preview = composer.locator(".post-composer-video-preview");
      await expect(preview).toBeVisible({ timeout: 5000 });
      await expect(preview).toContainText("mock failure", { timeout: 10000 });
      await expect(page.locator(".toast")).toContainText("mock failure");

      // Remove button still works after the error.
      await preview.locator(".image-preview-remove-button").click();
      await expect(preview).toHaveCount(0);
    });

    test("removing a video while it is processing does not throw", async ({
      page,
    }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error));

      const mockServer = new MockServer();
      // Always stay in encoding so the poll never resolves before we remove.
      mockServer.videoJobPollCounts = {
        get: () => 0,
        set: () => {},
      };
      await stubVideoMetadataLoading(page);
      await mockServer.setup(page);

      await login(page);
      await page.goto("/intent/compose");

      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 10000 });

      const videoInput = composer.locator(".media-picker-input");
      await videoInput.setInputFiles(fakeVideoFile());

      const preview = composer.locator(".post-composer-video-preview");
      await expect(preview).toBeVisible({ timeout: 5000 });

      // Remove the video while polling is still in flight.
      await preview.locator(".image-preview-remove-button").click();
      await expect(preview).toHaveCount(0);

      // Give the in-flight poll(s) a chance to resolve into a removed-video state.
      await page.waitForTimeout(2000);
      expect(pageErrors).toHaveLength(0);
    });
  });
});
