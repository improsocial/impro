import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";
import {
  OPEN_LINK_ORIGIN,
  TEST_PLUGIN_MANIFEST,
  getOpenLinkPluginSource,
} from "../../testPlugins.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/abc123";

const mainPost = createPost({
  uri: postUri,
  text: "This is the main post",
  authorHandle: "author1.bsky.social",
  authorDisplayName: "Author One",
});

async function setup(page) {
  const mockServer = new MockServer();
  mockServer.installedPlugins = [
    {
      ...TEST_PLUGIN_MANIFEST,
      permissions: { open: [`${OPEN_LINK_ORIGIN}/*`] },
      enabled: true,
    },
  ];
  mockServer.localPluginSource = getOpenLinkPluginSource();
  mockServer.addPosts([mainPost]);
  await mockServer.setup(page);
  await login(page);
  await page.goto("/profile/author1.bsky.social/post/abc123");
  const largePost = page.locator(
    '#post-detail-view [data-testid="large-post"]',
  );
  await expect(largePost).toBeVisible({ timeout: 10000 });
  return { largePost };
}

test.describe("Plugin open links", () => {
  test("a permitted context menu link opens in a new tab without a warning", async ({
    page,
  }) => {
    const { largePost } = await setup(page);

    await largePost.locator('[data-testid="post-context-menu-button"]').click();
    const menu = page.locator(".post-context-menu");
    const permitted = menu.locator("context-menu-item", {
      hasText: "Open permitted link",
    });
    await expect(permitted).toBeVisible({ timeout: 10000 });
    await expect(
      menu.locator("context-menu-item", { hasText: "Open unpermitted link" }),
    ).toHaveCount(0);

    const popupPromise = page.waitForEvent("popup");
    await permitted.click();
    const popup = await popupPromise;

    expect(popup.url()).toBe(`${OPEN_LINK_ORIGIN}/${postUri}`);
    await expect(
      page.locator('[data-testid="external-link-warning-title"]'),
    ).toHaveCount(0);
  });

  test("a permitted link in plugin content opens without a warning", async ({
    page,
  }) => {
    await setup(page);

    const link = page.locator(
      '#post-detail-view [data-testid="plugin-open-link"]',
    );
    await expect(link).toBeVisible({ timeout: 10000 });

    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;

    expect(popup.url()).toBe(`${OPEN_LINK_ORIGIN}/${postUri}`);
    await expect(
      page.locator('[data-testid="external-link-warning-title"]'),
    ).toHaveCount(0);
  });
});
