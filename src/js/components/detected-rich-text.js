import { render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
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

    this.state = new ReactiveStore("detected-rich-text");
    this.state.$text = new Signal.State(this.getAttribute("text") ?? "");
    this.state.$truncateUrls = new Signal.State(
      this.hasAttribute("truncate-urls"),
    );
    this.state.$unresolvedFacets = new Signal.Computed(() =>
      getUnresolvedFacetsFromText(this.state.$text.get()),
    );
    this.state.$resolvedFacets = new Signal.State(null);

    // Resolve facets whenever unresolved facets change
    this.disposeResolve = effect(() => {
      if (!this.identityResolver) return;
      const unresolvedFacets = this.state.$unresolvedFacets.get();
      resolveFacets(unresolvedFacets, this.identityResolver).then(
        (resolvedFacets) => {
          if (unresolvedFacets !== this.state.$unresolvedFacets.get()) {
            // If unresolved facets have changed since we started resolving, don't update
            return;
          }
          this.state.$resolvedFacets.set(resolvedFacets);
        },
      );
    });

    this.disposeRender = effect(() => {
      const text = this.state.$text.get();
      const unresolvedFacets = this.state.$unresolvedFacets.get();
      const resolvedFacets = this.state.$resolvedFacets.get();
      const truncateUrls = this.state.$truncateUrls.get();
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
      this.state.$resolvedFacets.set(null);
      this.state.$text.set(text);
    } else if (name === "truncate-urls") {
      this.state.$truncateUrls.set(newValue !== null);
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
