import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Signal } from "/js/signals.js";
import "/js/components/plugin-rich-text.js";

describe("plugin-rich-text", () => {
  async function flushEffects() {
    // Two ticks: signal changes re-run effects via rAF, which the test env
    // pins to setTimeout.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Stand-in for the pipeline's async API. The element reads
  // $richTextTransformsVersion inside its render effect, so bumping it
  // re-fires the effect.
  function makePluginService({ result = null } = {}) {
    return {
      $richTextTransformsVersion: new Signal.State(0),
      calls: [],
      result,
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
