import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

test.describe("Edit profile flow", () => {
  test("should open edit dialog, update display name and description, and save", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "Original description",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Test User", { timeout: 10000 });

    // Click the "Edit Profile" button
    await profileView.locator('[data-testid="edit-profile-button"]').click();

    // Wait for the dialog to appear
    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Verify fields are pre-populated
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toHaveValue("Test User");
    await expect(
      dialog.locator('[data-testid="edit-profile-description"]'),
    ).toHaveValue("Original description");

    // Clear and type new display name
    await dialog
      .locator('[data-testid="edit-profile-display-name"]')
      .fill("Updated User");

    // Clear and type new description
    await dialog
      .locator('[data-testid="edit-profile-description"]')
      .fill("Updated description");

    // Click Save
    await dialog.locator('[data-testid="edit-profile-save-button"]').click();

    // Verify the toast shows success
    await expect(page.locator(".toast")).toContainText("Profile updated", {
      timeout: 5000,
    });

    // Verify the profile view reflects the updated name
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Updated User", { timeout: 10000 });
  });

  test("should not allow saving when no changes are made", async ({ page }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "My description",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Save button should be disabled when no changes are made
    await expect(
      dialog.locator('[data-testid="edit-profile-save-button"]'),
    ).toBeDisabled();
  });

  test("should show character count overflow for display name", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Type a display name that exceeds the 64 character limit
    const longName = "A".repeat(65);
    await dialog
      .locator('[data-testid="edit-profile-display-name"]')
      .fill(longName);

    // The character count should show overflow styling
    await expect(
      dialog.locator(".edit-profile-char-count.overflow"),
    ).toBeVisible();

    // Save button should be disabled
    await expect(
      dialog.locator('[data-testid="edit-profile-save-button"]'),
    ).toBeDisabled();
  });

  test("should close dialog when cancel is clicked", async ({ page }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await dialog
      .locator(".edit-profile-dialog-header-button", { hasText: "Cancel" })
      .click();

    // Dialog should be closed
    await expect(dialog.locator(".edit-profile-dialog[open]")).toHaveCount(0, {
      timeout: 5000,
    });

    // Profile should remain unchanged
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Test User");
  });

  test("should open context menu with upload option when clicking avatar", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "",
      avatar: "http://localhost/mock-avatar.jpg",
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Click avatar preview to open context menu
    await dialog.locator(".edit-profile-avatar-preview").click();

    // Context menu should appear with "Upload from Files" and "Remove Avatar"
    const menu = dialog.locator(".edit-profile-avatar-menu");
    await expect(
      menu.locator("context-menu-item", { hasText: "Upload from Files" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      menu.locator("context-menu-item", { hasText: "Remove Avatar" }),
    ).toBeVisible();
  });

  test("should not show remove option when no avatar exists", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "",
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Click avatar preview to open context menu
    await dialog.locator(".edit-profile-avatar-preview").click();

    // Context menu should only have "Upload from Files"
    const menu = dialog.locator(".edit-profile-avatar-menu");
    await expect(
      menu.locator("context-menu-item", { hasText: "Upload from Files" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      menu.locator("context-menu-item", { hasText: "Remove Avatar" }),
    ).toHaveCount(0);
  });

  test("should remove avatar via context menu and save", async ({ page }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "",
      avatar: "http://localhost/mock-avatar.jpg",
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Avatar image should be visible in the preview
    await expect(
      dialog.locator(
        ".edit-profile-avatar-preview img:not(.edit-profile-avatar-placeholder)",
      ),
    ).toBeVisible();

    // Click avatar preview to open context menu
    await dialog.locator(".edit-profile-avatar-preview").click();

    // Click "Remove Avatar"
    const menu = dialog.locator(".edit-profile-avatar-menu");
    await menu
      .locator("context-menu-item", { hasText: "Remove Avatar" })
      .click();

    // Avatar image should be removed from the preview (placeholder may still exist)
    await expect(
      dialog.locator(
        ".edit-profile-avatar-preview img:not(.edit-profile-avatar-placeholder)",
      ),
    ).toHaveCount(0);

    // Save
    await dialog.locator('[data-testid="edit-profile-save-button"]').click();

    await expect(page.locator(".toast")).toContainText("Profile updated", {
      timeout: 5000,
    });
  });

  test("should remove banner via context menu and save", async ({ page }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "",
      banner: "http://localhost/mock-banner.jpg",
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Banner image should be visible in the preview
    await expect(
      dialog.locator(".edit-profile-banner-preview img"),
    ).toBeVisible();

    // Click banner preview to open context menu
    await dialog.locator(".edit-profile-banner-preview").click();

    // Click "Remove Banner"
    const menu = dialog.locator(".edit-profile-banner-menu");
    await menu
      .locator("context-menu-item", { hasText: "Remove Banner" })
      .click();

    // Banner image should be removed from the preview
    await expect(
      dialog.locator(".edit-profile-banner-preview img"),
    ).toHaveCount(0);

    // Save
    await dialog.locator('[data-testid="edit-profile-save-button"]').click();

    await expect(page.locator(".toast")).toContainText("Profile updated", {
      timeout: 5000,
    });
  });

  test("should return to edit dialog when canceling the image cropper", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "Original description",
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    // Click avatar preview to open context menu
    await dialog.locator(".edit-profile-avatar-preview").click();

    // Click "Upload from Files" to trigger file picker
    const menu = dialog.locator(".edit-profile-avatar-menu");
    const fileInput = dialog.locator(".edit-profile-file-input");

    // Set a file on the hidden file input to trigger the cropper
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      menu
        .locator("context-menu-item", { hasText: "Upload from Files" })
        .click(),
    ]);

    await fileChooser.setFiles({
      name: "test-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8/5+hnoEIwDiqEF8oAABkvQMBzcSaKwAAAABJRU5ErkJggg==",
        "base64",
      ),
    });

    // Wait for cropper to appear
    await expect(dialog.locator("image-cropper")).toBeVisible({
      timeout: 5000,
    });

    // Click Cancel on the cropper
    await dialog
      .locator(".edit-profile-dialog-header-button", { hasText: "Cancel" })
      .click();

    // The edit dialog should still be visible with the original fields
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toHaveValue("Test User");
    await expect(
      dialog.locator('[data-testid="edit-profile-description"]'),
    ).toHaveValue("Original description");

    // The cropper should be gone
    await expect(dialog.locator("image-cropper")).toHaveCount(0);
  });

  test("should show error when save fails", async ({ page }) => {
    const mockServer = new MockServer();
    const currentUser = createProfile({
      did: userProfile.did,
      handle: userProfile.handle,
      displayName: "Test User",
      description: "Original description",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.addProfile(currentUser);
    await mockServer.setup(page);

    await login(page);

    // Override the putRecord route to return an error
    await page.route("**/xrpc/com.atproto.repo.putRecord*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "InternalServerError" }),
      }),
    );

    await page.goto(`/profile/${userProfile.did}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="edit-profile-button"]'),
    ).toBeVisible({ timeout: 10000 });

    await profileView.locator('[data-testid="edit-profile-button"]').click();

    const dialog = page.locator("edit-profile-dialog");
    await expect(
      dialog.locator('[data-testid="edit-profile-display-name"]'),
    ).toBeVisible({ timeout: 5000 });

    await dialog
      .locator('[data-testid="edit-profile-display-name"]')
      .fill("New Name");

    await dialog.locator('[data-testid="edit-profile-save-button"]').click();

    // Error message should appear in the dialog
    await expect(dialog.locator(".edit-profile-error")).toContainText(
      "Failed to save profile",
      { timeout: 5000 },
    );
  });
});
