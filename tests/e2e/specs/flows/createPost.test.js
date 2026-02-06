import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";

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
});
