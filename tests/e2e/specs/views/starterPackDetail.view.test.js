import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { OAUTH_SCOPES } from "../../../../src/oauthScopes.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import {
  createFeedGenerator,
  createPost,
  createProfile,
  createStarterPack,
} from "../../../shared/factories.js";

const PACK_URI = "at://did:plc:creator1/app.bsky.graph.starterpack/coolpack";
const LIST_URI = "at://did:plc:creator1/app.bsky.graph.list/coolpack";
const PACK_PATH = "/profile/creator1.bsky.social/starter-pack/coolpack";
const OWN_PACK_URI = `at://${userProfile.did}/app.bsky.graph.starterpack/mine`;
const OWN_LIST_URI = `at://${userProfile.did}/app.bsky.graph.list/mine`;

function setupPack(mockServer, { description, feeds } = {}) {
  const starterPack = createStarterPack({
    uri: PACK_URI,
    name: "Cool Pack",
    creatorHandle: "creator1.bsky.social",
    description,
    list: true,
    feeds,
  });
  mockServer.addStarterPacks([starterPack]);
  return starterPack;
}

function setupMembers(mockServer, listUri = LIST_URI) {
  const memberOne = createProfile({
    did: "did:plc:member1",
    handle: "member1.bsky.social",
    displayName: "Member One",
  });
  const memberTwo = createProfile({
    did: "did:plc:member2",
    handle: "member2.bsky.social",
    displayName: "Member Two",
  });
  mockServer.addListMembers(listUri, [memberOne, memberTwo]);
  return [memberOne, memberTwo];
}

async function openPack(page, path = PACK_PATH) {
  await login(page);
  await page.goto(path);
  const view = page.locator("#starter-pack-detail-view");
  await expect(view.locator('[data-testid="starter-pack-name"]')).toBeVisible({
    timeout: 10000,
  });
  return view;
}

