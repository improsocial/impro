import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createGif } from "../../../shared/factories.js";

test.describe("Post self labels flow", () => {
  test("publishes a post with a content warning label on its media", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.featuredGifs = [createGif({ id: "gif-1" })];
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="sidebar-compose-button"]').click();
    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });
    const labelsButton = composer.locator(
      '[data-testid="composer-labels-button"]',
    );
    await expect(labelsButton).toHaveCount(0);

    await composer.locator('[data-testid="composer-gif-button"]').click();
    const picker = page.locator('[data-testid="gif-picker-dialog"]');
    await picker.locator('[data-testid="gif-picker-tile"]').click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });

    await expect(labelsButton).toHaveAttribute("data-teststate", "unlabeled");
    await labelsButton.click();
    const dialog = page.locator('[data-testid="post-labels-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-testid="post-labels-option-sexual"]').click();
    await dialog.locator('[data-testid="post-labels-option-porn"]').click();
    await expect(
      dialog.locator('[data-testid="post-labels-option-sexual"]'),
    ).toHaveAttribute("data-teststate", "unchecked");
    await dialog.locator('[data-testid="post-labels-done"]').click();
    await expect(dialog).not.toBeVisible();
    await expect(labelsButton).toHaveAttribute("data-teststate", "labeled");

    await composer.locator(".rich-text-input").first().click();
    await composer.locator(".rich-text-input").first().type("Labeled");
    await composer.locator('[data-testid="composer-submit-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    expect(mockServer.applyWritesCalls[0][0].value.labels).toEqual({
      $type: "com.atproto.label.defs#selfLabels",
      values: [{ val: "porn" }],
    });
  });
});
