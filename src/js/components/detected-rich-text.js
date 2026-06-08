import { render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import {
  getUnresolvedFacetsFromText,
  resolveFacets,
} from "/js/facetHelpers.js";

class DetectedRichText extends Component {
  static get observedAttributes() {
    return ["text", "truncate-urls"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    this.$text = new Signal.State(this.getAttribute("text") ?? "");
    this.$truncateUrls = new Signal.State(this.hasAttribute("truncate-urls"));
    this.$unresolvedFacets = new Signal.Computed(() =>
      getUnresolvedFacetsFromText(this.$text.get()),
    );
    this.$resolvedFacets = new Signal.State(null);

    // Resolve facets whenever unresolved facets change
    this.disposeResolve = effect(() => {
      if (!this.identityResolver) return;
      const unresolvedFacets = this.$unresolvedFacets.get();
      resolveFacets(unresolvedFacets, this.identityResolver).then(
        (resolvedFacets) => {
          if (unresolvedFacets !== this.$unresolvedFacets.get()) {
            // If unresolved facets have changed since we started resolving, don't update
            return;
          }
          this.$resolvedFacets.set(resolvedFacets);
        },
      );
    });

    this.disposeRender = effect(() => {
      const text = this.$text.get();
      const unresolvedFacets = this.$unresolvedFacets.get();
      const resolvedFacets = this.$resolvedFacets.get();
      const truncateUrls = this.$truncateUrls.get();
      let facets = resolvedFacets ?? unresolvedFacets;
      if (!this.identityResolver) {
        facets = facets.filter(
          (facet) =>
            facet.features[0].$type !== "app.bsky.richtext.facet#mention",
        );
      }
      render(richTextTemplate({ text, facets, truncateUrls }), this);
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    if (name === "text") {
      const text = newValue ?? "";
      this.$resolvedFacets.set(null);
      this.$text.set(text);
    } else if (name === "truncate-urls") {
      this.$truncateUrls.set(newValue !== null);
    }
  }

  disconnectedCallback() {
    this.disposeRender?.();
    this.disposeRender = null;
    this.disposeResolve?.();
    this.disposeResolve = null;
    this.initialized = false;
  }
}

DetectedRichText.register();
