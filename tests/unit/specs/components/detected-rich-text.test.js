import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/detected-rich-text.js";

describe("detected-rich-text", () => {
  function makeIdentityResolver(handleToDid = {}) {
    return {
      resolveHandle: mock.fn(async (handle) => {
        if (handle in handleToDid) return handleToDid[handle];
        throw new Error(`Unknown handle: ${handle}`);
      }),
    };
  }

  async function flushMicrotasks() {
    // Two ticks: the first flushes microtasks (e.g. getFacetsFromText), the
    // second lets the rAF-scheduled effect re-render before assertions.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("DetectedRichText - rendering", () => {
    it("renders plain text from the text attribute", () => {
      const element = document.createElement("detected-rich-text");
      element.setAttribute("text", "Hello world");
      document.body.appendChild(element);
      const richText = element.querySelector("[data-testid='rich-text']");
      assert(richText !== null);
      assert(richText.textContent.includes("Hello world"));
    });

    it("renders nothing meaningful when text is empty", () => {
      const element = document.createElement("detected-rich-text");
      document.body.appendChild(element);
      const richText = element.querySelector("[data-testid='rich-text']");
      assert(richText !== null);
      assert.deepEqual(richText.textContent.trim(), "");
    });

    it("updates rendered text when the text attribute changes", async () => {
      const element = document.createElement("detected-rich-text");
      element.setAttribute("text", "first");
      document.body.appendChild(element);
      assert(element.textContent.includes("first"));
      element.setAttribute("text", "second");
      await flushMicrotasks();
      assert(element.textContent.includes("second"));
      assert(!element.textContent.includes("first"));
    });
  });

  describe("DetectedRichText - facet detection", () => {
    it("detects link facets and renders them as anchors", async () => {
      const element = document.createElement("detected-rich-text");
      element.identityResolver = makeIdentityResolver();
      element.setAttribute("text", "Visit example.com today");
      document.body.appendChild(element);
      await flushMicrotasks();
      const link = element.querySelector("a");
      assert(link !== null);
      assert(link.getAttribute("href").startsWith("https://example.com"));
    });

    it("detects hashtag facets and renders them as anchors", async () => {
      const element = document.createElement("detected-rich-text");
      element.identityResolver = makeIdentityResolver();
      element.setAttribute("text", "Loving #bluesky right now");
      document.body.appendChild(element);
      await flushMicrotasks();
      const link = element.querySelector("a");
      assert(link !== null);
      assert(link.textContent.includes("#bluesky"));
    });

    it("resolves mention handles via identityResolver", async () => {
      const resolver = makeIdentityResolver({
        "alice.com": "did:plc:alice",
      });
      const element = document.createElement("detected-rich-text");
      element.identityResolver = resolver;
      element.setAttribute("text", "Hi @alice.com welcome");
      document.body.appendChild(element);
      await flushMicrotasks();
      assert.deepEqual(resolver.resolveHandle.mock.callCount(), 1);
      assert.deepEqual(
        resolver.resolveHandle.mock.calls[0].arguments[0],
        "alice.com",
      );
      const link = element.querySelector("a");
      assert(link !== null);
      assert(link.getAttribute("href").includes("did:plc:alice"));
    });

    it("does not call resolveHandle when there are no mentions", async () => {
      const resolver = makeIdentityResolver();
      const element = document.createElement("detected-rich-text");
      element.identityResolver = resolver;
      element.setAttribute("text", "Just plain text here");
      document.body.appendChild(element);
      await flushMicrotasks();
      assert.deepEqual(resolver.resolveHandle.mock.callCount(), 0);
    });

    it("does not attempt to resolve facets without an identityResolver", async () => {
      const element = document.createElement("detected-rich-text");
      element.setAttribute("text", "Hi @alice.com welcome");
      document.body.appendChild(element);
      await flushMicrotasks();
      // No identity resolver set, so mention stays as plain text (no anchor).
      assert(element.querySelector("a") === null);
      assert(element.textContent.includes("@alice.com"));
    });

    it("re-resolves facets when the text attribute changes", async () => {
      const resolver = makeIdentityResolver({
        "alice.com": "did:plc:alice",
        "bob.com": "did:plc:bob",
      });
      const element = document.createElement("detected-rich-text");
      element.identityResolver = resolver;
      element.setAttribute("text", "Hi @alice.com");
      document.body.appendChild(element);
      await flushMicrotasks();
      assert.deepEqual(resolver.resolveHandle.mock.callCount(), 1);
      element.setAttribute("text", "Hi @bob.com");
      await flushMicrotasks();
      assert.deepEqual(resolver.resolveHandle.mock.callCount(), 2);
      assert.deepEqual(
        resolver.resolveHandle.mock.calls[1].arguments[0],
        "bob.com",
      );
      const link = element.querySelector("a");
      assert(link !== null);
      assert(link.getAttribute("href").includes("did:plc:bob"));
    });

    it("ignores stale resolution when text changes mid-flight", async () => {
      let resolveSlow;
      const resolver = {
        resolveHandle: mock.fn((handle) => {
          if (handle === "slow.com") {
            return new Promise((resolve) => {
              resolveSlow = () => resolve("did:plc:slow");
            });
          }
          return Promise.resolve("did:plc:fast");
        }),
      };
      const element = document.createElement("detected-rich-text");
      element.identityResolver = resolver;
      element.setAttribute("text", "Hi @slow.com");
      document.body.appendChild(element);
      await flushMicrotasks();
      // Swap text before slow resolution completes.
      element.setAttribute("text", "Hi @fast.com");
      await flushMicrotasks();
      // Now let the stale promise resolve — the component should ignore it.
      resolveSlow();
      await flushMicrotasks();
      const link = element.querySelector("a");
      assert(link !== null);
      assert(link.getAttribute("href").includes("did:plc:fast"));
      assert(!link.getAttribute("href").includes("did:plc:slow"));
    });
  });

  describe("DetectedRichText - truncate-urls attribute", () => {
    it("does not truncate displayed URL text without truncate-urls", async () => {
      const element = document.createElement("detected-rich-text");
      element.identityResolver = makeIdentityResolver();
      element.setAttribute(
        "text",
        "See https://example.com/very/long/path/to/page",
      );
      document.body.appendChild(element);
      await flushMicrotasks();
      const link = element.querySelector("a");
      assert(link !== null);
      assert.deepEqual(
        link.textContent,
        "https://example.com/very/long/path/to/page",
      );
    });

    it("truncates displayed URL text when truncate-urls is set", async () => {
      const element = document.createElement("detected-rich-text");
      element.identityResolver = makeIdentityResolver();
      element.toggleAttribute("truncate-urls", true);
      element.setAttribute(
        "text",
        "See https://example.com/very/long/path/to/page",
      );
      document.body.appendChild(element);
      await flushMicrotasks();
      const link = element.querySelector("a");
      assert(link !== null);
      assert(link.textContent.endsWith("..."));
      assert(link.textContent.length < link.getAttribute("href").length);
    });

    it("reacts to truncate-urls being toggled after mount", async () => {
      const element = document.createElement("detected-rich-text");
      element.identityResolver = makeIdentityResolver();
      element.setAttribute(
        "text",
        "See https://example.com/very/long/path/to/page",
      );
      document.body.appendChild(element);
      await flushMicrotasks();
      let link = element.querySelector("a");
      assert.deepEqual(
        link.textContent,
        "https://example.com/very/long/path/to/page",
      );
      element.toggleAttribute("truncate-urls", true);
      await flushMicrotasks();
      link = element.querySelector("a");
      assert(link.textContent.endsWith("..."));
    });
  });

  describe("DetectedRichText - lifecycle", () => {
    it("cleans up effects on disconnect", async () => {
      const element = document.createElement("detected-rich-text");
      element.identityResolver = makeIdentityResolver();
      element.setAttribute("text", "Hello world");
      document.body.appendChild(element);
      await flushMicrotasks();
      assert(element.initialized);
      element.remove();
      assert(!element.initialized);
      assert.deepEqual(element.disposeRender, null);
      assert.deepEqual(element.disposeResolve, null);
    });
  });
});