test.describe("Starter Pack Detail view", () => {
  test("should display name, creator link, and description", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const starterPack = setupPack(mockServer, {
      description: "Great people to follow. See https://example.com",
    });
    starterPack.record.descriptionFacets = [
      {
        index: { byteStart: 28, byteEnd: 47 },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: "https://example.com",
          },
        ],
      },
    ];
    setupMembers(mockServer);
    await mockServer.setup(page);

    const view = await openPack(page);

    await expect(view.locator('[data-testid="starter-pack-name"]')).toHaveText(
      "Cool Pack",
    );
    await expect(
      view.locator('[data-testid="starter-pack-creator"]'),
    ).toContainText("@creator1.bsky.social");
    await expect(
      view.locator('[data-testid="starter-pack-description"]'),
    ).toContainText("Great people to follow.");
    await expect(
      view.locator('[data-testid="starter-pack-description"] a'),
    ).toHaveAttribute("href", "https://example.com/");

    await view.locator('[data-testid="starter-pack-creator"] a').click();
    await expect(page).toHaveURL(/\/profile\/creator1\.bsky\.social$/, {
      timeout: 10000,
    });
  });

  test("should resolve the bsky.app style routes to the same page", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    setupMembers(mockServer);
    await mockServer.setup(page);

    await openPack(page, "/starter-pack/creator1.bsky.social/coolpack");
    await page.goto("/start/creator1.bsky.social/coolpack");
    await expect(
      page.locator(
        '#starter-pack-detail-view [data-testid="starter-pack-name"]',
      ),
    ).toHaveText("Cool Pack", { timeout: 10000 });
  });

  test("should list members on the People tab in reversed order and hide blocked ones", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    const [memberOne, memberTwo] = setupMembers(mockServer);
    const blocked = createProfile({
      did: "did:plc:blocked",
      handle: "blocked.bsky.social",
      displayName: "Blocked Person",
      viewer: { blocking: "at://did:plc:testuser123/app.bsky.graph.block/1" },
    });
    mockServer.addListMembers(LIST_URI, [memberOne, memberTwo, blocked]);
    await mockServer.setup(page);

    const view = await openPack(page);

    await expect(
      view.locator('[data-testid="starter-pack-tab-content"]'),
    ).toHaveAttribute("data-teststate", "people");
    const handles = view.locator('[data-testid="profile-list-item-handle"]');
    await expect(handles).toHaveCount(2, { timeout: 10000 });
    await expect(handles.nth(0)).toContainText("member2.bsky.social");
    await expect(handles.nth(1)).toContainText("member1.bsky.social");
  });

  test("should show the Feeds tab only when the pack has feeds", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const feed = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/cool-feed",
      displayName: "Cool Feed",
      creatorHandle: "creator1.bsky.social",
    });
    mockServer.addFeedGenerators([feed]);
    setupPack(mockServer, { feeds: [feed] });
    setupMembers(mockServer);
    await mockServer.setup(page);

    const view = await openPack(page);

    await view.locator('[data-testid="tab-feeds"]').click();
    await expect(
      view.locator('[data-testid="starter-pack-tab-content"]'),
    ).toHaveAttribute("data-teststate", "feeds");
    await expect(view.locator(".feeds-list-item")).toHaveCount(1);
    await expect(view.locator(".feeds-list-item")).toContainText("Cool Feed");
  });

  test("should omit the Feeds tab when the pack has no feeds", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    setupMembers(mockServer);
    await mockServer.setup(page);

    const view = await openPack(page);

    await expect(view.locator('[data-testid="tab-people"]')).toBeVisible();
    await expect(view.locator('[data-testid="tab-posts"]')).toBeVisible();
    await expect(view.locator('[data-testid="tab-feeds"]')).toHaveCount(0);
  });

  test("should show the list feed on the Posts tab", async ({ page }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    setupMembers(mockServer);
    const post = createPost({
      uri: "at://did:plc:member1/app.bsky.feed.post/p1",
      text: "A post from a pack member",
      authorHandle: "member1.bsky.social",
      authorDisplayName: "Member One",
    });
    mockServer.addListFeedItems(LIST_URI, [post]);
    await mockServer.setup(page);

    const view = await openPack(page);

    await view.locator('[data-testid="tab-posts"]').click();
    await expect(
      view.locator('[data-testid="starter-pack-tab-content"]'),
    ).toHaveAttribute("data-teststate", "posts");
    await expect(view.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(view).toContainText("A post from a pack member");
  });

  test("should show not found when the pack does not exist", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addStarterPacks([
      createStarterPack({
        uri: "at://did:plc:creator1/app.bsky.graph.starterpack/other",
        name: "Other",
        creatorHandle: "creator1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(PACK_PATH);

    await expect(
      page.locator(
        '#starter-pack-detail-view [data-testid="starter-pack-not-found"]',
      ),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show not found when the backing list is gone", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    mockServer.addStarterPacks([
      createStarterPack({
        uri: PACK_URI,
        name: "Cool Pack",
        creatorHandle: "creator1.bsky.social",
      }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(PACK_PATH);

    await expect(
      page.locator(
        '#starter-pack-detail-view [data-testid="starter-pack-not-found"]',
      ),
    ).toBeVisible({ timeout: 10000 });
  });

  test.describe("Follow all", () => {
    test("should follow eligible members with the pack as via", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const starterPack = setupPack(mockServer);
      const [memberOne] = setupMembers(mockServer);
      const alreadyFollowed = createProfile({
        did: "did:plc:followed",
        handle: "followed.bsky.social",
        displayName: "Already Followed",
        viewer: { following: "at://did:plc:testuser123/follow/1" },
      });
      const muted = createProfile({
        did: "did:plc:muted",
        handle: "muted.bsky.social",
        displayName: "Muted Person",
        viewer: { muted: true },
      });
      mockServer.addListMembers(LIST_URI, [
        memberOne,
        alreadyFollowed,
        muted,
        userProfile,
      ]);
      await mockServer.setup(page);

      const view = await openPack(page);

      const button = view.locator('[data-testid="starter-pack-follow-all"]');
      await expect(button).toHaveAttribute("data-teststate", "idle");
      await expect(
        view.locator('[data-testid="starter-pack-share"]'),
      ).toHaveCount(0);
      await button.click();

      await expect(page.locator('[data-testid="toast"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(button).toHaveAttribute("data-teststate", "idle");

      const writes = mockServer.applyWritesCalls.flat();
      expect(writes.length).toBe(1);
      expect(writes[0].$type).toBe("com.atproto.repo.applyWrites#create");
      expect(writes[0].collection).toBe("app.bsky.graph.follow");
      expect(writes[0].value.subject).toBe("did:plc:member1");
      expect(writes[0].value.via).toEqual({
        uri: starterPack.uri,
        cid: starterPack.cid,
      });

      const memberRow = view
        .locator(".profile-list-item")
        .filter({ hasText: "member1.bsky.social" });
      await expect(
        memberRow.locator('[data-testid="follow-button"]'),
      ).toHaveAttribute("data-teststate", "following");
    });

    test("should toast an error and re-enable the button when the write fails", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      setupMembers(mockServer);
      await mockServer.setup(page);
      await page.route("**/xrpc/com.atproto.repo.applyWrites*", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "InternalServerError" }),
        }),
      );

      const view = await openPack(page);

      const button = view.locator('[data-testid="starter-pack-follow-all"]');
      await button.click();

      await expect(page.locator('[data-testid="toast"].error')).toBeVisible({
        timeout: 10000,
      });
      await expect(button).toHaveAttribute("data-teststate", "idle");
      await expect(button).toBeEnabled();
    });
  });

  test.describe("Share", () => {
    test("should show Share instead of Follow all on the owner's pack and copy the link", async ({
      page,
      browserName,
    }) => {
      const mockServer = new MockServer();
      mockServer.addStarterPacks([
        createStarterPack({
          uri: OWN_PACK_URI,
          name: "My Pack",
          creatorHandle: userProfile.handle,
          list: true,
        }),
      ]);
      setupMembers(mockServer, OWN_LIST_URI);
      await mockServer.setup(page);
      if (browserName === "chromium") {
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
      }

      const view = await openPack(
        page,
        `/profile/${userProfile.handle}/starter-pack/mine`,
      );

      await expect(
        view.locator('[data-testid="starter-pack-creator"]'),
      ).toContainText("by you");
      await expect(
        view.locator('[data-testid="starter-pack-follow-all"]'),
      ).toHaveCount(0);
      await view.locator('[data-testid="starter-pack-share"]').click();

      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      if (browserName === "chromium") {
        const clipboardText = await page.evaluate(() =>
          navigator.clipboard.readText(),
        );
        expect(clipboardText).toBe(
          `https://bsky.app/starter-pack/${userProfile.handle}/mine`,
        );
      }
    });

    test("should copy the link from the header menu", async ({
      page,
      browserName,
    }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      setupMembers(mockServer);
      await mockServer.setup(page);
      if (browserName === "chromium") {
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
      }

      const view = await openPack(page);

      await view.locator(".context-menu-button").click();
      await view
        .locator('[data-testid="menu-action-starter-pack-copy-link"]')
        .click();

      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      if (browserName === "chromium") {
        const clipboardText = await page.evaluate(() =>
          navigator.clipboard.readText(),
        );
        expect(clipboardText).toBe(
          "https://bsky.app/starter-pack/creator1.bsky.social/coolpack",
        );
      }
    });
  });

  test.describe("Logged-out behavior", () => {
    test("should render the pack with a sign-in prompt and no follow buttons", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      const [memberOne] = setupMembers(mockServer);
      const hidden = createProfile({
        did: "did:plc:hidden",
        handle: "hidden.bsky.social",
        displayName: "Hidden Person",
      });
      hidden.labels = [
        {
          val: "!no-unauthenticated",
          src: hidden.did,
          uri: `at://${hidden.did}/app.bsky.actor.profile/self`,
          cts: "2025-01-01T00:00:00.000Z",
        },
      ];
      mockServer.addListMembers(LIST_URI, [memberOne, hidden]);
      await mockServer.setup(page);

      await page.goto(PACK_PATH);

      const view = page.locator("#starter-pack-detail-view");
      await expect(
        view.locator('[data-testid="starter-pack-name"]'),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        view.locator('[data-testid="starter-pack-follow-all"]'),
      ).toHaveCount(0);
      await expect(
        view.locator('[data-testid="starter-pack-share"]'),
      ).toHaveCount(0);
      await expect(
        view.locator('[data-testid="starter-pack-sign-in"]'),
      ).toHaveAttribute("href", /^\/login/);

      const rows = view.locator(".profile-list-item");
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText("member1.bsky.social");
      await expect(rows.locator('[data-testid="follow-button"]')).toHaveCount(
        0,
      );
    });
  });

  test("should open the pack from a post embed in-app", async ({ page }) => {
    const mockServer = new MockServer();
    const starterPack = setupPack(mockServer);
    setupMembers(mockServer);
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/embedpost",
      text: "Check out this pack",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    post.embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.graph.defs#starterPackViewBasic",
        uri: starterPack.uri,
        cid: starterPack.cid,
        record: starterPack.record,
        creator: starterPack.creator,
      },
    };
    mockServer.addPosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/profile/author1.bsky.social/post/embedpost");

    await page.locator(".starter-pack-embed a").first().click();

    await expect(page).toHaveURL(new RegExp(PACK_PATH.replace(/\//g, "\\/")), {
      timeout: 10000,
    });
    await expect(
      page.locator(
        '#starter-pack-detail-view [data-testid="starter-pack-name"]',
      ),
    ).toHaveText("Cool Pack", { timeout: 10000 });
  });

  test.describe("Opt out menu item", () => {
    test("should show the opt-out item to an authenticated non-owner", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      setupMembers(mockServer);
      await mockServer.setup(page);

      const view = await openPack(page);

      await view.locator(".context-menu-button").click();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-opt-out"]'),
      ).toHaveAttribute("data-teststate", "opted-in");
    });

    test("should show undo when the viewer already opted out", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      setupMembers(mockServer);
      mockServer.addReferenceListOptOut({
        uri: `at://${userProfile.did}/app.bsky.graph.referencelistoptout/existing`,
        listUri: LIST_URI,
      });
      await mockServer.setup(page);

      const view = await openPack(page);

      await view.locator(".context-menu-button").click();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-opt-out"]'),
      ).toHaveAttribute("data-teststate", "opted-out");
    });

    test("should hide the opt-out item on the owner's pack", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addStarterPacks([
        createStarterPack({
          uri: OWN_PACK_URI,
          name: "My Pack",
          creatorHandle: userProfile.handle,
          list: true,
        }),
      ]);
      setupMembers(mockServer, OWN_LIST_URI);
      await mockServer.setup(page);

      const view = await openPack(
        page,
        `/profile/${userProfile.handle}/starter-pack/mine`,
      );

      await view.locator(".context-menu-button").click();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-copy-link"]'),
      ).toBeVisible();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-opt-out"]'),
      ).toHaveCount(0);
    });

    test("should hide the opt-out item without the opt-out scope", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      setupMembers(mockServer);
      await mockServer.setup(page);

      const scopeWithoutOptOut = OAUTH_SCOPES.split(" ")
        .filter((scope) => !scope.includes("referencelistoptout"))
        .join(" ");
      await login(page, { scope: scopeWithoutOptOut });
      await page.goto(PACK_PATH);

      const view = page.locator("#starter-pack-detail-view");
      await expect(
        view.locator('[data-testid="starter-pack-name"]'),
      ).toBeVisible({ timeout: 10000 });
      await view.locator(".context-menu-button").click();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-copy-link"]'),
      ).toBeVisible();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-opt-out"]'),
      ).toHaveCount(0);
    });

    test("should hide the opt-out item when logged out", async ({ page }) => {
      const mockServer = new MockServer();
      setupPack(mockServer);
      setupMembers(mockServer);
      await mockServer.setup(page);

      await page.goto(PACK_PATH);

      const view = page.locator("#starter-pack-detail-view");
      await expect(
        view.locator('[data-testid="starter-pack-name"]'),
      ).toBeVisible({ timeout: 10000 });
      await view.locator(".context-menu-button").click();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-copy-link"]'),
      ).toBeVisible();
      await expect(
        view.locator('[data-testid="menu-action-starter-pack-opt-out"]'),
      ).toHaveCount(0);
    });
  });
});
