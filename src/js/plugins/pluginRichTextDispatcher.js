import { Signal } from "/js/signals.js";
import { AsyncValueCache, batchPerTick } from "/js/utils.js";
import {
  validateRichTextTokens,
  hydrateRichTextFacets,
} from "/js/richTextHelpers.js";

const MAX_CACHED_POSTS = 500;

// Stamps node tokens (inline/block) with the pluginId that created them, so
// renderNodeToken can route each to the correct plugin's renderer.
function stampNodeTokens(tokens, previousTokens, pluginId) {
  const stampedIds = new Set();
  // Only pass through previously stamped tokens to prevent cross-plugin forgery
  for (const token of previousTokens) {
    if (token.type === "inline" || token.type === "block") {
      stampedIds.add(token.pluginId);
    }
  }
  return tokens.map((token) => {
    if (token.type !== "inline" && token.type !== "block") return token;
    return {
      ...token,
      pluginId: stampedIds.has(token.pluginId) ? token.pluginId : pluginId,
    };
  });
}

export class PluginRichTextDispatcher {
  constructor({ getRenderer }) {
    this.$version = new Signal.State(0);
    this._getRenderer = getRenderer;
    this._transforms = new Set();
    // (uri, surface) -> { text, tokens }
    this._cache = new AsyncValueCache(MAX_CACHED_POSTS);
    // Run pipeline once per render flush
    this._runTransform = batchPerTick((items) => this._runTransforms(items));
    this._elements = new WeakMap();
  }

  // `invoke` takes an array of { tokens, context } and resolves to an array of
  // { value } | { error } in the same order. Returns a dispose function.
  register({ pluginId, handlesFacetTypes = [], invoke }) {
    const transform = {
      pluginId,
      handlesFacetTypes: Array.isArray(handlesFacetTypes)
        ? handlesFacetTypes
        : [],
      invoke,
    };
    this._transforms.add(transform);
    this._invalidate();
    return () => {
      this._transforms.delete(transform);
      this._invalidate();
    };
  }

  // Facet types a transform owns, so the host can hold back rendering the
  // fallback text for them and avoid a render flash
  getClaimedFacetTypes() {
    const types = new Set();
    for (const transform of this._transforms) {
      for (const type of transform.handlesFacetTypes) types.add(type);
    }
    return types;
  }

  // Results are cached by (uri, surface); requests are batched per render flush
  async transformTokens(tokens, context) {
    if (this._transforms.size === 0) return null;
    const key = `${context.uri}|${context.surface}`;
    // A post's text can potentially change under the same key (an edit), so
    // check to make sure it matches here
    const cached = this._cache.peek(key);
    if (cached && cached.value.text !== context.source.text) {
      this._cache.delete(key);
    }
    // A transform registering mid-run invalidates the cache, so that result is
    // never stored - the run resolves null and this render keeps the original tokens
    const result = await this._cache.request(key, async () => ({
      text: context.source.text,
      tokens: await this._runTransform({ baseTokens: tokens, tokens, context }),
    }));
    return result.tokens;
  }

  // Mounts a node token's VirtualEl via the owning plugin's renderer.
  // Elements are cached by host / token
  renderNodeToken(token, host) {
    if (!token.pluginId || !token.node || !host) return null;
    let byToken = this._elements.get(host);
    if (!byToken) {
      byToken = new WeakMap();
      this._elements.set(host, byToken);
    }
    let cached = byToken.get(token);
    if (!cached) {
      let renderer = null;
      try {
        renderer = this._getRenderer(token.pluginId);
      } catch {
        return null;
      }
      cached = { root: renderer.createRoot() };
      byToken.set(token, cached);
    }
    return cached.root.render(token.node);
  }

  _invalidate() {
    this._cache.invalidate();
    this.$version.set(this.$version.get() + 1);
  }

  async _runTransforms(items) {
    const version = this.$version.get();
    for (const transform of this._transforms) {
      const batch = items.map((item) => ({
        tokens: item.tokens,
        context: item.context,
      }));
      let results = null;
      try {
        results = await transform.invoke(batch);
      } catch (e) {
        console.error(
          `Plugin ${transform.pluginId} rich text transform raised an exception`,
          e,
        );
      }
      if (!Array.isArray(results)) continue;
      items.forEach((item, index) => {
        const result = results[index];
        if (!result || result.error != null) {
          if (result?.error != null) {
            console.error(
              `Plugin ${transform.pluginId} rich text transform failed: ${result.error}`,
            );
          }
          return;
        }
        if (!validateRichTextTokens(result.value)) {
          console.error(
            `Plugin ${transform.pluginId} rich text transform returned malformed tokens`,
          );
          return;
        }
        try {
          const hydrated = hydrateRichTextFacets(result.value, item.baseTokens);
          item.tokens = stampNodeTokens(
            hydrated,
            item.tokens,
            transform.pluginId,
          );
        } catch (error) {
          console.error(
            `Plugin ${transform.pluginId} rich text transform returned an unrecognized facet`,
            error,
          );
        }
      });
    }
    // Discard if transforms changed mid-run
    if (version !== this.$version.get()) return items.map(() => null);
    return items.map((item) => item.tokens);
  }
}
