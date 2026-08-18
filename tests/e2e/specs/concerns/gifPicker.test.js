import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createGif } from "../../../shared/factories.js";

async function openComposer(page) {
  const homeView = page.locator("#home-view");
  await expect(homeView).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid="sidebar-compose-button"]').click();
  const composer = page.locator("post-composer .post-composer");
  await expect(composer).toBeVisible({ timeout: 10000 });
  return composer;
}

test.describe("GIF picker", () => {
  test("pick a GIF: open, search, select, remove, re-open", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.featuredGifs = [
      createGif({ id: "trend-1" }),
      createGif({ id: "trend-2" }),
    ];
    mockServer.gifSearchResults.set("cats", [
      createGif({ id: "cat-1", title: "cat spin" }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");
    const composer = await openComposer(page);

    // Open the picker: trending loads
    await composer.locator('[data-testid="composer-gif-button"]').click();
    const picker = page.locator('[data-testid="gif-picker-dialog"]');
    await expect(picker).toBeVisible({ timeout: 10000 });
    await expect(picker.locator('[data-testid="gif-picker-tile"]')).toHaveCount(
      2,
      { timeout: 10000 },
    );

    // Search narrows the grid and hides the pills
    await picker.locator('[data-testid="gif-picker-search"]').fill("cats");
    await expect(picker.locator('[data-testid="gif-picker-tile"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(
      picker.locator('[data-testid="gif-picker-pills"]'),
    ).toHaveCount(0);

    // Selecting closes the picker and attaches the preview
    await picker.locator('[data-testid="gif-picker-tile"]').click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });
    await expect(
      composer.locator('[data-testid="composer-gif-preview"]'),
    ).toBeVisible();
    await expect(
      composer.locator('[data-testid="composer-gif-button"]'),
    ).toBeDisabled();
    await expect(composer.locator(".image-picker-button")).toBeDisabled();

    // Remove re-enables the button
    await composer.locator('[data-testid="composer-gif-remove"]').click();
    await expect(
      composer.locator('[data-testid="composer-gif-preview"]'),
    ).toHaveCount(0);
    await expect(
      composer.locator('[data-testid="composer-gif-button"]'),
    ).toBeEnabled();

    // Re-opening shows trending again with a cleared search
    await composer.locator('[data-testid="composer-gif-button"]').click();
    await expect(picker).toBeVisible({ timeout: 10000 });
    await expect(
      picker.locator('[data-testid="gif-picker-search"]'),
    ).toHaveValue("");
    await expect(picker.locator('[data-testid="gif-picker-tile"]')).toHaveCount(
      2,
      { timeout: 10000 },
    );
  });

  test("publishes the picked GIF as an external embed with the wire params", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.featuredGifs = [
      createGif({ id: "dance", contentDescription: "a cat dancing" }),
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");
    const composer = await openComposer(page);

    await composer.locator('[data-testid="composer-gif-button"]').click();
    const picker = page.locator('[data-testid="gif-picker-dialog"]');
    await expect(picker.locator('[data-testid="gif-picker-tile"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await picker.locator('[data-testid="gif-picker-tile"]').click();
    await expect(picker).not.toBeVisible({ timeout: 10000 });

    // Add user alt text through the alt dialog
    await composer.locator('[data-testid="composer-gif-alt-button"]').click();
    const altDialog = page.locator("image-alt-text-dialog");
    await altDialog
      .locator(".image-alt-text-dialog-textarea")
      .fill("a cat spinning");
    await altDialog.locator('[data-testid="alt-text-save"]').click();
    await expect(
      composer.locator(
        '[data-testid="composer-gif-alt-button"][data-teststate="set"]',
      ),
    ).toBeVisible();

    const richTextInput = composer.locator(".rich-text-input");
    await richTextInput.click();
    await richTextInput.type("look at this");
    await composer.locator('[data-testid="composer-submit-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    expect(mockServer.applyWritesCalls.length).toBe(1);
    const record = mockServer.applyWritesCalls[0][0].value;
    expect(record.embed.$type).toBe("app.bsky.embed.external");
    const external = record.embed.external;
    expect(external.uri).toBe(
      "https://static.klipy.com/ii/abc/def/dance.gif?hh=280&ww=498&mp4=dance-mp4&webm=dance-webm",
    );
    expect(external.title).toBe("a cat dancing");
    expect(external.description).toBe("Alt: a cat spinning");
  });
});
