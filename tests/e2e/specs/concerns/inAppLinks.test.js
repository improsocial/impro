import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../factories.js";

const bskySocialTarget = createProfile({
  did: "did:plc:linktarget1",
  handle: "alice.bsky.social",
  displayName: "Alice",
});

const linkPostUri = "at://did:plc:linker/app.bsky.feed.post/linkpost1";
const targetPostUri = "at://did:plc:target/app.bsky.feed.post/targetpost1";

const postThreadLink =
  "https://bsky.app/profile/target.bsky.social/post/targetpost1";
const listDetailLink =
  "https://bsky.app/profile/target.bsky.social/lists/somelist1";

function createLinkPost() {
  const text = `matching link non-matching link`;
  return {
    ...createPost({
      uri: linkPostUri,
      text,
      authorHandle: "linker.bsky.social",
      authorDisplayName: "Linker",
    }),
    record: {
      $type: "app.bsky.feed.post",
      text,
      createdAt: "2025-01-01T00:00:00.000Z",
      langs: ["en"],
      facets: [
        {
          index: { byteStart: 0, byteEnd: 13 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: postThreadLink,
            },
          ],
        },
        {
          index: { byteStart: 14, byteEnd: 31 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: listDetailLink,
            },
          ],
        },
      ],
    },
  };
}

test.describe("In-app link interception", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();

    const linkPost = createLinkPost();
    mockServer.addTimelinePosts([linkPost]);
    mockServer.addPosts([linkPost]);

    const targetPost = createPost({
      uri: targetPostUri,
      text: "Target post content",
      authorHandle: "target.bsky.social",
      authorDisplayName: "Target User",
    });
    mockServer.addPosts([targetPost]);
    mockServer.setPostThread(targetPostUri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: targetPost,
      parent: null,
      replies: [],
    });

    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
  });

  test("should intercept bsky.app links that match a known route", async ({
    page,
  }) => {
    const matchingLink = page.locator(`a[href="${postThreadLink}"]`);
    await expect(matchingLink).toBeVisible({ timeout: 10000 });

    await matchingLink.click();

    await expect(page.locator("#post-detail-view")).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(
      "/profile/target.bsky.social/post/targetpost1",
    );
  });

  test("should not intercept bsky.app links that do not match a known route", async ({
    page,
  }) => {
    const nonMatchingLink = page.locator(`a[href="${listDetailLink}"]`);
    await expect(nonMatchingLink).toBeVisible({ timeout: 10000 });

    // Allow the external navigation request so we can observe the URL change
    await page.route("https://bsky.app/**", (route) =>
      route.fulfill({ status: 200, body: "<html></html>" }),
    );

    // Clicking the non-matching link should trigger a full browser navigation
    // to the external bsky.app URL instead of an in-app SPA transition
    const navigationPromise = page.waitForURL(`${listDetailLink}**`);
    await nonMatchingLink.click();
    await navigationPromise;

    expect(page.url()).toContain(
      "bsky.app/profile/target.bsky.social/lists/somelist1",
    );
  });

  test("should redirect <handle>.bsky.social links to /profile/<handle>.bsky.social", async ({
    page,
  }) => {
    mockServer.addProfile(bskySocialTarget);

    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.href = "https://alice.bsky.social";
      anchor.textContent = "Alice on Bluesky";
      anchor.id = "test-bsky-social-link";
      document.body.appendChild(anchor);
    });

    await page.locator("#test-bsky-social-link").click();

    await expect(page).toHaveURL(/\/profile\/alice\.bsky\.social$/);
    await expect(
      page.locator('#profile-view [data-testid="profile-name"]'),
    ).toContainText("Alice", { timeout: 10000 });
  });

  test("should intercept relative href links via the router", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.href = "/notifications";
      anchor.textContent = "Notifications";
      anchor.id = "test-relative-link";
      document.body.appendChild(anchor);
    });

    await page.locator("#test-relative-link").click();

    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.locator("#notifications-view")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should not intercept links with data-external set", async ({
    page,
  }) => {
    await page.route("https://example.com/**", (route) =>
      route.fulfill({ status: 200, body: "<html></html>" }),
    );

    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.href = "https://example.com/some-page";
      anchor.textContent = "External";
      anchor.id = "test-external-link";
      anchor.dataset.external = "true";
      document.body.appendChild(anchor);
    });

    const navigationPromise = page.waitForURL("https://example.com/**");
    await page.locator("#test-external-link").click();
    await navigationPromise;

    expect(page.url()).toContain("example.com/some-page");
  });

  test("should not intercept modifier-key clicks on in-app links", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const anchor = document.createElement("a");
      anchor.href = "/notifications";
      anchor.textContent = "Notifications";
      anchor.id = "test-modifier-link";
      document.body.appendChild(anchor);
    });

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.locator("#test-modifier-link").click({ modifiers: [modifier] });

    // SPA navigation should have been skipped — URL stays on home
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#home-view")).toBeVisible();
  });
});
