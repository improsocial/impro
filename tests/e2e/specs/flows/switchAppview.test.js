import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createConvo,
  createMessage,
  createPost,
  createProfile,
} from "../../factories.js";

const BLACKSKY_APPVIEW_DID = "did:web:api.blacksky.community#bsky_appview";
const BLACKSKY_CHAT_DID = "did:web:api.blacksky.community#bsky_chat";
const BLUESKY_APPVIEW_DID = "did:web:api.bsky.app#bsky_appview";
const BLUESKY_CHAT_DID = "did:web:api.bsky.chat#bsky_chat";

async function seedAppViewConfig(page, config) {
  // Seed on the first page load only; otherwise addInitScript would re-seed
  // on every subsequent navigation and defeat things like the reset flow.
  await page.addInitScript((seeded) => {
    if (sessionStorage.getItem("test-appview-seeded") === "true") return;
    localStorage.setItem("appview-config", JSON.stringify(seeded));
    sessionStorage.setItem("test-appview-seeded", "true");
  }, config);
}

function collectProxyHeaders(page, pathFragment) {
  const headers = [];
  page.on("request", (request) => {
    if (request.url().includes(pathFragment)) {
      const header = request.headers()["atproto-proxy"];
      if (header) {
        headers.push(header);
      }
    }
  });
  return headers;
}

function buildTimelineMockServer() {
  const mockServer = new MockServer();
  const author = createProfile({
    did: "did:plc:someone",
    handle: "someone.bsky.social",
    displayName: "Someone",
  });
  mockServer.addProfile(author);
  mockServer.addTimelinePosts([
    createPost({
      uri: "at://did:plc:someone/app.bsky.feed.post/post1",
      text: "Hello",
      authorHandle: author.handle,
      authorDisplayName: author.displayName,
    }),
  ]);
  return mockServer;
}

test.describe("Switch app view flow", () => {
  test("uses the stored app view DID as the atproto-proxy header on app.bsky requests", async ({
    page,
  }) => {
    const mockServer = buildTimelineMockServer();
    await mockServer.setup(page);

    const appProxyHeaders = collectProxyHeaders(page, "/xrpc/app.bsky.");

    await seedAppViewConfig(page, {
      id: "blacksky",
      appViewServiceDid: BLACKSKY_APPVIEW_DID,
      chatServiceDid: BLACKSKY_CHAT_DID,
    });
    await login(page);

    await page.goto("/");
    await expect(
      page.locator("#home-view").locator('[data-testid="feed-item"]'),
    ).toHaveCount(1, { timeout: 10000 });

    expect(appProxyHeaders.length).toBeGreaterThan(0);
    for (const header of appProxyHeaders) {
      expect(header).toBe(BLACKSKY_APPVIEW_DID);
    }
  });

  test("uses the stored chat DID as the atproto-proxy header on chat.bsky requests", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherMember = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    const lastMessage = createMessage({
      id: "msg-1",
      text: "Hello",
      senderDid: otherMember.did,
      sentAt: "2025-01-15T12:00:00.000Z",
    });
    mockServer.addConvos([
      createConvo({ id: "convo-1", otherMember, lastMessage }),
    ]);
    await mockServer.setup(page);

    const chatProxyHeaders = collectProxyHeaders(page, "/xrpc/chat.bsky.");

    await seedAppViewConfig(page, {
      id: "blacksky",
      appViewServiceDid: BLACKSKY_APPVIEW_DID,
      chatServiceDid: BLACKSKY_CHAT_DID,
    });
    await login(page);

    await page.goto("/messages");
    await expect(page.locator("#chat-view .convo-item")).toHaveCount(1, {
      timeout: 10000,
    });

    expect(chatProxyHeaders.length).toBeGreaterThan(0);
    for (const header of chatProxyHeaders) {
      expect(header).toBe(BLACKSKY_CHAT_DID);
    }
  });

  test("reset-appview query param clears the stored config and strips the param", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await seedAppViewConfig(page, {
      id: "blacksky",
      appViewServiceDid: BLACKSKY_APPVIEW_DID,
      chatServiceDid: BLACKSKY_CHAT_DID,
    });

    await page.goto("/?reset-appview=1");

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("appview-config")))
      .toBeNull();

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.has("reset-appview")).toBe(false);
  });

  test("reverts to the Bluesky defaults after reset", async ({ page }) => {
    const mockServer = buildTimelineMockServer();
    const otherMember = createProfile({
      did: "did:plc:alice1",
      handle: "alice.bsky.social",
      displayName: "Alice",
    });
    mockServer.addConvos([
      createConvo({
        id: "convo-1",
        otherMember,
        lastMessage: createMessage({
          id: "msg-1",
          text: "Hello",
          senderDid: otherMember.did,
          sentAt: "2025-01-15T12:00:00.000Z",
        }),
      }),
    ]);
    await mockServer.setup(page);

    const appProxyHeaders = collectProxyHeaders(page, "/xrpc/app.bsky.");
    const chatProxyHeaders = collectProxyHeaders(page, "/xrpc/chat.bsky.");

    await seedAppViewConfig(page, {
      id: "blacksky",
      appViewServiceDid: BLACKSKY_APPVIEW_DID,
      chatServiceDid: BLACKSKY_CHAT_DID,
    });
    await login(page);

    // Only assert on requests made after the reset; wait for any lingering
    // requests from the /login page to complete before clearing.
    await page.waitForLoadState("networkidle");
    appProxyHeaders.length = 0;
    chatProxyHeaders.length = 0;
    await page.goto("/?reset-appview=1");
    await expect(
      page.locator("#home-view").locator('[data-testid="feed-item"]'),
    ).toHaveCount(1, { timeout: 10000 });

    await page.goto("/messages");
    await expect(page.locator("#chat-view .convo-item")).toHaveCount(1, {
      timeout: 10000,
    });

    expect(appProxyHeaders.length).toBeGreaterThan(0);
    for (const header of appProxyHeaders) {
      expect(header).toBe(BLUESKY_APPVIEW_DID);
    }
    expect(chatProxyHeaders.length).toBeGreaterThan(0);
    for (const header of chatProxyHeaders) {
      expect(header).toBe(BLUESKY_CHAT_DID);
    }
  });

  test("persists the selected App View to localStorage when the form is submitted", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await page.goto("/login");
    await page.locator("#login-advanced summary").click();
    await page.locator('select[name="appview"]').selectOption("blacksky");
    await page.locator('input[name="handle"]').fill("someone.bsky.social");
    await page.locator('button[type="submit"]').click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("appview-config");
          return raw ? JSON.parse(raw) : null;
        }),
      )
      .toEqual({
        id: "blacksky",
        appViewServiceDid: BLACKSKY_APPVIEW_DID,
        chatServiceDid: BLACKSKY_CHAT_DID,
      });
  });
});
