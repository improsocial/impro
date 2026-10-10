import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.use({ locale: "en-US" });

async function openComposer(page) {
  await page.locator('[data-testid="sidebar-compose-button"]').click();
  const composer = page.locator("post-composer .post-composer");
  await expect(composer).toBeVisible({ timeout: 10000 });
  return composer;
}

async function openLanguageMenu(page, composer) {
  await composer.locator('[data-testid="composer-language-button"]').click();
  const menu = page.locator(".post-language-menu .context-menu");
  await expect(menu).toBeVisible();
  return menu;
}

async function openLanguageDialog(page, composer) {
  const menu = await openLanguageMenu(page, composer);
  await menu.locator('[data-testid="menu-action-more-languages"]').click();
  const dialog = page.locator('[data-testid="post-language-dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function publish(composer, text) {
  await composer.locator(".rich-text-input").first().click();
  await composer.locator(".rich-text-input").first().type(text);
  await composer.locator('[data-testid="composer-submit-button"]').click();
  await expect(composer).not.toBeVisible({ timeout: 10000 });
}

test.describe("Post language flow", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
  });

  test("publishes with the primary language by default", async ({ page }) => {
    const composer = await openComposer(page);
    await publish(composer, "Hello");
    expect(mockServer.applyWritesCalls[0][0].value.langs).toEqual(["en"]);
  });

  test("publishes with a language picked from the menu and moves it to the top of the menu", async ({
    page,
  }) => {
    let composer = await openComposer(page);
    let menu = await openLanguageMenu(page, composer);
    await menu.locator('[data-testid="menu-action-post-language-ja"]').click();
    await expect(menu).not.toBeVisible();
    await publish(composer, "こんにちは");
    expect(mockServer.applyWritesCalls[0][0].value.langs).toEqual(["ja"]);

    composer = await openComposer(page);
    menu = await openLanguageMenu(page, composer);
    const items = menu.locator('[data-testid^="menu-action-post-language-"]');
    await expect(items.first()).toHaveAttribute(
      "data-testid",
      "menu-action-post-language-ja",
    );
    await expect(
      menu.locator('[data-testid="menu-action-post-language-en"]'),
    ).toHaveAttribute("data-teststate", "selected");
  });

  test("publishes with up to three languages chosen in the dialog", async ({
    page,
  }) => {
    const composer = await openComposer(page);
    const dialog = await openLanguageDialog(page, composer);
    await dialog.locator('[data-testid="post-language-option-de"]').click();
    await dialog.locator('[data-testid="post-language-option-fr"]').click();
    await expect(
      dialog.locator('[data-testid="post-language-option-es"] input'),
    ).toBeDisabled();
    await dialog.locator('[data-testid="post-language-done-button"]').click();
    await expect(dialog).not.toBeVisible();

    await publish(composer, "Hallo, bonjour");
    expect(mockServer.applyWritesCalls[0][0].value.langs).toEqual([
      "en",
      "de",
      "fr",
    ]);
  });

  test("keeps the current languages when the dialog is dismissed", async ({
    page,
  }) => {
    const composer = await openComposer(page);
    const dialog = await openLanguageDialog(page, composer);
    await dialog.locator('[data-testid="post-language-option-de"]').click();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await publish(composer, "Hello");
    expect(mockServer.applyWritesCalls[0][0].value.langs).toEqual(["en"]);
  });
});
