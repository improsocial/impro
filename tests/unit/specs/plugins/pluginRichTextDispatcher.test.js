import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginRichTextDispatcher } from "/js/plugins/pluginRichTextDispatcher.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

// The dispatcher mounts node tokens through the owning plugin's renderer; the
// real PluginRenderer keeps the sanitization path under test.
function makeDispatcher() {
  return new PluginRichTextDispatcher({
    getRenderer: (pluginId) => new PluginRenderer(null, pluginId),
  });
}

describe("PluginRichTextDispatcher - claimed facet types", () => {
  it("is empty when no transforms are registered", () => {
    assert.deepEqual([...makeDispatcher().getClaimedFacetTypes()], []);
  });

  it("unions handlesFacetTypes across registered transforms", () => {
    const dispatcher = makeDispatcher();
    dispatcher.register({
      pluginId: "alpha",
      handlesFacetTypes: ["blue.moji.richtext.facet", "com.domain.foo"],
      invoke: () => {},
    });
    dispatcher.register({
      pluginId: "beta",
      handlesFacetTypes: ["com.domain.foo"],
      invoke: () => {},
    });
    assert.deepEqual([...dispatcher.getClaimedFacetTypes()].sort(), [
      "blue.moji.richtext.facet",
      "com.domain.foo",
    ]);
  });

  it("drops entries when a transform unregisters", () => {
    const dispatcher = makeDispatcher();
    const dispose = dispatcher.register({
      pluginId: "alpha",
      handlesFacetTypes: ["blue.moji.richtext.facet"],
      invoke: () => {},
    });
    dispose();
    assert.deepEqual([...dispatcher.getClaimedFacetTypes()], []);
  });

  it("tolerates a transform registered without handlesFacetTypes", () => {
    const dispatcher = makeDispatcher();
    dispatcher.register({ pluginId: "alpha", invoke: () => {} });
    assert.deepEqual([...dispatcher.getClaimedFacetTypes()], []);
  });
});

