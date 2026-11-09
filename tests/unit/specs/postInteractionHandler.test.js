import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { haptics } from "/js/haptics.js";
import { createPost } from "../../shared/factories.js";
import { flushMicrotasks, waitFor } from "../testHelpers.js";

describe("PostInteractionHandler.handleDownloadVideo", () => {
  const videoPost = createPost({
    uri: "at://did:plc:alice/app.bsky.feed.post/3kvideopost",
    text: "",
    authorHandle: "alice.test",
    embed: {
      $type: "app.bsky.embed.video#view",
      cid: "bafkreivideo",
      playlist: "https://video.bsky.app/watch/did/cid/playlist.m3u8",
    },
  });

  let handler;
  let originalFetch;
  let originalUserAgent;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let clickedDownloads;

  beforeEach((t) => {
    document.body.innerHTML = "";
    const dataLayer = {
      identityResolver: {
        resolveEndpoint: async (did) => ({
          did,
          pds: "https://pds.example.com",
        }),
      },
    };
    handler = new PostInteractionHandler(dataLayer, null, null);
    originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(
      async () =>
        new Response("video-bytes", {
          headers: { "content-type": "video/mp4" },
        }),
    );
    originalUserAgent = Object.getOwnPropertyDescriptor(
      window.navigator,
      "userAgent",
    );
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = () => "blob:video";
    URL.revokeObjectURL = () => {};
    clickedDownloads = [];
    t.mock.method(window.HTMLAnchorElement.prototype, "click", function () {
      clickedDownloads.push(this.download);
    });
    t.mock.method(console, "warn", () => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUserAgent) {
      Object.defineProperty(window.navigator, "userAgent", originalUserAgent);
    } else {
      delete window.navigator.userAgent;
    }
    delete window.navigator.canShare;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    document.body.innerHTML = "";
  });

  function emulateIOS() {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      configurable: true,
    });
    Object.defineProperty(window.navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
  }

  function getToasts() {
    return [...document.querySelectorAll('[data-testid="toast"]')];
  }

  it("downloads the video file directly on desktop", async () => {
    await handler.handleDownloadVideo(videoPost);
    assert.deepEqual(clickedDownloads, ["alice.test-3kvideopost.mp4"]);
    assert(
      document.querySelector('[data-testid="video-download-modal"]') === null,
    );
  });

  it("shows a progress toast while downloading", async () => {
    const download = handler.handleDownloadVideo(videoPost);
    assert.deepEqual(getToasts().length, 1);
    assert.deepEqual(getToasts()[0].dataset.teststate, "default");
    await download;
  });

  it("shows an error toast when the download fails", async () => {
    globalThis.fetch = mock.fn(async () => new Response("", { status: 400 }));
    await handler.handleDownloadVideo(videoPost);
    assert.deepEqual(clickedDownloads, []);
    assert(getToasts().some((toast) => toast.dataset.teststate === "error"));
  });

  it("ignores a second tap while the same video is downloading", async () => {
    const first = handler.handleDownloadVideo(videoPost);
    const second = handler.handleDownloadVideo(videoPost);
    await Promise.all([first, second]);
    assert.deepEqual(globalThis.fetch.mock.callCount(), 1);
    assert.deepEqual(clickedDownloads.length, 1);
  });

  it("opens the save modal instead of downloading on iOS", async () => {
    emulateIOS();
    handler.handleDownloadVideo(videoPost);
    assert(
      document.querySelector('[data-testid="video-download-modal"]') !== null,
    );
    await waitFor(
      () =>
        document.querySelector(
          '[data-testid="video-download-modal"] .modal-dialog-content',
        ).dataset.teststate === "ready",
    );
    await flushMicrotasks();
    assert.deepEqual(clickedDownloads, []);
  });

  it("opens the save modal on iOS even when files can't be shared", async () => {
    emulateIOS();
    Object.defineProperty(window.navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
    handler.handleDownloadVideo(videoPost);
    assert(
      document.querySelector('[data-testid="video-download-modal"]') !== null,
    );
    assert.deepEqual(clickedDownloads, []);
  });
});

describe("PostInteractionHandler haptics", () => {
  const post = createPost({
    uri: "at://did:plc:alice/app.bsky.feed.post/3khaptics",
    text: "hello",
    authorHandle: "alice.test",
  });

  let handler;
  let composePost;

  beforeEach((t) => {
    document.body.innerHTML = "";
    t.mock.method(haptics, "impactLight", () => Promise.resolve());
    t.mock.method(haptics, "impactMedium", () => Promise.resolve());
    const noopMutation = async () => {};
    const dataLayer = {
      mutations: {
        addLike: noopMutation,
        removeLike: noopMutation,
        addBookmark: noopMutation,
        removeBookmark: noopMutation,
      },
      derived: { $currentUser: { get: () => ({ did: "did:plc:me" }) } },
    };
    composePost = mock.fn(async () => {});
    handler = new PostInteractionHandler(dataLayer, { composePost }, null);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  for (const doLike of [true, false]) {
    it(`plays a light haptic when ${doLike ? "liking" : "unliking"}`, async () => {
      await handler.handleLike(post, doLike);
      assert.equal(haptics.impactLight.mock.callCount(), 1);
      assert.equal(haptics.impactMedium.mock.callCount(), 0);
    });
  }

  for (const doBookmark of [true, false]) {
    it(`plays a light haptic when ${doBookmark ? "bookmarking" : "removing a bookmark"}`, async () => {
      await handler.handleBookmark(post, doBookmark);
      assert.equal(haptics.impactLight.mock.callCount(), 1);
      assert.equal(haptics.impactMedium.mock.callCount(), 0);
    });
  }

  it("plays a light haptic when replying", async () => {
    await handler.handleReply(post);
    assert.equal(haptics.impactLight.mock.callCount(), 1);
    assert.equal(composePost.mock.callCount(), 1);
  });

  it("plays a medium haptic when quoting", async () => {
    await handler.handleQuotePost(post);
    assert.equal(haptics.impactMedium.mock.callCount(), 1);
    assert.equal(haptics.impactLight.mock.callCount(), 0);
  });
});
