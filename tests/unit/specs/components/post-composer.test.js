import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../../testHelpers.js";
import { ApiError } from "/js/api.js";
import { getDraftDeviceId } from "/js/drafts.js";
import "/js/components/post-composer.js";

describe("post-composer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  async function nextFrame() {
    // The render effect flushes on requestAnimationFrame (setTimeout(0) in the
    // test env), so one tick applies pending renders.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function connectElement(element) {
    const container = document.createElement("div");
    container.className = "page-visible";
    container.appendChild(element);
    document.body.appendChild(container);
  }

  function createPostComposer({ draftsEnabled = true } = {}) {
    const element = document.createElement("post-composer");
    element.draftsEnabled = draftsEnabled;
    element.currentUser = {
      did: "did:plc:test",
      handle: "test.bsky.social",
      displayName: "Test User",
      avatar: null,
    };
    element.pluginService = {
      $richTextTransformsVersion: { get: () => 0 },
      transformRichTextTokens: async () => null,
      renderRichTextNodeToken: () => null,
    };
    return element;
  }

  describe("PostComposer - rendering", () => {
    it("should render dialog element", () => {
      const element = createPostComposer();
      connectElement(element);
      const dialog = element.querySelector(".post-composer");
      assert(dialog !== null);
      assert.deepEqual(dialog.tagName, "DIALOG");
    });

    it("should render cancel button", () => {
      const element = createPostComposer();
      connectElement(element);
      const cancelButton = element.querySelector(
        ".post-composer-cancel-button",
      );
      assert(cancelButton !== null);
    });

    it("should render post button", () => {
      const element = createPostComposer();
      connectElement(element);
      const postButton = element.querySelector(".rounded-button-primary");
      assert(postButton !== null);
    });

    it("should render rich-text-input", () => {
      const element = createPostComposer();
      connectElement(element);
      const richTextInput = element.querySelector("rich-text-input");
      assert(richTextInput !== null);
    });

    it("should render image picker button", () => {
      const element = createPostComposer();
      connectElement(element);
      const imageButton = element.querySelector(".image-picker-button");
      assert(imageButton !== null);
    });

    it("should render character count", () => {
      const element = createPostComposer();
      connectElement(element);
      const wordCount = element.querySelector(".word-count-text");
      assert(wordCount !== null);
      assert.deepEqual(wordCount.textContent, "300");
    });
  });

  describe("PostComposer - placeholder text", () => {
    it("should show 'What's up?' for new posts", () => {
      const element = createPostComposer();
      connectElement(element);
      const richTextInput = element.querySelector("rich-text-input");
      assert.deepEqual(richTextInput.getAttribute("placeholder"), "What's up?");
    });

    it("should show 'Write your reply' for replies", () => {
      const element = createPostComposer();
      element.replyTo = {
        author: { handle: "user.bsky.social", displayName: "User" },
        record: { text: "Original post", createdAt: new Date().toISOString() },
        indexedAt: new Date().toISOString(),
      };
      connectElement(element);
      const richTextInput = element.querySelector("rich-text-input");
      assert.deepEqual(
        richTextInput.getAttribute("placeholder"),
        "Write your reply",
      );
    });
  });

  describe("PostComposer - button text", () => {
    it("should show 'Post' for new posts", () => {
      const element = createPostComposer();
      connectElement(element);
      const postButton = element.querySelector(".rounded-button-primary");
      assert(postButton.textContent.includes("Post"));
    });

    it("should show 'Reply' for replies", () => {
      const element = createPostComposer();
      element.replyTo = {
        author: { handle: "user.bsky.social", displayName: "User" },
        record: { text: "Original post", createdAt: new Date().toISOString() },
        indexedAt: new Date().toISOString(),
      };
      connectElement(element);
      const postButton = element.querySelector(".rounded-button-primary");
      assert(postButton.textContent.includes("Reply"));
    });
  });

  describe("PostComposer - initial state", () => {
    it("should start with empty post text", () => {
      const element = createPostComposer();
      connectElement(element);
      assert.deepEqual(element.state.$postText.get(), "");
    });

    it("should not be sending initially", () => {
      const element = createPostComposer();
      connectElement(element);
      assert.deepEqual(element.state.$isSending.get(), false);
    });

    it("should have no selected images initially", () => {
      const element = createPostComposer();
      connectElement(element);
      assert.deepEqual(element.state.$selectedImages.get().length, 0);
    });
  });

  describe("PostComposer - character limit", () => {
    it("should show 300 remaining characters initially", () => {
      const element = createPostComposer();
      connectElement(element);
      const wordCount = element.querySelector(".word-count-text");
      assert.deepEqual(wordCount.textContent, "300");
    });

    it("should add overflow class when over limit", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("x".repeat(301));
      await nextFrame();
      const wordCountContainer = element.querySelector(".word-count");
      assert(wordCountContainer.classList.contains("overflow"));
    });

    it("should disable post button when over limit", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("x".repeat(301));
      await nextFrame();
      const postButton = element.querySelector(".rounded-button-primary");
      assert(postButton.disabled);
    });
  });

  describe("PostComposer - open method", () => {
    it("should show the dialog when open() is called", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();
      const dialog = element.querySelector(".post-composer");
      assert(dialog.open);
    });

    it("should render the rich text input with autofocus so showModal focuses it", () => {
      const element = createPostComposer();
      connectElement(element);
      const richTextInput = element.querySelector("rich-text-input");
      assert(richTextInput.hasAttribute("autofocus"));
      assert(
        element.querySelector(".rich-text-input").hasAttribute("autofocus"),
      );
    });
  });

  describe("PostComposer - close method", () => {
    it("should close the dialog when close() is called", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();
      element.close();
      const dialog = element.querySelector(".post-composer");
      assert(!dialog.open);
    });

    it("should dispatch post-composer-closed event when close() is called", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();

      let eventFired = false;
      element.addEventListener("post-composer-closed", () => {
        eventFired = true;
      });

      element.close();
      assert(eventFired);
    });
  });

  describe("PostComposer - send method", () => {
    it("should set isSending to true when send() is called", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");

      // Listen for the event but don't do anything
      element.addEventListener("send-post", () => {});

      element.send();
      assert.deepEqual(element.state.$isSending.get(), true);
    });

    it("should dispatch send-post event with post data", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");

      let receivedDetail = null;
      element.addEventListener("send-post", (e) => {
        receivedDetail = e.detail;
      });

      element.send();
      assert.deepEqual(receivedDetail.post.postText, "Hello world");
      assert.deepEqual(receivedDetail.draft, null);
    });

    it("carries draft passthrough fields in the send-post detail", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");
      const labels = {
        $type: "com.atproto.label.defs#selfLabels",
        values: [{ val: "porn" }],
      };
      const threadgateAllow = [
        { $type: "app.bsky.feed.threadgate#followingRule" },
      ];
      element._draftPassthrough = { labels, threadgateAllow };

      let receivedDetail = null;
      element.addEventListener("send-post", (e) => {
        receivedDetail = e.detail;
      });

      element.send();
      assert.deepEqual(receivedDetail.post.labels, labels);
      assert.deepEqual(receivedDetail.post.threadgateAllow, threadgateAllow);
      assert.deepEqual(receivedDetail.post.postgateEmbeddingRules, null);
    });

    it("should show loading spinner when sending", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$isSending.set(true);
      await nextFrame();
      const spinner = element.querySelector(".loading-spinner");
      assert(spinner !== null);
    });

    it("should disable post button when sending", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$isSending.set(true);
      await nextFrame();
      const postButton = element.querySelector(".rounded-button-primary");
      assert(postButton.disabled);
    });
  });

  describe("PostComposer - keyboard shortcuts", () => {
    it("should send post on Cmd+Enter", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");

      let receivedDetail = null;
      element.addEventListener("send-post", (e) => {
        receivedDetail = e.detail;
      });

      const dialog = element.querySelector(".post-composer");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
        }),
      );
      assert(receivedDetail !== null);
      assert.deepEqual(receivedDetail.post.postText, "Hello world");
    });

    it("should send post on Ctrl+Enter", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");

      let fired = false;
      element.addEventListener("send-post", () => {
        fired = true;
      });

      const dialog = element.querySelector(".post-composer");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          bubbles: true,
        }),
      );
      assert(fired);
    });

    it("should not send on Cmd+Enter when post text is empty", () => {
      const element = createPostComposer();
      connectElement(element);

      let fired = false;
      element.addEventListener("send-post", () => {
        fired = true;
      });

      const dialog = element.querySelector(".post-composer");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
        }),
      );
      assert(!fired);
    });

    it("should not send on Cmd+Enter when over character limit", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("x".repeat(301));

      let fired = false;
      element.addEventListener("send-post", () => {
        fired = true;
      });

      const dialog = element.querySelector(".post-composer");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
        }),
      );
      assert(!fired);
    });

    it("should not send on Cmd+Enter when already sending", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");
      element.state.$isSending.set(true);

      let count = 0;
      element.addEventListener("send-post", () => {
        count++;
      });

      const dialog = element.querySelector(".post-composer");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
        }),
      );
      assert.deepEqual(count, 0);
    });

    it("should not send on plain Enter", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Hello world");

      let fired = false;
      element.addEventListener("send-post", () => {
        fired = true;
      });

      const dialog = element.querySelector(".post-composer");
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      assert(!fired);
    });
  });

  describe("PostComposer - image selection", () => {
    it("should have file input for images and videos", () => {
      const element = createPostComposer();
      connectElement(element);
      const input = element.querySelector('input[type="file"]');
      assert(input !== null);
      assert.deepEqual(input.accept, "image/*,video/*");
      assert(input.multiple);
    });

    it("should disable image button when 4 images are selected", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$selectedImages.set([
        { file: {}, dataUrl: "data:..." },
        { file: {}, dataUrl: "data:..." },
        { file: {}, dataUrl: "data:..." },
        { file: {}, dataUrl: "data:..." },
      ]);
      await nextFrame();
      const imageButton = element.querySelector(".image-picker-button");
      assert(imageButton.disabled);
    });
  });

  describe("PostComposer - confirmClose", () => {
    it("should return true when post text is empty", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("");
      const result = await element.confirmClose();
      assert.deepEqual(result, true);
    });
  });

  describe("PostComposer - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$postText.set("Test content");

      element.connectedCallback();

      assert.deepEqual(element.state.$postText.get(), "Test content");
    });
  });

  describe("PostComposer - applyComposerInit", () => {
    it("seeds the rich-text-input with text", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();
      element.applyComposerInit({ text: "Hello from a plugin", cursor: null });
      const richTextInput = element.querySelector("rich-text-input");
      assert.deepEqual(richTextInput.text, "Hello from a plugin");
      assert.deepEqual(element.state.$postText.get(), "Hello from a plugin");
    });

    it("does not seed text when text is null", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();
      element.applyComposerInit({ text: null, cursor: null });
      const richTextInput = element.querySelector("rich-text-input");
      assert.deepEqual(richTextInput.text, "");
      assert.deepEqual(element.state.$postText.get(), "");
    });

    it("calls setCursor on the rich-text-input when cursor is set", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();

      const richTextInput = element.querySelector("rich-text-input");
      const calls = [];
      const originalSetCursor = richTextInput.setCursor.bind(richTextInput);
      richTextInput.setCursor = (cursor) => {
        calls.push(cursor);
        originalSetCursor(cursor);
      };

      element.applyComposerInit({ text: "abcdef", cursor: 3 });
      assert.deepEqual(calls, [3]);
    });

    it("does not call setCursor when cursor is null", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();

      const richTextInput = element.querySelector("rich-text-input");
      let cursorCalled = false;
      richTextInput.setCursor = () => {
        cursorCalled = true;
      };

      element.applyComposerInit({ text: "abcdef", cursor: null });
      assert(!cursorCalled);
    });

    it("allows setting only cursor without text", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();

      const richTextInput = element.querySelector("rich-text-input");
      const calls = [];
      richTextInput.setCursor = (cursor) => calls.push(cursor);
      let setTextCalled = false;
      richTextInput.setText = () => {
        setTextCalled = true;
      };

      element.applyComposerInit({ text: null, cursor: 0 });
      assert(!setTextCalled);
      assert.deepEqual(calls, [0]);
    });

    it("does not overwrite user edits made before the init arrives", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();

      const richTextInput = element.querySelector("rich-text-input");
      richTextInput.setText("User typed this");
      element.applyComposerInit({ text: "Plugin text", cursor: null });
      assert.deepEqual(richTextInput.text, "User typed this");
    });
  });

  function makeImageFile(name = "pasted.png") {
    return new globalThis.window.File(["png-bytes"], name, {
      type: "image/png",
    });
  }

  function makeVideoFile(name = "clip.mp4") {
    return new globalThis.window.File(["mp4-bytes"], name, {
      type: "video/mp4",
    });
  }

  function makePasteEvent(files) {
    let prevented = false;
    return {
      clipboardData: { files, items: [] },
      preventDefault: () => {
        prevented = true;
      },
      get defaultPrevented() {
        return prevented;
      },
    };
  }

  describe("PostComposer - paste media", () => {
    it("adds pasted image files to selected images", async () => {
      const element = createPostComposer();
      connectElement(element);
      const event = makePasteEvent([makeImageFile()]);
      element.handlePaste(event);
      await waitFor(() => element.state.$selectedImages.get().length === 1);
      const selectedImages = element.state.$selectedImages.get();
      assert(selectedImages[0].dataUrl.startsWith("data:image/png"));
      assert(event.defaultPrevented);
    });

    it("adds multiple pasted images up to the 4-image cap", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$selectedImages.set([
        { file: {}, dataUrl: "data:..." },
        { file: {}, dataUrl: "data:..." },
        { file: {}, dataUrl: "data:..." },
      ]);
      const event = makePasteEvent([
        makeImageFile("a.png"),
        makeImageFile("b.png"),
        makeImageFile("c.png"),
      ]);
      element.handlePaste(event);
      await waitFor(() => element.state.$selectedImages.get().length === 4);
    });

    it("does not add pasted images when a video is already selected", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.state.$selectedVideo.set({ file: {}, status: "done" });
      const event = makePasteEvent([makeImageFile()]);
      element.handlePaste(event);
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.deepEqual(element.state.$selectedImages.get().length, 0);
      assert(event.defaultPrevented);
    });

    it("ignores pastes with no files (and does not preventDefault)", () => {
      const element = createPostComposer();
      connectElement(element);
      element._unresolvedFacets = [];
      const event = makePasteEvent([]);
      element.handlePaste(event);
      assert(!event.defaultPrevented);
      assert.deepEqual(element.state.$selectedImages.get().length, 0);
    });
  });

  function makeLinkFacet(url) {
    return {
      index: { byteStart: 0, byteEnd: url.length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
    };
  }

  describe("PostComposer - paste links", () => {
    beforeEach(() => {
      globalThis.fetch = () => Promise.resolve({ ok: false });
    });

    afterEach(() => {
      delete globalThis.fetch;
    });

    it("attaches an external link embed immediately when a link is pasted", async () => {
      const element = createPostComposer();
      connectElement(element);
      element._unresolvedFacets = [
        makeLinkFacet("https://example.com/article"),
      ];
      element.handlePaste(makePasteEvent([]));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert.deepEqual(element._externalLinkUrl, "https://example.com/article");
      assert.deepEqual(
        element.state.$externalLinkEmbedData.get().url,
        "https://example.com/article",
      );
    });

    it("does not attach an external link embed for a rejected URL", async () => {
      const element = createPostComposer();
      connectElement(element);
      element._rejectedLinkEmbeds.add("https://example.com/article");
      element._unresolvedFacets = [
        makeLinkFacet("https://example.com/article"),
      ];
      element.handlePaste(makePasteEvent([]));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert.deepEqual(element._externalLinkUrl, null);
      assert.deepEqual(element.state.$externalLinkEmbedData.get(), null);
    });

    it("does not replace an existing external link embed", async () => {
      const element = createPostComposer();
      connectElement(element);
      element._externalLinkUrl = "https://existing.com/page";
      element._unresolvedFacets = [
        makeLinkFacet("https://example.com/article"),
      ];
      element.handlePaste(makePasteEvent([]));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert.deepEqual(element._externalLinkUrl, "https://existing.com/page");
    });

    it("attaches a quote post instead of an external link embed for post links", async () => {
      const element = createPostComposer();
      connectElement(element);
      let loadedQuoteUrl = null;
      element.loadQuotedRecordFromLink = () => {
        loadedQuoteUrl = element._quotedRecordUrl;
      };
      element._unresolvedFacets = [
        makeLinkFacet("https://bsky.app/profile/alice.test/post/3abc"),
      ];
      element.handlePaste(makePasteEvent([]));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert.deepEqual(
        loadedQuoteUrl,
        "https://bsky.app/profile/alice.test/post/3abc",
      );
      assert.deepEqual(element._externalLinkUrl, null);
    });

    it("does not attach a second quote post when one is already attached", async () => {
      const element = createPostComposer();
      connectElement(element);
      let loadCalled = false;
      element.loadQuotedRecordFromLink = () => {
        loadCalled = true;
      };
      element._quotedRecordUrl = "https://bsky.app/profile/bob.test/post/3xyz";
      element._unresolvedFacets = [
        makeLinkFacet("https://bsky.app/profile/alice.test/post/3abc"),
      ];
      element.handlePaste(makePasteEvent([]));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert(!loadCalled);
      assert.deepEqual(
        element._quotedRecordUrl,
        "https://bsky.app/profile/bob.test/post/3xyz",
      );
    });
  });

  describe("PostComposer - record link embeds", () => {
    let element;

    beforeEach(() => {
      globalThis.fetch = () => Promise.resolve({ ok: false });
      element = createPostComposer();
      element.identityResolver = {
        resolveHandle: async () => "did:plc:creator1",
      };
      element.dataLayer = {
        declarative: {
          ensureFeedGenerator: async (uri) => ({
            uri,
            cid: "feedcid",
            displayName: "Cool Feed",
            creator: { did: "did:plc:creator1", handle: "creator1.test" },
          }),
          ensureList: async (uri) => ({
            uri,
            cid: "listcid",
            name: "Cool List",
            creator: { did: "did:plc:creator1", handle: "creator1.test" },
          }),
          ensureStarterPack: async (uri) => ({
            $type: "app.bsky.graph.defs#starterPackView",
            uri,
            cid: "packcid",
            record: { name: "Cool Pack", description: "People to follow" },
            creator: { did: "did:plc:creator1", handle: "creator1.test" },
          }),
          ensurePost: async (uri) => ({
            uri,
            cid: "postcid",
            author: {
              did: "did:plc:creator1",
              handle: "creator1.test",
              displayName: "Creator One",
              avatar: null,
            },
            record: {
              text: "Original post",
              createdAt: "2025-01-01T00:00:00Z",
            },
            indexedAt: "2025-01-01T00:00:00.000Z",
            labels: [],
          }),
        },
      };
      connectElement(element);
    });

    afterEach(() => {
      delete globalThis.fetch;
    });

    function inputLink(url) {
      const facet = makeLinkFacet(url);
      element._unresolvedFacets = [facet];
      element.handleInput({
        detail: { text: `check ${url} `, facets: [facet] },
      });
      // one tick for the record load to resolve, one for the render effect
      return new Promise((resolve) => setTimeout(resolve, 0)).then(nextFrame);
    }

    it("preserves quotedRecord set before connectedCallback and renders its preview", () => {
      const preSeeded = document.createElement("post-composer");
      preSeeded.currentUser = element.currentUser;
      preSeeded.quotedRecord = {
        $type: "app.bsky.feed.defs#generatorView",
        uri: "at://did:plc:creator1/app.bsky.feed.generator/cool-feed",
        cid: "feedcid",
        displayName: "Cool Feed",
        creator: { did: "did:plc:creator1", handle: "creator1.test" },
      };
      connectElement(preSeeded);
      assert.deepEqual(
        preSeeded.quotedRecord.$type,
        "app.bsky.feed.defs#generatorView",
      );
      assert(
        preSeeded.querySelector(
          ".post-composer-embed-preview .feed-generator-embed",
        ) !== null,
      );
    });

    it("attaches a quoted post embed from a pasted post URL", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/post/3abc");
      assert.deepEqual(
        element.quotedRecord.$type,
        "app.bsky.embed.record#viewRecord",
      );
      assert.deepEqual(
        element.quotedRecord.uri,
        "at://did:plc:creator1/app.bsky.feed.post/3abc",
      );
      assert(
        element.querySelector(".post-composer-embed-preview .quoted-post") !==
          null,
      );
    });

    it("resolves DID-form URLs without handle resolution", async () => {
      element.identityResolver = {
        resolveHandle: async () => {
          throw new Error("should not be called");
        },
      };
      await inputLink(
        "https://bsky.app/profile/did:plc:creator1/feed/cool-feed",
      );
      assert.deepEqual(
        element.quotedRecord.uri,
        "at://did:plc:creator1/app.bsky.feed.generator/cool-feed",
      );
    });

    it("attaches a feed generator embed from a pasted feed URL", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/feed/cool-feed");
      assert.deepEqual(
        element.quotedRecord.$type,
        "app.bsky.feed.defs#generatorView",
      );
      assert.deepEqual(
        element.quotedRecord.uri,
        "at://did:plc:creator1/app.bsky.feed.generator/cool-feed",
      );
      assert(
        element.querySelector(
          ".post-composer-embed-preview .feed-generator-embed",
        ) !== null,
      );
      assert.deepEqual(element._externalLinkUrl, null);
    });

    it("attaches a list embed from a pasted list URL", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/lists/cool-list");
      assert.deepEqual(
        element.quotedRecord.$type,
        "app.bsky.graph.defs#listView",
      );
      assert.deepEqual(
        element.quotedRecord.uri,
        "at://did:plc:creator1/app.bsky.graph.list/cool-list",
      );
      assert(
        element.querySelector(".post-composer-embed-preview .list-embed") !==
          null,
      );
    });

    it("attaches a starter pack embed from a bsky.app starter-pack URL", async () => {
      await inputLink("https://bsky.app/starter-pack/creator1.test/cool-pack");
      assert.deepEqual(
        element.quotedRecord.$type,
        "app.bsky.graph.defs#starterPackViewBasic",
      );
      assert.deepEqual(
        element.quotedRecord.uri,
        "at://did:plc:creator1/app.bsky.graph.starterpack/cool-pack",
      );
      assert(
        element.querySelector(
          ".post-composer-embed-preview .starter-pack-embed",
        ) !== null,
      );
    });

    it("attaches a starter pack embed from a profile starter-pack URL", async () => {
      await inputLink(
        "https://bsky.app/profile/creator1.test/starter-pack/cool-pack",
      );
      assert.deepEqual(
        element.quotedRecord.$type,
        "app.bsky.graph.defs#starterPackViewBasic",
      );
    });

    it("treats unrecognized in-app URLs as external links", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/follows");
      assert.deepEqual(element.quotedRecord, null);
      assert.deepEqual(
        element._externalLinkUrl,
        "https://bsky.app/profile/creator1.test/follows",
      );
    });

    it("does not attach a second record embed when one is attached", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/feed/cool-feed");
      await inputLink("https://bsky.app/profile/creator1.test/lists/cool-list");
      assert.deepEqual(
        element.quotedRecord.$type,
        "app.bsky.feed.defs#generatorView",
      );
      assert.deepEqual(
        element._quotedRecordUrl,
        "https://bsky.app/profile/creator1.test/feed/cool-feed",
      );
    });

    it("does not start a second record load while one is pending", async () => {
      let feedLoadCount = 0;
      let listLoadCount = 0;
      element.dataLayer.declarative.ensureFeedGenerator = () => {
        feedLoadCount++;
        return new Promise(() => {});
      };
      element.dataLayer.declarative.ensureList = () => {
        listLoadCount++;
        return new Promise(() => {});
      };
      await inputLink("https://bsky.app/profile/creator1.test/feed/cool-feed");
      await inputLink("https://bsky.app/profile/creator1.test/lists/cool-list");
      assert.deepEqual(feedLoadCount, 1);
      assert.deepEqual(listLoadCount, 0);
      assert.deepEqual(
        element._quotedRecordUrl,
        "https://bsky.app/profile/creator1.test/feed/cool-feed",
      );
      assert.deepEqual(element.quotedRecord, null);
    });

    it("ignores a record load that resolves after the embed was cleared", async () => {
      let resolveLoad = null;
      element.dataLayer.declarative.ensureFeedGenerator = () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        });
      await inputLink("https://bsky.app/profile/creator1.test/feed/cool-feed");
      element.handleQuotedEmbedPreviewClose();
      resolveLoad({
        uri: "at://did:plc:creator1/app.bsky.feed.generator/cool-feed",
        cid: "feedcid",
        displayName: "Cool Feed",
        creator: { did: "did:plc:creator1", handle: "creator1.test" },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(element.quotedRecord, null);
      assert.deepEqual(
        element.querySelector(".post-composer-embed-preview"),
        null,
      );
    });

    it("rejects the URL when the record fails to load", async () => {
      const originalError = console.error;
      console.error = () => {};
      try {
        element.dataLayer.declarative.ensureFeedGenerator = async () => {
          throw new Error("not found");
        };
        const url = "https://bsky.app/profile/creator1.test/feed/cool-feed";
        await inputLink(url);
        assert.deepEqual(element.quotedRecord, null);
        assert.deepEqual(element._quotedRecordUrl, null);
        assert(element._rejectedLinkEmbeds.has(url));
      } finally {
        console.error = originalError;
      }
    });

    it("clears the record embed when the preview is closed", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/feed/cool-feed");
      element.handleQuotedEmbedPreviewClose();
      await nextFrame();
      assert.deepEqual(element.quotedRecord, null);
      assert.deepEqual(element._quotedRecordUrl, null);
      assert.deepEqual(
        element.querySelector(".post-composer-embed-preview"),
        null,
      );
    });

    it("sends the record embed as quotedRecord", async () => {
      await inputLink("https://bsky.app/profile/creator1.test/feed/cool-feed");
      element.state.$postText.set("check this feed");
      let receivedDetail = null;
      element.addEventListener("send-post", (e) => {
        receivedDetail = e.detail;
      });
      element.send();
      assert.deepEqual(receivedDetail.post.quotedRecord, element.quotedRecord);
    });

    it("attaches a record embed instead of an external link when pasted", async () => {
      let loadedRecordUrl = null;
      element.loadQuotedRecordFromLink = () => {
        loadedRecordUrl = element._quotedRecordUrl;
      };
      element._unresolvedFacets = [
        makeLinkFacet("https://bsky.app/profile/creator1.test/feed/cool-feed"),
      ];
      element.handlePaste(makePasteEvent([]));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert.deepEqual(
        loadedRecordUrl,
        "https://bsky.app/profile/creator1.test/feed/cool-feed",
      );
      assert.deepEqual(element._externalLinkUrl, null);
    });
  });

  describe("PostComposer - drafts", () => {
    afterEach(() => {
      delete globalThis.__testChoice;
      delete globalThis.__testConfirmation;
    });

    it("renders the Drafts button for new posts", () => {
      const element = createPostComposer();
      connectElement(element);
      assert(
        element.querySelector('[data-testid="composer-drafts-button"]') !==
          null,
      );
    });

    it("does not render the Drafts button when drafts are disabled", () => {
      const element = createPostComposer({ draftsEnabled: false });
      connectElement(element);
      assert.deepEqual(
        element.querySelector('[data-testid="composer-drafts-button"]'),
        null,
      );
    });

    it("shows the Drafts button when draftsEnabled is set after connect", async () => {
      const element = createPostComposer({ draftsEnabled: false });
      connectElement(element);
      assert.deepEqual(
        element.querySelector('[data-testid="composer-drafts-button"]'),
        null,
      );
      element.draftsEnabled = true;
      await nextFrame();
      assert(
        element.querySelector('[data-testid="composer-drafts-button"]') !==
          null,
      );
    });

    it("prompts a plain discard confirm instead of the save choice when drafts are disabled", async () => {
      const element = createPostComposer({ draftsEnabled: false });
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      let confirmationSeen = false;
      globalThis.__testConfirmation = (resolve) => {
        confirmationSeen = true;
        resolve(true);
      };
      globalThis.__testChoice = () => {
        throw new Error(
          "choice prompt should not be shown when drafts are disabled",
        );
      };
      const result = await element.confirmClose();
      assert.deepEqual(result, true);
      assert(confirmationSeen);
    });

    it("stays open when the discard confirm is declined with drafts disabled", async () => {
      const element = createPostComposer({ draftsEnabled: false });
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      globalThis.__testConfirmation = (resolve) => resolve(false);
      const result = await element.confirmClose();
      assert.deepEqual(result, false);
    });

    it("does not render the Drafts button for replies", () => {
      const element = createPostComposer();
      element.replyTo = {
        author: { handle: "user.bsky.social", displayName: "User" },
        record: { text: "Original post", createdAt: new Date().toISOString() },
        indexedAt: new Date().toISOString(),
      };
      connectElement(element);
      assert.deepEqual(
        element.querySelector('[data-testid="composer-drafts-button"]'),
        null,
      );
    });

    it("starts clean and marks dirty on input", () => {
      const element = createPostComposer();
      connectElement(element);
      assert.deepEqual(element._isDirty, false);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      assert.deepEqual(element._isDirty, true);
    });

    it("markSaved records the draft id and key set", () => {
      const element = createPostComposer();
      connectElement(element);
      element.markSaved("draft-1", ["image:a"]);
      assert.deepEqual(element._draftId, "draft-1");
      assert.deepEqual([...element._originalLocalRefs], ["image:a"]);
    });

    it("closes without a prompt when a loaded draft is unmodified", async () => {
      const element = createPostComposer();
      element.dataLayer = {
        mutations: {
          createDraft: async () => "draft-1",
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      assert.deepEqual(await element.saveDraft(), true);
      const result = await element.confirmClose();
      assert.deepEqual(result, true);
    });

    it("prompts with the save choice when there is unsaved content", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      globalThis.__testChoice = (resolve) => resolve("keep");
      const result = await element.confirmClose();
      assert.deepEqual(result, false);
    });

    it("closes when the prompt choice is discard", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      globalThis.__testChoice = (resolve) => resolve("discard");
      const result = await element.confirmClose();
      assert.deepEqual(result, true);
    });

    it("saves and closes when the prompt choice is save", async () => {
      const element = createPostComposer();
      let savedArgs = null;
      element.dataLayer = {
        mutations: {
          createDraft: async (args) => {
            savedArgs = args;
            return "draft-9";
          },
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      globalThis.__testChoice = (resolve) => resolve("save");
      const result = await element.confirmClose();
      assert.deepEqual(result, true);
      assert.deepEqual(savedArgs.draft.posts[0].text, "hello");
      assert.deepEqual(element._draftId, "draft-9");
      assert.deepEqual(element._isDirty, false);
    });

    it("offers only discard when the text is over the draft limit", async () => {
      const element = createPostComposer();
      connectElement(element);
      element.handleInput({
        detail: { text: "x".repeat(1001), facets: [] },
      });
      let confirmationSeen = false;
      globalThis.__testConfirmation = (resolve) => {
        confirmationSeen = true;
        resolve(true);
      };
      globalThis.__testChoice = () => {
        throw new Error("choice prompt should not be shown over the limit");
      };
      const result = await element.confirmClose();
      assert.deepEqual(result, true);
      assert(confirmationSeen);
    });

    it("saveDraft updates in place when a draft id is set", async () => {
      const element = createPostComposer();
      let savedArgs = null;
      element.dataLayer = {
        mutations: {
          createDraft: async () => {
            throw new Error("createDraft should not be called for an update");
          },
          updateDraft: async (args) => {
            savedArgs = args;
          },
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "edited", facets: [] } });
      element._draftId = "draft-1";
      element._originalLocalRefs = new Set(["image:old"]);
      const result = await element.saveDraft();
      assert.deepEqual(result, true);
      assert.deepEqual(savedArgs.draftId, "draft-1");
      assert.deepEqual(savedArgs.pruneLocalRefs, ["image:old"]);
      assert.deepEqual([...element._originalLocalRefs], []);
    });

    it("saveDraft allows text at exactly 1000 graphemes", async () => {
      const element = createPostComposer();
      element.dataLayer = {
        mutations: {
          createDraft: async () => "draft-1",
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "x".repeat(1000), facets: [] } });
      assert.deepEqual(await element.saveDraft(), true);
    });

    it("saveDraft surfaces the specific draft-limit error copy", async () => {
      const originalError = console.error;
      console.error = () => {};
      try {
        document.querySelectorAll(".toast").forEach((toast) => toast.remove());
        const element = createPostComposer();
        element.dataLayer = {
          mutations: {
            createDraft: async () => {
              throw new ApiError({
                status: 400,
                statusText: "Bad Request",
                data: { error: "DraftLimitReached" },
                headers: {},
                url: "",
              });
            },
          },
        };
        connectElement(element);
        element.handleInput({ detail: { text: "hello", facets: [] } });
        assert.deepEqual(await element.saveDraft(), false);
        await waitFor(() =>
          [...document.querySelectorAll(".toast")].some((toast) =>
            toast.textContent.includes("maximum number of drafts"),
          ),
        );
      } finally {
        console.error = originalError;
      }
    });

    it("saveDraft refuses over-limit text without calling the mutation", async () => {
      const element = createPostComposer();
      let called = false;
      element.dataLayer = {
        mutations: {
          createDraft: async () => {
            called = true;
          },
        },
      };
      connectElement(element);
      element.handleInput({
        detail: { text: "x".repeat(1001), facets: [] },
      });
      const result = await element.saveDraft();
      assert.deepEqual(result, false);
      assert(!called);
    });

    it("saveDraft surfaces failure and stays dirty", async () => {
      const originalError = console.error;
      console.error = () => {};
      try {
        const element = createPostComposer();
        element.dataLayer = {
          mutations: {
            createDraft: async () => {
              throw new Error("boom");
            },
          },
        };
        connectElement(element);
        element.handleInput({ detail: { text: "hello", facets: [] } });
        const result = await element.saveDraft();
        assert.deepEqual(result, false);
        assert.deepEqual(element._draftId, null);
        assert.deepEqual(element._isDirty, true);
      } finally {
        console.error = originalError;
      }
    });

    it("saveDraft writes minted image keys back onto composer state", async () => {
      const element = createPostComposer();
      element.dataLayer = {
        mutations: {
          createDraft: async () => "draft-1",
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "with image", facets: [] } });
      element.state.$selectedImages.set([{ file: {}, dataUrl: "data:a" }]);
      const result = await element.saveDraft();
      assert.deepEqual(result, true);
      const image = element.state.$selectedImages.get()[0];
      assert(image.localRefPath.startsWith("image:"));
    });

    it("stays dirty when edits land while a save is in flight", async () => {
      const element = createPostComposer();
      let resolveCreate;
      element.dataLayer = {
        mutations: {
          createDraft: () =>
            new Promise((resolve) => {
              resolveCreate = resolve;
            }),
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      const savePromise = element.saveDraft();
      element.handleInput({ detail: { text: "hello edited", facets: [] } });
      resolveCreate("draft-1");
      assert.deepEqual(await savePromise, true);
      assert.deepEqual(element._draftId, "draft-1");
      assert.deepEqual(element._isDirty, true);
    });

    it("does not misassign minted keys to images added during a save", async () => {
      const element = createPostComposer();
      let resolveCreate;
      element.dataLayer = {
        mutations: {
          createDraft: () =>
            new Promise((resolve) => {
              resolveCreate = resolve;
            }),
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "with image", facets: [] } });
      const originalImage = { file: {}, dataUrl: "data:a" };
      element.state.$selectedImages.set([originalImage]);
      const savePromise = element.saveDraft();
      const addedImage = { file: {}, dataUrl: "data:b" };
      element.state.$selectedImages.set([addedImage, originalImage]);
      resolveCreate("draft-1");
      assert.deepEqual(await savePromise, true);
      const [first, second] = element.state.$selectedImages.get();
      assert.deepEqual(first.localRefPath, undefined);
      assert(second.localRefPath.startsWith("image:"));
    });

    it("treats content as a new post after the loaded draft is deleted", async () => {
      const element = createPostComposer();
      let created = false;
      element.dataLayer = {
        mutations: {
          createDraft: async () => {
            created = true;
            return "draft-2";
          },
          updateDraft: async () => {
            throw new Error("updateDraft should not be called after deletion");
          },
        },
      };
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      element.markSaved("draft-1", ["image:a"]);
      element._isDirty = false;
      element.handleDraftDeleted("draft-1");
      assert.deepEqual(element._draftId, null);
      assert.deepEqual(element._originalLocalRefs, null);
      assert.deepEqual(element._isDirty, true);
      assert.deepEqual(await element.saveDraft(), true);
      assert(created);
      assert.deepEqual(element._draftId, "draft-2");
    });

    it("ignores deletions of drafts other than the loaded one", () => {
      const element = createPostComposer();
      connectElement(element);
      element.markSaved("draft-1", ["image:a"]);
      element.handleDraftDeleted("draft-2");
      assert.deepEqual(element._draftId, "draft-1");
      assert.deepEqual([...element._originalLocalRefs], ["image:a"]);
    });

    it("clearComposer resets content and draft state", () => {
      const element = createPostComposer();
      connectElement(element);
      element.open();
      element.handleInput({ detail: { text: "hello", facets: [] } });
      element.state.$selectedImages.set([{ file: {}, dataUrl: "data:a" }]);
      element.markSaved("draft-1", ["image:a"]);
      element.clearComposer();
      assert.deepEqual(element.state.$postText.get(), "");
      assert.deepEqual(element.state.$selectedImages.get(), []);
      assert.deepEqual(element._draftId, null);
      assert.deepEqual(element._originalLocalRefs, null);
      assert.deepEqual(element._isDirty, false);
      assert.deepEqual(element.querySelector("rich-text-input").text, "");
    });

    it("restoreFromDraft seeds text, external link, and quote, and ends clean", async () => {
      globalThis.fetch = () => Promise.resolve({ ok: false });
      try {
        const element = createPostComposer();
        element.dataLayer = {
          declarative: {
            ensurePost: async (uri) => ({
              uri,
              cid: "postcid",
              author: {
                did: "did:plc:creator1",
                handle: "creator1.test",
                displayName: "Creator One",
                avatar: null,
              },
              record: { text: "Quoted", createdAt: "2025-01-01T00:00:00Z" },
              indexedAt: "2025-01-01T00:00:00.000Z",
              labels: [],
            }),
          },
        };
        connectElement(element);
        element.open();
        const draftView = {
          id: "draft-1",
          draft: {
            deviceId: "another-device",
            deviceName: "Web",
            posts: [
              {
                text: "restored text",
                embedExternals: [{ uri: "https://example.com/article" }],
                embedRecords: [
                  {
                    record: {
                      uri: "at://did:plc:creator1/app.bsky.feed.post/3abc",
                      cid: "postcid",
                    },
                  },
                ],
              },
            ],
          },
        };
        await element.restoreFromDraft(draftView);
        assert.deepEqual(element.state.$postText.get(), "restored text");
        assert.deepEqual(
          element.querySelector("rich-text-input").text,
          "restored text",
        );
        assert.deepEqual(
          element.state.$externalLinkEmbedData.get().url,
          "https://example.com/article",
        );
        assert.deepEqual(
          element.quotedRecord.uri,
          "at://did:plc:creator1/app.bsky.feed.post/3abc",
        );
        assert.deepEqual(element._draftId, "draft-1");
        assert.deepEqual(element._isDirty, false);
      } finally {
        delete globalThis.fetch;
      }
    });

    it("re-saving a draft restored from another device keeps its media embeds", async () => {
      const element = createPostComposer();
      let savedArgs = null;
      element.dataLayer = {
        mutations: {
          updateDraft: async (args) => {
            savedArgs = args;
          },
        },
      };
      connectElement(element);
      const galleryItems = [
        {
          $type: "app.bsky.draft.defs#draftEmbedImage",
          alt: "an image",
          localRef: {
            $type: "app.bsky.draft.defs#draftEmbedLocalRef",
            path: "image:foreign",
          },
        },
      ];
      const videoEmbed = {
        $type: "app.bsky.draft.defs#draftEmbedVideo",
        localRef: {
          $type: "app.bsky.draft.defs#draftEmbedLocalRef",
          path: "video:video/mp4:foreign.mp4",
        },
      };
      await element.restoreFromDraft({
        id: "draft-1",
        draft: {
          deviceId: "another-device",
          deviceName: "Web",
          posts: [
            {
              text: "foreign media",
              embedGallery: {
                $type: "app.bsky.draft.defs#draftEmbedGallery",
                items: galleryItems,
              },
              embedVideos: [videoEmbed],
            },
          ],
        },
      });
      element.handleInput({
        detail: { text: "foreign media edited", facets: [] },
      });
      assert.deepEqual(await element.saveDraft(), true);
      assert.deepEqual(
        savedArgs.draft.posts[0].embedGallery.items,
        galleryItems,
      );
      assert.deepEqual(savedArgs.draft.posts[0].embedVideos, [videoEmbed]);
      assert.deepEqual(savedArgs.pruneLocalRefs, []);
    });

    it("re-saving keeps the video embed when its local bytes are missing", async () => {
      const element = createPostComposer();
      let savedArgs = null;
      element.dataLayer = {
        mutations: {
          updateDraft: async (args) => {
            savedArgs = args;
          },
        },
        draftMediaStore: {
          readBlob: async () => null,
        },
      };
      connectElement(element);
      const videoEmbed = {
        $type: "app.bsky.draft.defs#draftEmbedVideo",
        localRef: {
          $type: "app.bsky.draft.defs#draftEmbedLocalRef",
          path: "video:video/mp4:evicted.mp4",
        },
      };
      await element.restoreFromDraft({
        id: "draft-1",
        draft: {
          deviceId: getDraftDeviceId(),
          deviceName: "Web",
          posts: [{ text: "video draft", embedVideos: [videoEmbed] }],
        },
      });
      element.handleInput({
        detail: { text: "video draft edited", facets: [] },
      });
      assert.deepEqual(await element.saveDraft(), true);
      assert.deepEqual(savedArgs.draft.posts[0].embedVideos, [videoEmbed]);
      assert.deepEqual(savedArgs.pruneLocalRefs, []);
    });

    it("composer media replaces unrestored media on save", async () => {
      const element = createPostComposer();
      let savedArgs = null;
      element.dataLayer = {
        mutations: {
          updateDraft: async (args) => {
            savedArgs = args;
          },
        },
      };
      connectElement(element);
      await element.restoreFromDraft({
        id: "draft-1",
        draft: {
          deviceId: "another-device",
          deviceName: "Web",
          posts: [
            {
              text: "foreign media",
              embedGallery: {
                $type: "app.bsky.draft.defs#draftEmbedGallery",
                items: [
                  {
                    $type: "app.bsky.draft.defs#draftEmbedImage",
                    localRef: {
                      $type: "app.bsky.draft.defs#draftEmbedLocalRef",
                      path: "image:foreign",
                    },
                  },
                ],
              },
            },
          ],
        },
      });
      element.state.$selectedImages.set([{ file: {}, dataUrl: "data:new" }]);
      assert.deepEqual(await element.saveDraft(), true);
      const items = savedArgs.draft.posts[0].embedGallery.items;
      assert.deepEqual(items.length, 1);
      assert(items[0].localRef.path !== "image:foreign");
      assert.deepEqual(savedArgs.pruneLocalRefs, ["image:foreign"]);
    });

    it("send includes the draft id and local refs for publish cleanup", () => {
      const element = createPostComposer();
      connectElement(element);
      element.handleInput({ detail: { text: "hello", facets: [] } });
      element.markSaved("draft-1", ["image:a"]);
      let receivedDetail = null;
      element.addEventListener("send-post", (e) => {
        receivedDetail = e.detail;
      });
      element.send();
      assert.deepEqual(receivedDetail.draft, {
        draftId: "draft-1",
        localRefs: ["image:a"],
      });
    });
  });

  describe("PostComposer - addMediaFiles", () => {
    it("routes image files to addImageFiles", async () => {
      const element = createPostComposer();
      connectElement(element);
      await element.addMediaFiles([makeImageFile()]);
      assert.deepEqual(element.state.$selectedImages.get().length, 1);
    });

    it("rejects mixed image and video files", async () => {
      const element = createPostComposer();
      connectElement(element);
      await element.addMediaFiles([makeImageFile(), makeVideoFile()]);
      assert.deepEqual(element.state.$selectedImages.get().length, 0);
      assert.deepEqual(element.state.$selectedVideo.get(), null);
    });

    it("rejects unsupported file types without adding anything", async () => {
      const element = createPostComposer();
      connectElement(element);
      await element.addMediaFiles([
        makeImageFile(),
        { name: "note.txt", type: "text/plain" },
      ]);
      assert.deepEqual(element.state.$selectedImages.get().length, 0);
    });

    it("returns early on empty input", async () => {
      const element = createPostComposer();
      connectElement(element);
      await element.addMediaFiles([]);
      assert.deepEqual(element.state.$selectedImages.get().length, 0);
      assert.deepEqual(element.state.$selectedVideo.get(), null);
    });
  });
});