describe("PluginRichTextDispatcher - transform pipeline", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  function makeContext({
    uri = "at://did:test/app.bsky.feed.post/1",
    surface = "largePost",
    text = "hello",
    facets = [],
  } = {}) {
    return {
      surface,
      uri,
      did: "did:test",
      numberOfLines: null,
      source: { text, facets },
    };
  }

  function addTransform(dispatcher, pluginId, invoke) {
    return dispatcher.register({ pluginId, invoke });
  }

  function silencingErrors(run) {
    const originalError = console.error;
    console.error = () => {};
    return Promise.resolve()
      .then(run)
      .finally(() => {
        console.error = originalError;
      });
  }

  it("resolves null with no transforms registered", async () => {
    const dispatcher = makeDispatcher();
    const tokens = [{ type: "text", value: "hello" }];
    assert.deepEqual(
      await dispatcher.transformTokens(tokens, makeContext()),
      null,
    );
  });

  it("resolves the transformed tokens and caches them per post and surface", async () => {
    const dispatcher = makeDispatcher();
    const batches = [];
    addTransform(dispatcher, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "!" }],
      }));
    });
    const tokens = [{ type: "text", value: "hello" }];
    const context = makeContext();

    const transformed = await dispatcher.transformTokens(tokens, context);
    assert.deepEqual(transformed, [
      { type: "text", value: "hello" },
      { type: "text", value: "!" },
    ]);

    // Second request hits the cache: same result, no extra plugin call.
    assert.deepEqual(
      await dispatcher.transformTokens(tokens, context),
      transformed,
    );
    assert.deepEqual(batches.length, 1);
  });

  it("batches all posts of a render burst into one call per plugin", async () => {
    const dispatcher = makeDispatcher();
    const batches = [];
    addTransform(dispatcher, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });

    await Promise.all([
      dispatcher.transformTokens(
        [{ type: "text", value: "one" }],
        makeContext({ uri: "at://post/1", text: "one" }),
      ),
      dispatcher.transformTokens(
        [{ type: "text", value: "two" }],
        makeContext({ uri: "at://post/2", text: "two" }),
      ),
    ]);

    assert.deepEqual(batches.length, 1);
    assert.deepEqual(batches[0].length, 2);
    assert.deepEqual(batches[0][0].tokens, [{ type: "text", value: "one" }]);
    assert.deepEqual(batches[0][1].tokens, [{ type: "text", value: "two" }]);
  });

  it("shares one run between concurrent requests for the same post and surface", async () => {
    const dispatcher = makeDispatcher();
    const batches = [];
    addTransform(dispatcher, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const tokens = [{ type: "text", value: "hello" }];
    const context = makeContext();

    const [first, second] = await Promise.all([
      dispatcher.transformTokens(tokens, context),
      dispatcher.transformTokens(tokens, context),
    ]);

    assert.deepEqual(first, second);
    assert.deepEqual(batches.length, 1);
    assert.deepEqual(batches[0].length, 1);
  });

  it("chains transforms in registration order", async () => {
    const dispatcher = makeDispatcher();
    addTransform(dispatcher, "alpha", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "A" }],
      })),
    );
    addTransform(dispatcher, "beta", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "B" }],
      })),
    );

    const transformed = await dispatcher.transformTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );

    assert.deepEqual(
      transformed.map((token) => token.value),
      ["hello", "A", "B"],
    );
  });

  it("fails open when a transform throws", async () => {
    const dispatcher = makeDispatcher();
    addTransform(dispatcher, "alpha", async () => {
      throw new Error("boom");
    });
    addTransform(dispatcher, "beta", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "text", value: "B" }],
      })),
    );

    const transformed = await silencingErrors(() =>
      dispatcher.transformTokens(
        [{ type: "text", value: "hello" }],
        makeContext(),
      ),
    );

    assert.deepEqual(
      transformed.map((token) => token.value),
      ["hello", "B"],
    );
  });

  it("fails open per item on error entries and malformed tokens", async () => {
    const dispatcher = makeDispatcher();
    addTransform(dispatcher, "alpha", async (batch) =>
      batch.map(({ context }) =>
        context.uri.endsWith("/1")
          ? { error: "no thanks" }
          : { value: [{ type: "bogus" }] },
      ),
    );

    const [first, second] = await silencingErrors(() =>
      Promise.all([
        dispatcher.transformTokens(
          [{ type: "text", value: "one" }],
          makeContext({ uri: "at://post/1", text: "one" }),
        ),
        dispatcher.transformTokens(
          [{ type: "text", value: "two" }],
          makeContext({ uri: "at://post/2", text: "two" }),
        ),
      ]),
    );

    assert.deepEqual(first, [{ type: "text", value: "one" }]);
    assert.deepEqual(second, [{ type: "text", value: "two" }]);
  });

  it("re-hydrates returned facet tokens to the host originals", async () => {
    const dispatcher = makeDispatcher();
    const facet = {
      index: { byteStart: 0, byteEnd: 4 },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: "tag" }],
    };
    const facetToken = { type: "facet", facet, text: "#tag" };
    // Simulate the structured-clone boundary: the plugin returns a copy.
    addTransform(dispatcher, "alpha", async (batch) =>
      batch.map(({ tokens }) => ({
        value: JSON.parse(JSON.stringify(tokens)),
      })),
    );

    const transformed = await dispatcher.transformTokens(
      [facetToken, { type: "text", value: " in front" }],
      makeContext({ text: "#tag in front", facets: [facet] }),
    );

    assert(
      transformed[0] === facetToken,
      "facet token should be the host object",
    );
  });

  it("rejects a result containing an unrecognized facet", async () => {
    const dispatcher = makeDispatcher();
    addTransform(dispatcher, "alpha", async (batch) =>
      batch.map(() => ({
        value: [
          {
            type: "facet",
            facet: { index: { byteStart: 0, byteEnd: 99 }, features: [] },
            text: "forged",
          },
        ],
      })),
    );
    const tokens = [{ type: "text", value: "hello" }];

    const transformed = await silencingErrors(() =>
      dispatcher.transformTokens(tokens, makeContext()),
    );

    assert.deepEqual(transformed, tokens);
  });

  it("stamps inline/block tokens with the emitting transform's pluginId and preserves earlier ids", async () => {
    const dispatcher = makeDispatcher();
    const node = { tag: "code", text: "x" };
    addTransform(dispatcher, "alpha", async (batch) =>
      batch.map(() => ({ value: [{ type: "inline", node }] })),
    );
    addTransform(dispatcher, "beta", async (batch) =>
      batch.map(({ tokens }) => ({
        value: [...tokens, { type: "block", node }],
      })),
    );

    const transformed = await dispatcher.transformTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );

    assert.deepEqual(
      transformed.map((token) => token.pluginId),
      ["alpha", "beta"],
    );
  });

  it("re-stamps a forged pluginId naming another plugin", async () => {
    const dispatcher = makeDispatcher();
    const node = { tag: "code", text: "x" };
    addTransform(dispatcher, "alpha", async (batch) =>
      batch.map(() => ({
        value: [{ type: "inline", pluginId: "victim", node }],
      })),
    );

    const transformed = await dispatcher.transformTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );

    assert.deepEqual(
      transformed.map((token) => token.pluginId),
      ["alpha"],
    );
  });

  it("clears cached results when the transform set changes", async () => {
    const dispatcher = makeDispatcher();
    const batches = [];
    addTransform(dispatcher, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const tokens = [{ type: "text", value: "hello" }];
    const context = makeContext();

    await dispatcher.transformTokens(tokens, context);
    dispatcher._invalidate();
    await dispatcher.transformTokens(tokens, context);

    assert.deepEqual(batches.length, 2);
  });

  it("resolves in-flight requests with null when transforms change mid-run", async () => {
    const dispatcher = makeDispatcher();
    let releaseTransform;
    const gate = new Promise((resolve) => {
      releaseTransform = resolve;
    });
    addTransform(dispatcher, "alpha", async (batch) => {
      await gate;
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const request = dispatcher.transformTokens(
      [{ type: "text", value: "hello" }],
      makeContext(),
    );
    await flush();
    dispatcher._invalidate();
    releaseTransform();

    assert.deepEqual(await request, null);
    assert.deepEqual(dispatcher._cache.size, 0);
  });

  it("re-runs when the cached entry no longer matches the source text", async () => {
    const dispatcher = makeDispatcher();
    const batches = [];
    addTransform(dispatcher, "alpha", async (batch) => {
      batches.push(batch);
      return batch.map(({ tokens }) => ({ value: tokens }));
    });
    const context = makeContext({ text: "before" });

    await dispatcher.transformTokens(
      [{ type: "text", value: "before" }],
      context,
    );
    const transformed = await dispatcher.transformTokens(
      [{ type: "text", value: "after" }],
      makeContext({ text: "after" }),
    );

    assert.deepEqual(batches.length, 2);
    assert.deepEqual(transformed, [{ type: "text", value: "after" }]);
  });

  it("renderRichTextNodeToken mounts a sanitized element and reuses it per token and host", () => {
    const dispatcher = makeDispatcher();
    const token = {
      type: "inline",
      pluginId: "alpha",
      node: { tag: "code", attrs: {}, text: "x", children: [], events: {} },
    };
    const host = document.createElement("div");

    const element = dispatcher.renderNodeToken(token, host);
    assert.deepEqual(element.localName, "code");
    assert.deepEqual(element.textContent, "x");
    assert(dispatcher.renderNodeToken(token, host) === element);
    const otherHost = document.createElement("div");
    const otherElement = dispatcher.renderNodeToken(token, otherHost);
    assert.deepEqual(otherElement.localName, "code");
    assert(otherElement !== element);
  });
});
