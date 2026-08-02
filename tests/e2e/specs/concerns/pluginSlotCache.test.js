import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";
import {
  TEST_PLUGIN_MANIFEST,
  getBadgeSlotPluginSource,
  getUncachedBadgeSlotPluginSource,
} from "../../testPlugin.js";

const AUTHOR_ONE = "did:plc:author1";
const AUTHOR_TWO = "did:plc:author2";

// Two posts by the same author plus one by another, so a did-projected slot
// should run its handler twice for three rendered badges.
function setupFeed(mockServer, { cacheKey = true } = {}) {
  mockServer.installedPlugins = [{ ...TEST_PLUGIN_MANIFEST, enabled: true }];
  mockServer.localPluginSource = cacheKey
    ? getBadgeSlotPluginSource()
    : getUncachedBadgeSlotPluginSource();
  mockServer.addTimelinePosts([
    createPost({
      uri: `at://${AUTHOR_ONE}/app.bsky.feed.post/post1`,
      text: "First post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    }),
    createPost({
      uri: `at://${AUTHOR_ONE}/app.bsky.feed.post/post2`,
      text: "Second post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    }),
    createPost({
      uri: `at://${AUTHOR_TWO}/app.bsky.feed.post/post3`,
      text: "Third post",
      authorHandle: "author2.bsky.social",
      authorDisplayName: "Author Two",
    }),
  ]);
}

function badges(page) {
  return page.locator('#home-view [data-testid="plugin-badge"]');
}

test.describe("Plugin slot caching", () => {
  test("shares one invocation across posts by the same author", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupFeed(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(badges(page)).toHaveCount(3, { timeout: 10000 });
    const texts = await badges(page).allTextContents();
    // Both did:plc:author1 badges carry the same invocation number.
    expect(texts[0]).toEqual(texts[1]);
    expect(texts[0]).toContain(AUTHOR_ONE);
    expect(texts[2]).toContain(AUTHOR_TWO);
    const invocations = texts.map((text) => Number(text.split("#")[1]));
    expect(new Set(invocations).size).toEqual(2);
    expect(Math.max(...invocations)).toEqual(2);
  });

  test("a keyed refresh re-runs one author's badge across its posts", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupFeed(mockServer);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(badges(page)).toHaveCount(3, { timeout: 10000 });
    const before = await badges(page).allTextContents();

    const firstPost = page
      .locator('#home-view [data-testid="feed-item"]')
      .first();
    await firstPost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator(".post-context-menu context-menu-item", {
        hasText: "Refresh badge",
      })
      .click();

    // The refresh is keyed on the clicked post's author, so both of that
    // author's badges re-run - and only theirs.
    await expect(badges(page).first()).not.toHaveText(before[0], {
      timeout: 10000,
    });
    const after = await badges(page).allTextContents();
    expect(after[1]).toEqual(after[0]);
    expect(after[2]).toEqual(before[2]);
  });

  test("a keyed refresh targets instances of a slot with no cacheKey", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupFeed(mockServer, { cacheKey: false });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    await expect(badges(page)).toHaveCount(3, { timeout: 10000 });
    // Without a cacheKey every instance runs its own handler
    const before = await badges(page).allTextContents();
    expect(new Set(before).size).toEqual(3);

    const firstPost = page
      .locator('#home-view [data-testid="feed-item"]')
      .first();
    await firstPost.locator('[data-testid="post-action-more"]').click();
    await page
      .locator(".post-context-menu context-menu-item", {
        hasText: "Refresh badge",
      })
      .click();

    // Only the clicked author's instances re-invoke; the third post keeps the
    // content it already rendered
    await expect(badges(page).first()).not.toHaveText(before[0], {
      timeout: 10000,
    });
    const after = await badges(page).allTextContents();
    expect(after[1]).not.toEqual(before[1]);
    expect(after[2]).toEqual(before[2]);
  });
});
