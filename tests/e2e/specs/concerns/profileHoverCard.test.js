import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createProfile } from "../../../shared/factories.js";

const authorDid = "did:plc:hovertarget1";
const authorHandle = "hoveree.bsky.social";

function buildAuthorProfile(overrides = {}) {
  return createProfile({
    did: authorDid,
    handle: authorHandle,
    displayName: "Hoveree",
    description: "A profile with a bio to check that it renders.",
    followersCount: 1234,
    followsCount: 56,
    postsCount: 78,
    viewer: { muted: false, blockedBy: false, following: null },
    ...overrides,
  });
}

function buildFeedPost() {
  return createPost({
    uri: "at://did:plc:hovertarget1/app.bsky.feed.post/hoverpost1",
    text: "hello from a hoverable author",
    authorHandle,
    authorDisplayName: "Hoveree",
    authorDid,
  });
}

async function seedFeed(mockServer, profile) {
  mockServer.addProfile(profile);
  const post = buildFeedPost();
  post.author = profile;
  mockServer.addTimelinePosts([post]);
  mockServer.addPosts([post]);
}

async function hoverAvatarInFeed(page) {
  const avatarLink = page
    .locator(`#home-view a.avatar-link[data-hover-did="${authorDid}"]`)
    .first();
  await expect(avatarLink).toBeVisible({ timeout: 10000 });
  await avatarLink.hover();
  return avatarLink;
}

test.describe("Profile hover card", () => {
  let mockServer;

  test.beforeEach(async ({ page }) => {
    mockServer = new MockServer();
  });

  test("shows a card with the profile's details after hovering an avatar", async ({
    page,
  }) => {
    await seedFeed(mockServer, buildAuthorProfile());
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await hoverAvatarInFeed(page);

    const card = page.locator('[data-testid="profile-hover-card"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('[data-testid="hover-card-name"]')).toContainText(
      "Hoveree",
    );
    await expect(
      card.locator('[data-testid="hover-card-followers-link"]'),
    ).toContainText("1.2K");
    await expect(
      card.locator('[data-testid="hover-card-following-link"]'),
    ).toContainText("56");
  });

  test("does not open the card when the pointer is not over a target", async ({
    page,
  }) => {
    await seedFeed(mockServer, buildAuthorProfile());
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    // Move the pointer to a spot outside any avatar/name/mention target.
    await page.mouse.move(1, 1);
    await page.waitForTimeout(700);

    await expect(
      page.locator('[data-testid="profile-hover-card"]'),
    ).toBeHidden();
  });

  test("clicking an in-card link navigates and dismisses the card", async ({
    page,
  }) => {
    await seedFeed(mockServer, buildAuthorProfile());
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await hoverAvatarInFeed(page);

    const card = page.locator('[data-testid="profile-hover-card"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.locator('[data-testid="hover-card-followers-link"]').click();

    await expect(page).toHaveURL(
      new RegExp(`/profile/${authorHandle}/followers$`),
    );
    await expect(card).toBeHidden({ timeout: 5000 });
  });

  test("blocked profile shows View profile and no counts/bio", async ({
    page,
  }) => {
    // A post authored by someone else that @-mentions the blocked user. The
    // blocked user's own posts are filtered out of feeds, so we use a mention
    // as the hover target instead.
    const blockedProfile = buildAuthorProfile({
      viewer: { blocking: "at://did:plc:testuser123/app.bsky.graph.block/1" },
    });
    mockServer.addProfile(blockedProfile);

    const mentionText = `hey @${authorHandle}`;
    const mentionStart = mentionText.indexOf("@");
    const mentionEnd = mentionText.length;
    const mentioningPost = {
      ...createPost({
        uri: "at://did:plc:mentioner/app.bsky.feed.post/mention1",
        text: mentionText,
        authorHandle: "mentioner.bsky.social",
        authorDisplayName: "Mentioner",
      }),
      record: {
        $type: "app.bsky.feed.post",
        text: mentionText,
        createdAt: "2025-01-01T00:00:00.000Z",
        langs: ["en"],
        facets: [
          {
            index: { byteStart: mentionStart, byteEnd: mentionEnd },
            features: [
              {
                $type: "app.bsky.richtext.facet#mention",
                did: authorDid,
              },
            ],
          },
        ],
      },
    };
    mockServer.addTimelinePosts([mentioningPost]);
    mockServer.addPosts([mentioningPost]);

    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const mentionLink = page
      .locator(`#home-view a[data-hover-did="${authorDid}"]`)
      .first();
    await expect(mentionLink).toBeVisible({ timeout: 10000 });
    await mentionLink.hover();

    const card = page.locator('[data-testid="profile-hover-card"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(
      card.locator('[data-testid="hover-card-view-profile"]'),
    ).toBeVisible();
    await expect(
      card.locator('[data-testid="hover-card-followers-link"]'),
    ).toHaveCount(0);
    await expect(card.locator('[data-testid="follow-button"]')).toHaveCount(0);
  });

  test("self profile shows no follow button", async ({ page }) => {
    const selfProfile = buildAuthorProfile({
      did: "did:plc:testuser123",
    });
    selfProfile.handle = "testuser.bsky.social";
    mockServer.addProfile(selfProfile);
    const post = buildFeedPost();
    post.author = selfProfile;
    post.uri = `at://${selfProfile.did}/app.bsky.feed.post/selfpost1`;
    mockServer.addTimelinePosts([post]);
    mockServer.addPosts([post]);

    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    const avatarLink = page
      .locator(`#home-view a.avatar-link[data-hover-did="${selfProfile.did}"]`)
      .first();
    await expect(avatarLink).toBeVisible({ timeout: 10000 });
    await avatarLink.hover();

    const card = page.locator('[data-testid="profile-hover-card"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('[data-testid="follow-button"]')).toHaveCount(0);
    await expect(
      card.locator('[data-testid="hover-card-view-profile"]'),
    ).toHaveCount(0);
  });

  test("clicking Follow in the card flips it to Following without dismissing", async ({
    page,
  }) => {
    await seedFeed(mockServer, buildAuthorProfile());
    await mockServer.setup(page);
    await login(page);
    await page.goto("/");
    await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });

    await hoverAvatarInFeed(page);

    const card = page.locator('[data-testid="profile-hover-card"]');
    await expect(card).toBeVisible({ timeout: 5000 });
    const followButton = card.locator('[data-testid="follow-button"]');
    await expect(followButton).toHaveAttribute("data-teststate", "follow");
    await followButton.click();
    await expect(followButton).toHaveAttribute("data-teststate", "following", {
      timeout: 5000,
    });
    // The card is still open after following.
    await expect(card).toBeVisible();
  });
});
