import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost, createConvo, createProfile } from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/joinLink1";
const postPath = "/profile/author1.bsky.social/post/joinLink1";

function makeJoinLinkPreview(overrides = {}) {
  return {
    $type: "chat.bsky.group.defs#joinLinkPreviewView",
    code: "abcd1234",
    name: "Friends of Bsky",
    memberCount: 5,
    memberLimit: 50,
    joinRule: "open",
    requireApproval: false,
    owner: {
      did: "did:plc:owner",
      handle: "owner.bsky.social",
      displayName: "Owner",
      avatar: "",
      viewer: {},
      labels: [],
      createdAt: "2025-01-01T00:00:00.000Z",
    },
    viewer: {},
    ...overrides,
  };
}

function buildInvitePost(preview) {
  return createPost({
    uri: postUri,
    text: "Join us!",
    authorHandle: "author1.bsky.social",
    authorDisplayName: "Author One",
    embed: {
      $type: "chat.bsky.embed.joinLink#view",
      joinLinkPreview: preview,
    },
  });
}

async function setupInvitePostThread(page, preview, { mockServer } = {}) {
  const server = mockServer ?? new MockServer();
  const post = buildInvitePost(preview);
  server.addPosts([post]);
  server.setPostThread(post.uri, {
    $type: "app.bsky.feed.defs#threadViewPost",
    post,
    replies: [],
  });
  await server.setup(page);
  return server;
}

