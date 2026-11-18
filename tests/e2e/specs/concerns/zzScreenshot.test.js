import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createFeedGenerator, createTrend } from "../../../shared/factories.js";

test(`screenshot`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 750 });
  const mockServer = new MockServer();
  const feeds = [
    ["Science", "bossett.social", 98213],
    ["Quiet Posters", "why.bsky.team", 45120],
    ["Cat Pics", "cats.example.com", 2310],
  ].map(([name, handle, likes], i) => {
    const feed = createFeedGenerator({
      uri: `at://did:plc:creator${i}/app.bsky.feed.generator/f${i}`,
      displayName: name,
      creatorHandle: handle,
    });
    feed.likeCount = likes;
    return feed;
  });
  mockServer.addFeedGenerators(feeds);
  mockServer.addSuggestedFeeds(feeds);
  mockServer.addTrends([
    createTrend({
      topic: "World Series",
      status: "hot",
      category: "sports",
      postCount: 12400,
    }),
    createTrend({
      topic: "Election results",
      category: "politics",
      postCount: 8800,
    }),
    createTrend({
      topic: "New iPhone",
      category: "science-tech",
      postCount: 3100,
    }),
    createTrend({ topic: "Gardening", category: "other", postCount: 900 }),
  ]);
  await mockServer.setup(page);
  await login(page);
  await page.goto("/");
  await expect(page.locator('[data-testid="suggested-feed-row"]')).toHaveCount(
    3,
    { timeout: 10000 },
  );
  await page.locator('[data-testid="suggested-feeds-dismiss-button"]').hover();
  await page.waitForTimeout(300);
  await page
    .locator(".view-column-right")
    .screenshot({ path: `${process.env.SHOTDIR}/dismiss.png` });
  await page.locator('[data-testid="suggested-feeds-dismiss-button"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${process.env.SHOTDIR}/dismiss-modal.png` });
});
