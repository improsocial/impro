import { render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import { shallowEquals } from "/js/utils.js";
import { tokenizeRichText, tokensHaveFacetType } from "/js/richTextHelpers.js";
import { richTextTokensTemplate } from "/js/templates/richText.template.js";

class PluginRichText extends Component {
  static placeholderFallbackMs = 500;

  static get observedAttributes() {
    return ["truncate-urls"];
  }

  set text(value) {
    this._text = value;
    this.$text?.set(value);
  }

  set facets(value) {
    this._facets = value;
    this.$facets?.set(value);
  }

  set transformContext(value) {
    this._transformContext = value;
    this.$transformContext?.set(value);
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.pluginService) {
      throw new Error("pluginService is required");
    }
    this.$text = new Signal.State(this._text ?? "");
    this.$facets = new Signal.State(this._facets ?? null);
    this.$transformContext = new Signal.State(this._transformContext ?? null, {
      equals: shallowEquals,
    });
    this.$truncateUrls = new Signal.State(this.hasAttribute("truncate-urls"));
    this.disposeRender = effect(() => this.renderContent());
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    if (name === "truncate-urls") {
      this.$truncateUrls.set(newValue !== null);
    }
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this.disposeRender?.();
    this.disposeRender = null;
    this._currentRequest = null;
    if (this._claimedFacetFallbackTimer) {
      clearTimeout(this._claimedFacetFallbackTimer);
      this._claimedFacetFallbackTimer = null;
    }
    this.initialized = false;
  }

  renderContent() {
    const text = this.$text.get() ?? "";
    const facets = this.$facets.get() ?? [];
    const transformContext = this.$transformContext.get();
    const truncateUrls = this.$truncateUrls.get();
    const pluginService = this.pluginService;
    const baseTokens = tokenizeRichText({ text, facets });

    // Subscribe to the version signal so registering/unregistering a transform will re-render
    pluginService.$richTextTransformsVersion.get();

    if (this._claimedFacetFallbackTimer) {
      clearTimeout(this._claimedFacetFallbackTimer);
      this._claimedFacetFallbackTimer = null;
    }

    // Request transformed tokens from pluginService
    if (!transformContext) {
      this._currentRequest = null;
      this._renderTokens({
        tokens: baseTokens,
        truncateUrls,
        placeholderFacetTypes: null,
      });
      return;
    }
    const request = pluginService.transformRichTextTokens(baseTokens, {
      numberOfLines: null,
      ...transformContext,
      source: { text, facets },
    });
    this._currentRequest = request;

    // Hide facet tokens whose feature $type is claimed by a pending transform,
    // so shortcodes don't briefly flash as plaintext before the transform swaps
    // them for their rendered form (e.g. bluemoji).
    const claimedFacetTypes = pluginService.getClaimedFacetTypes();
    this._renderTokens({
      tokens: baseTokens,
      truncateUrls,
      placeholderFacetTypes: claimedFacetTypes,
    });

    // Fallback + null-resolve re-render only matter when something was hidden.
    const hasClaimedFacets = tokensHaveFacetType(baseTokens, claimedFacetTypes);

    if (hasClaimedFacets) {
      this._claimedFacetFallbackTimer = setTimeout(() => {
        this._claimedFacetFallbackTimer = null;
        if (this._currentRequest !== request || !this.initialized) return;
        this._renderTokens({
          tokens: baseTokens,
          truncateUrls,
          placeholderFacetTypes: null,
        });
      }, PluginRichText.placeholderFallbackMs);
    }

    request.then(
      (transformed) => {
        if (
          // Ignore results that resolved after a newer render pass
          this._currentRequest !== request ||
          !this.initialized
        )
          return;
        if (this._claimedFacetFallbackTimer) {
          clearTimeout(this._claimedFacetFallbackTimer);
          this._claimedFacetFallbackTimer = null;
        }
        if (!transformed) {
          if (hasClaimedFacets) {
            this._renderTokens({
              tokens: baseTokens,
              truncateUrls,
              placeholderFacetTypes: null,
            });
          }
          return;
        }
        this._renderTokens({
          tokens: transformed,
          truncateUrls,
          placeholderFacetTypes: null,
        });
      },
      (error) => {
        console.error("Rich text transform request failed", error);
      },
    );
  }

  _renderTokens({ tokens, truncateUrls, placeholderFacetTypes }) {
    render(
      richTextTokensTemplate({
        tokens,
        truncateUrls,
        placeholderFacetTypes,
        renderNodeToken: (token) =>
          this.pluginService.renderRichTextNodeToken(token, this),
      }),
      this,
    );
  }
}

PluginRichText.register();
