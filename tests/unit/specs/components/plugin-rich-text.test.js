import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Signal } from "/js/signals.js";
import "/js/components/plugin-rich-text.js";

describe("plugin-rich-text", () => {
  const originalSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });
  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  async function flushEffects() {
    // Two ticks: signal changes re-run effects via rAF, which the test env
    // pins to setTimeout.
    await new Promise((resolve) => originalSetTimeout(resolve, 0));
    await new Promise((resolve) => originalSetTimeout(resolve, 0));
  }

  // Stand-in for the pipeline's async API. The element reads
  // $richTextTransformsVersion inside its render effect, so bumping it
  // re-fires the effect.
  function makePluginService({
    result = null,
    claimedFacetTypes = new Set(),
  } = {}) {
    return {
      $richTextTransformsVersion: new Signal.State(0),
      calls: [],
      result,
      claimedFacetTypes,
      getClaimedFacetTypes() {
        return this.claimedFacetTypes;
      },
      async transformRichTextTokens(tokens, context) {
        this.calls.push({ tokens, context });
        return this.result;
      },
      renderRichTextNodeToken(token) {
        const element = document.createElement(token.node.tag);
        element.textContent = token.node.text ?? "";
        return element;
      },
    };
  }

  function makeTransformContext(overrides = {}) {
    return {
      surface: "largePost",
      uri: "at://did:test/app.bsky.feed.post/1",
      did: "did:test",
      ...overrides,
    };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function mount({
    text = "hello",
    facets = [],
    transformContext = makeTransformContext(),
    truncateUrls = false,
    pluginService = makePluginService(),
  } = {}) {
    const element = document.createElement("plugin-rich-text");
    element.pluginService = pluginService;
    element.text = text;
    element.facets = facets;
    element.transformContext = transformContext;
    if (truncateUrls) element.setAttribute("truncate-urls", "");
    document.body.appendChild(element);
    return element;
  }

  it("requires a pluginService to initialize", () => {
    const element = document.createElement("plugin-rich-text");
    element.text = "hello";
    assert.throws(
      () => element.connectedCallback(),
      /pluginService is required/,
    );
  });

  it("renders base rich text", () => {
    const element = mount();
    const richText = element.querySelector("[data-testid='rich-text']");
    assert(richText !== null);
    assert.deepEqual(richText.textContent, "hello");
  });

  it("truncates facet URLs when the truncate-urls attribute is set", () => {
    const url = "https://example.com/very/long/path/to/page";
    const text = "See " + url;
    const facets = [
      {
        index: { byteStart: 4, byteEnd: 4 + url.length },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
      },
    ];
    const element = mount({ text, facets, truncateUrls: true });
    const link = element.querySelector("a");
    assert(link !== null);
    assert(link.textContent.endsWith("..."));
    assert(link.textContent.length < url.length);
  });

  it("passes base tokens and a context carrying the original source", () => {
    const pluginService = makePluginService();
    const facets = [];
    mount({ pluginService, facets });
    assert.deepEqual(pluginService.calls.length, 1);
    const call = pluginService.calls[0];
    assert.deepEqual(call.tokens, [{ type: "text", value: "hello" }]);
    assert.deepEqual(call.context.surface, "largePost");
    assert.deepEqual(call.context.numberOfLines, null);
    assert(call.context.source.text === "hello");
    assert(call.context.source.facets === facets);
  });

  it("skips the pipeline without a transformContext", async () => {
    const pluginService = makePluginService({
      result: [{ type: "text", value: "SHOULD NOT RENDER" }],
    });
    const element = mount({ pluginService, transformContext: null });
    await flushEffects();
    assert.deepEqual(pluginService.calls.length, 0);
    const richText = element.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, "hello");
  });

  it("patches in the transformed tokens when the request resolves", async () => {
    const pluginService = makePluginService({
      result: [
        { type: "text", value: "use " },
        {
          type: "inline",
          pluginId: "p1",
          node: { tag: "code", text: "npm i" },
        },
      ],
    });
    const element = mount({ pluginService });
    // Base tokens render synchronously; the transform patches in async.
    assert.deepEqual(element.querySelector("code"), null);
    await flushEffects();
    const code = element.querySelector("code");
    assert(code !== null);
    assert.deepEqual(code.textContent, "npm i");
    assert.deepEqual(
      element.querySelector("[data-testid='rich-text']").textContent,
      "use npm i",
    );
  });

  it("keeps the base render when the request resolves null", async () => {
    const pluginService = makePluginService({ result: null });
    const element = mount({ pluginService });
    await flushEffects();
    const richText = element.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, "hello");
  });

  it("ignores a superseded request's result", async () => {
    const pluginService = makePluginService();
    const resolvers = [];
    pluginService.transformRichTextTokens = () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      });
    const element = mount({ pluginService });
    element.text = "changed";
    await flushEffects();
    assert.deepEqual(resolvers.length, 2);

    // The first (stale) request resolving must not clobber the newer render.
    resolvers[0]([{ type: "text", value: "STALE" }]);
    await flushEffects();
    const richText = element.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, "changed");

    resolvers[1]([{ type: "text", value: "fresh" }]);
    await flushEffects();
    assert.deepEqual(richText.textContent, "fresh");
  });

  it("re-requests when the transform set changes", async () => {
    const pluginService = makePluginService({ result: null });
    mount({ pluginService });
    assert.deepEqual(pluginService.calls.length, 1);

    pluginService.result = [{ type: "text", value: "now transformed" }];
    pluginService.$richTextTransformsVersion.set(1);
    await flushEffects();

    assert.deepEqual(pluginService.calls.length, 2);
  });

  it("re-renders when text changes", async () => {
    const element = mount();
    element.text = "changed";
    await flushEffects();
    const richText = element.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, "changed");
  });

  it("does not re-run the pipeline for an equal transformContext object", async () => {
    const pluginService = makePluginService();
    const transformContext = makeTransformContext();
    const element = mount({ pluginService, transformContext });
    assert.deepEqual(pluginService.calls.length, 1);

    // Parent templates rebuild the context object every render with the same
    // field values.
    element.transformContext = { ...transformContext };
    await flushEffects();

    assert.deepEqual(pluginService.calls.length, 1);
  });

  describe("facet placeholders for claimed types", () => {
    const claimedType = "blue.moji.richtext.facet";
    function makeClaimedFacetsPost() {
      const shortcode = ":blobcat:";
      const text = `hi ${shortcode}`;
      const start = text.indexOf(shortcode);
      const facets = [
        {
          index: { byteStart: start, byteEnd: start + shortcode.length },
          features: [{ $type: claimedType, did: "did:test", name: "blobcat" }],
        },
      ];
      return { text, facets };
    }

    it("hides claimed facet tokens while the transform is pending", () => {
      const pluginService = makePluginService({
        claimedFacetTypes: new Set([claimedType]),
      });
      const { text, facets } = makeClaimedFacetsPost();
      const element = mount({ pluginService, text, facets });
      const placeholder = element.querySelector(".rich-text-facet-pending");
      assert(placeholder !== null);
      assert.deepEqual(placeholder.textContent, ":blobcat:");
    });

    it("swaps in the transformed rendering when the request resolves", async () => {
      const pluginService = makePluginService({
        claimedFacetTypes: new Set([claimedType]),
        result: [
          { type: "text", value: "hi " },
          {
            type: "inline",
            pluginId: "p1",
            node: { tag: "img", text: "" },
          },
        ],
      });
      const { text, facets } = makeClaimedFacetsPost();
      const element = mount({ pluginService, text, facets });
      await flushEffects();
      assert.deepEqual(element.querySelector(".rich-text-facet-pending"), null);
      assert(element.querySelector("img") !== null);
    });

    it("falls back to the plaintext shortcode after the placeholder timeout", async () => {
      const pluginService = makePluginService({
        claimedFacetTypes: new Set([claimedType]),
      });
      pluginService.transformRichTextTokens = () => new Promise(() => {});
      const { text, facets } = makeClaimedFacetsPost();
      const element = mount({ pluginService, text, facets });
      assert(element.querySelector(".rich-text-facet-pending") !== null);
      await flushEffects();
      assert.deepEqual(element.querySelector(".rich-text-facet-pending"), null);
      const richText = element.querySelector("[data-testid='rich-text']");
      assert.deepEqual(richText.textContent, "hi :blobcat:");
    });

    it("falls back when a pending transform resolves null", async () => {
      const pluginService = makePluginService({
        claimedFacetTypes: new Set([claimedType]),
        result: null,
      });
      const { text, facets } = makeClaimedFacetsPost();
      const element = mount({ pluginService, text, facets });
      await flushEffects();
      assert.deepEqual(element.querySelector(".rich-text-facet-pending"), null);
      const richText = element.querySelector("[data-testid='rich-text']");
      assert.deepEqual(richText.textContent, "hi :blobcat:");
    });

    it("does not hide facets whose feature $type is not claimed", () => {
      const pluginService = makePluginService({
        claimedFacetTypes: new Set([claimedType]),
      });
      const url = "https://example.com";
      const text = `see ${url}`;
      const facets = [
        {
          index: { byteStart: 4, byteEnd: 4 + url.length },
          features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
        },
      ];
      const element = mount({ pluginService, text, facets });
      assert.deepEqual(element.querySelector(".rich-text-facet-pending"), null);
      assert(element.querySelector("a") !== null);
    });
  });

  describe("emoji-only enlargement", () => {
    function getRichText(element) {
      return element.querySelector("[data-testid='rich-text']");
    }

    it("marks emoji-only base text as enlarged", () => {
      const element = mount({ text: "😀" });
      assert(getRichText(element).classList.contains("rich-text-emoji-only"));
    });

    it("does not enlarge while a claimed facet is pending", () => {
      const claimedType = "blue.moji.richtext.facet";
      const pluginService = makePluginService({
        claimedFacetTypes: new Set([claimedType]),
      });
      pluginService.transformRichTextTokens = () => new Promise(() => {});
      const shortcode = ":blobcat:";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: shortcode.length },
          features: [{ $type: claimedType, did: "did:test", name: "blobcat" }],
        },
      ];
      const element = mount({ pluginService, text: shortcode, facets });
      assert(element.querySelector(".rich-text-facet-pending") !== null);
      assert(!getRichText(element).classList.contains("rich-text-emoji-only"));
    });

    it("does not enlarge a transform result containing node tokens", async () => {
      const pluginService = makePluginService({
        result: [
          {
            type: "inline",
            pluginId: "p1",
            node: { tag: "img", text: "" },
          },
        ],
      });
      const element = mount({ pluginService, text: "😀" });
      await flushEffects();
      assert(element.querySelector("img") !== null);
      assert(!getRichText(element).classList.contains("rich-text-emoji-only"));
    });

    it("enlarges a transform result that is emoji-only text", async () => {
      const pluginService = makePluginService({
        result: [{ type: "text", value: "🎉" }],
      });
      const element = mount({ text: "not emoji", pluginService });
      assert(!getRichText(element).classList.contains("rich-text-emoji-only"));
      await flushEffects();
      assert(getRichText(element).classList.contains("rich-text-emoji-only"));
    });
  });

  it("stops rendering after disconnect and resumes with the latest text on reconnect", async () => {
    const pluginService = makePluginService({ result: null });
    const element = mount({ pluginService });
    element.remove();

    element.text = "while detached";
    await flushEffects();
    assert.deepEqual(pluginService.calls.length, 1);

    document.body.appendChild(element);
    const richText = element.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, "while detached");
  });
});
