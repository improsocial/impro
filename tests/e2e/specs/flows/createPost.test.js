import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

test.describe("Create post flow", () => {
  test("should show created post on profile after composing from home", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    const postText = "Hello world, this is my new post!";

    await login(page);
    await page.goto("/");

    // Click the sidebar compose button on home view
    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    // Wait for the post composer dialog to appear
    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Type the post text into the rich text input
    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type(postText);

    // Click the Post button
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Wait for the composer to close
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to own profile
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText(postText);
  });

  test("should create post with image upload and alt text", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Open composer
    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Type post text
    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("Check out this photo!");

    // Upload a 1x1 pixel PNG via file input
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const fileInput = composer.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(pngBase64, "base64"),
    });

    // Verify image preview appears
    await expect(composer.locator(".image-preview-item")).toHaveCount(1, {
      timeout: 10000,
    });

    // Alt indicator should show no alt text initially
    await expect(composer.locator(".alt-indicator.no-alt")).toBeVisible();

    // Click the image to open alt text dialog
    await composer.locator(".image-preview-item img").click();

    // Wait for the alt text dialog to appear
    const altDialog = page.locator(
      "image-alt-text-dialog .image-alt-text-dialog",
    );
    await expect(altDialog).toBeVisible({ timeout: 10000 });

    // Type alt text
    await altDialog
      .locator(".image-alt-text-dialog-textarea")
      .fill("A beautiful sunset over the mountains");

    // Save alt text
    await altDialog
      .locator(".rounded-button-primary", { hasText: "Save" })
      .click();

    // Verify alt indicator now shows has-alt
    await expect(composer.locator(".alt-indicator.has-alt")).toBeVisible();

    // Click Post
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Wait for the composer to close
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to profile and verify post appears
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Check out this photo!");

    // Verify the image embed rendered with alt text
    const postImages = profileView.locator('[data-testid="post-images"]');
    await expect(postImages).toBeVisible();
    await expect(postImages.locator(".alt-indicator")).toContainText("ALT");
    await expect(postImages.locator("img.post-image")).toHaveAttribute(
      "alt",
      "A beautiful sunset over the mountains",
    );
  });

  test("should create post with external link preview embed", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.setExternalLinkCard("https://example.com/article", {
      title: "Example Article Title",
      description: "This is a great article about testing",
    });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Open composer
    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Type text with URL and a trailing space to trigger link detection
    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("Great article https://example.com/article ");

    // Wait for the external link card preview to appear
    await expect(composer.locator('[data-testid="external-link"]')).toBeVisible(
      { timeout: 10000 },
    );
    await expect(
      composer.locator('[data-testid="external-link-title"]'),
    ).toContainText("Example Article Title");
    await expect(
      composer.locator('[data-testid="external-link-description"]'),
    ).toContainText("This is a great article about testing");

    // Click Post
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Wait for the composer to close
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to profile and verify post appears with the link embed
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("Great article");
    await expect(
      profileView.locator('[data-testid="external-link-title"]'),
    ).toContainText("Example Article Title");
  });

  test("should create post with quote post embed by pasting bsky.app URL", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const originalPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Original post to be quoted",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addPosts([originalPost]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Open composer
    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Type text with a bsky.app post URL and a trailing space to trigger quote detection
    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type(
      "My thoughts: https://bsky.app/profile/author1.bsky.social/post/post1 ",
    );

    // Wait for the quoted post embed preview to appear
    await expect(composer.locator(".quoted-post")).toBeVisible({
      timeout: 10000,
    });
    await expect(composer.locator(".quoted-post")).toContainText(
      "Original post to be quoted",
    );

    // Click Post
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Wait for the composer to close
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to profile and verify post appears with the quote embed
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("My thoughts:");
    await expect(profileView).toContainText("Original post to be quoted");
  });

  test("should create post with mention and hashtag facet resolution", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const mentionedUser = createProfile({
      did: "did:plc:alice123",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    mockServer.addTypeaheadProfiles([mentionedUser]);
    mockServer.addProfile(mentionedUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Open composer
    const homeView = page.locator("#home-view");
    await expect(homeView).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="sidebar-compose-button"]').click();

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();

    // Type text with a mention to trigger typeahead
    await richTextInput.type("Hello @ali");

    // Wait for mention typeahead to appear
    const typeahead = page.locator(".mention-typeahead");
    await expect(typeahead).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".mention-suggestion")).toHaveCount(1);
    await expect(page.locator(".mention-suggestion-handle")).toContainText(
      "@alice.bsky.social",
    );

    // Select the mention via keyboard
    await page.keyboard.press("Enter");

    // Typeahead should close after selection
    await expect(typeahead).not.toBeVisible({ timeout: 5000 });

    // Wait for cursor repositioning after mention selection (uses setTimeout)
    await page.waitForTimeout(50);

    // Continue typing a hashtag (use keyboard to avoid refocusing the element)
    await page.keyboard.type(" loves #testing ");

    // Click Post
    await composer
      .locator(".rounded-button-primary", { hasText: "Post" })
      .click();

    // Wait for the composer to close
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    // Navigate to profile and verify post appears with mention and hashtag
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(profileView).toContainText("@alice.bsky.social");
    await expect(profileView).toContainText("#testing");
  });
});