test.describe("Join link embed flows", () => {
  test.describe("render states", () => {
    test("renders open action when viewer is a member of a different chat", async ({
      page,
    }) => {
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({ convo: { id: "other-convo" } }),
      );
      await login(page);
      await page.goto(postPath);

      await expect(
        page.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "open", { timeout: 10000 });
    });

    test("renders follow-required action when joinRule is followedByOwner and viewer doesn't follow", async ({
      page,
    }) => {
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({ joinRule: "followedByOwner" }),
      );
      await login(page);
      await page.goto(postPath);

      const action = page.locator('[data-testid="join-link-embed-action"]');
      await expect(action).toHaveAttribute(
        "data-teststate",
        "follow-required",
        {
          timeout: 10000,
        },
      );
      await expect(action).toBeDisabled();
    });

    test("renders requested action when viewer has already requested", async ({
      page,
    }) => {
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({
          viewer: { requestedAt: "2026-06-01T00:00:00Z" },
        }),
      );
      await login(page);
      await page.goto(postPath);

      await expect(
        page.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "requested", { timeout: 10000 });
    });
  });

  test.describe("click behaviors", () => {
    test("clicking copy writes the invite URL to the clipboard and shows a toast", async ({
      page,
      browserName,
    }) => {
      // The copy action only shows when the invite points at the current chat,
      // which only happens inside chatDetail. Render an invite embed in a DM
      // where the convo id matches.
      const mockServer = new MockServer();
      const alice = createProfile({
        did: "did:plc:alice1",
        handle: "alice.bsky.social",
        displayName: "Alice",
      });
      const convo = createConvo({ id: "convo-1", otherMember: alice });
      mockServer.addConvos([convo]);
      mockServer.addConvoMessages("convo-1", [
        {
          $type: "chat.bsky.convo.defs#messageView",
          id: "msg-1",
          rev: "rev-msg-1",
          text: "",
          facets: [],
          sender: { did: alice.did },
          sentAt: "2025-01-15T12:00:00.000Z",
          reactions: [],
          embed: {
            $type: "chat.bsky.embed.joinLink#view",
            joinLinkPreview: makeJoinLinkPreview({
              convo: { id: "convo-1" },
            }),
          },
        },
      ]);
      await mockServer.setup(page);

      if (browserName === "chromium") {
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
      }

      await login(page);
      await page.goto("/messages/convo-1");

      await expect(
        page.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "copy", { timeout: 10000 });
      await page.locator('[data-testid="join-link-embed-action"]').click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        "Copied to clipboard",
      );

      if (browserName === "chromium") {
        const clipboardText = await page.evaluate(() =>
          navigator.clipboard.readText(),
        );
        expect(clipboardText).toBe("https://bsky.app/chat/abcd1234");
      }
    });

    test("clicking open navigates to the chat", async ({ page }) => {
      const otherProfile = createProfile({
        did: "did:plc:other1",
        handle: "other.bsky.social",
        displayName: "Other",
      });
      const otherConvo = createConvo({
        id: "other-convo",
        otherMember: otherProfile,
      });
      const mockServer = new MockServer();
      mockServer.addConvos([otherConvo]);
      mockServer.addConvoMessages("other-convo", []);
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({ convo: { id: "other-convo" } }),
        { mockServer },
      );
      await login(page);
      await page.goto(postPath);

      await expect(
        page.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "open", { timeout: 10000 });
      await page.locator('[data-testid="join-link-embed-action"]').click();

      await expect(page).toHaveURL(/\/messages\/other-convo$/, {
        timeout: 10000,
      });
      await expect(page.locator("#chat-detail-view")).toBeVisible();
    });

    test("clicking request opens the dialog and confirming shows a success toast", async ({
      page,
    }) => {
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({ requireApproval: true }),
      );
      await login(page);
      await page.goto(postPath);

      await expect(
        page.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "request", { timeout: 10000 });
      await page.locator('[data-testid="join-link-embed-action"]').click();

      await expect(
        page.locator('[data-testid="join-group-chat-dialog"]'),
      ).toBeVisible();
      await page
        .locator('[data-testid="join-group-chat-dialog-confirm"]')
        .click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        "Request sent",
      );
      await expect(
        page.locator('[data-testid="join-group-chat-dialog"]'),
      ).toHaveCount(0);
    });

    test("clicking requested shows a 'request pending' toast", async ({
      page,
    }) => {
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({
          viewer: { requestedAt: "2026-06-01T00:00:00Z" },
        }),
      );
      await login(page);
      await page.goto(postPath);

      const action = page.locator('[data-testid="join-link-embed-action"]');
      await expect(action).toHaveAttribute("data-teststate", "requested", {
        timeout: 10000,
      });
      await action.click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        "Request pending",
      );
    });
  });

  test.describe("join confirmation", () => {
    test("on success, the action flips to the requested state", async ({
      page,
    }) => {
      await setupInvitePostThread(
        page,
        makeJoinLinkPreview({ requireApproval: true }),
      );
      await login(page);
      await page.goto(postPath);

      const action = page.locator('[data-testid="join-link-embed-action"]');
      await expect(action).toHaveAttribute("data-teststate", "request", {
        timeout: 10000,
      });
      await action.click();

      await page
        .locator('[data-testid="join-group-chat-dialog-confirm"]')
        .click();

      await expect(action).toHaveAttribute("data-teststate", "requested", {
        timeout: 10000,
      });
    });

    test("on failure, the dialog stays open and an error toast appears", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.failJoinLinkRequest("abcd1234");
      await setupInvitePostThread(page, makeJoinLinkPreview(), { mockServer });
      await login(page);
      await page.goto(postPath);

      const action = page.locator('[data-testid="join-link-embed-action"]');
      await expect(action).toHaveAttribute("data-teststate", "join", {
        timeout: 10000,
      });
      await action.click();

      await page
        .locator('[data-testid="join-group-chat-dialog-confirm"]')
        .click();

      await expect(page.locator('[data-testid="toast"]')).toContainText(
        "Could not send join request",
      );
      await expect(
        page.locator('[data-testid="join-group-chat-dialog"]'),
      ).toBeVisible();
    });

    test("cancel button closes the dialog without sending the request", async ({
      page,
    }) => {
      await setupInvitePostThread(page, makeJoinLinkPreview());
      await login(page);
      await page.goto(postPath);

      await page.locator('[data-testid="join-link-embed-action"]').click();
      await expect(
        page.locator('[data-testid="join-group-chat-dialog"]'),
      ).toBeVisible();

      await page
        .locator('[data-testid="join-group-chat-dialog-cancel"]')
        .click();

      await expect(
        page.locator('[data-testid="join-group-chat-dialog"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="join-link-embed-action"]'),
      ).toHaveAttribute("data-teststate", "join");
    });

    test("clicking the backdrop closes the dialog", async ({ page }) => {
      await setupInvitePostThread(page, makeJoinLinkPreview());
      await login(page);
      await page.goto(postPath);

      await page.locator('[data-testid="join-link-embed-action"]').click();
      const dialog = page.locator('[data-testid="join-group-chat-dialog"]');
      await expect(dialog).toBeVisible();

      // Click at the very top-left corner (outside the dialog content)
      await dialog.click({ position: { x: 2, y: 2 } });

      await expect(dialog).toHaveCount(0);
    });
  });
});
