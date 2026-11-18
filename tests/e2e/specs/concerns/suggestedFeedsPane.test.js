import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator } from "../../../shared/factories.js";
import { userProfile } from "../../testData.js";

function createFeed(name) {
  return createFeedGenerator({
    uri: `at://did:plc:creator1/app.bsky.feed.generator/${name}`,
    displayName: name,
    creatorHandle: "creator1.bsky.social",
  });
}

test.describe("Suggested feeds pane", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
    const feeds = ["cats", "dogs", "birds", "fish"].map(createFeed);
    mockServer.addFeedGenerators(feeds);
    mockServer.addSuggestedFeeds(feeds);
    await mockServer.setup(page);
    await login(page);
  });

  test("shows three suggested feeds in the right column", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const pane = page.locator('[data-testid="suggested-feeds-pane"]');
    await expect(pane).toBeVisible();
    await expect(
      pane.locator('[data-testid="suggested-feed-row"]'),
    ).toHaveCount(3);
  });

  test("navigates to the feed when a suggestion is clicked", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="suggested-feed-row"]').first().click();

    await expect(page).toHaveURL(
      /\/profile\/creator1\.bsky\.social\/feed\/cats/,
    );
    await expect(page.locator("#feed-detail-view")).toBeVisible({
      timeout: 10000,
    });
  });

  test("pins a suggested feed in place and unpins it again", async ({
    page,
  }) => {
    await page.goto("/");
    const rows = page.locator('[data-testid="suggested-feed-row"]');
    await expect(rows).toHaveCount(3, { timeout: 10000 });
    const pinButton = rows
      .first()
      .locator('[data-testid="suggested-feed-pin-button"]');

    await pinButton.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(pinButton).toHaveAttribute("data-teststate", "pinned");
    await expect(
      rows.locator('[data-testid="suggested-feed-title"]'),
    ).toHaveText(["cats", "dogs", "birds"]);
    const homeTabs = page.locator("#home-view .tab-bar-button");
    await expect(homeTabs.filter({ hasText: "cats" })).toBeVisible();

    await pinButton.click();

    await expect(pinButton).toHaveAttribute("data-teststate", "not-pinned");
    await expect(homeTabs.filter({ hasText: "cats" })).toHaveCount(0);
  });

  test("skeleton rows match the loaded row height", async ({ page }) => {
    let releaseFeeds;
    const feedsHeld = new Promise((resolve) => {
      releaseFeeds = resolve;
    });
    await page.route(
      "**/xrpc/app.bsky.unspecced.getSuggestedFeeds*",
      async (route) => {
        await feedsHeld;
        await route.fallback();
      },
    );

    await page.goto("/");
    const skeleton = page
      .locator('[data-testid="suggested-feed-skeleton"]')
      .first();
    await expect(skeleton).toBeVisible({ timeout: 10000 });
    const skeletonHeight = (await skeleton.boundingBox()).height;

    releaseFeeds();
    const row = page.locator('[data-testid="suggested-feed-row"]').first();
    await expect(row).toBeVisible();
    expect((await row.boundingBox()).height).toBe(skeletonHeight);
  });

  test("stays hidden after being dismissed", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator('[data-testid="suggested-feeds-pane"]'),
    ).toBeVisible({ timeout: 10000 });

    await page
      .locator('[data-testid="suggested-feeds-dismiss-button"]')
      .click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(
      page.locator('[data-testid="suggested-feeds-pane"]'),
    ).toHaveCount(0);

    await page.reload();
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="suggested-feeds-pane"]'),
    ).toHaveCount(0);

    const sessionState = await page.evaluate(
      (did) => JSON.parse(localStorage.getItem(`session-state:${did}`)),
      userProfile.did,
    );
    expect(sessionState.suggestedFeedsHidden).toBe(true);
  });
});
