import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { Signal, effect } from "/js/signals.js";

class PluginPostsFeed extends Component {
  static get observedAttributes() {
    return ["uris", "empty-message"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.postInteractionHandler) {
      throw new Error("postInteractionHandler is required");
    }
    this.attribs = {
      uris: new Signal.State(this.parseUris()),
      emptyMessage: new Signal.State(this.getAttribute("empty-message")),
    };
    this.state = {
      currentUser: this.dataLayer.derived.$currentUser,
      loaded: new Signal.State(false),
      posts: new Signal.Computed(() => {
        if (!this.state.loaded.get()) return null;
        const uris = this.attribs.uris.get();
        if (!uris) return null;
        return uris
          .map((uri) => this.dataLayer.derived.$hydratedPosts.get(uri).get())
          .filter(Boolean);
      }),
      error: new Signal.State(null),
    };
    this._disposers = [
      effect(() => {
        const error = this.state.error.get();
        const posts = this.state.posts.get();
        const currentUser = this.state.currentUser.get();
        const emptyMessage = this.attribs.emptyMessage.get();
        if (error) {
          render(html`<div class="posts-feed-error">${error}</div>`, this);
          return;
        }
        const feed = posts
          ? {
              feed: posts.map((post) => ({ post })),
              cursor: null,
            }
          : null;
        render(
          postFeedTemplate({
            feed,
            currentUser,
            isAuthenticated: this.isAuthenticated,
            postInteractionHandler: this.postInteractionHandler,
            pluginService: this.pluginService,
            emptyMessage,
          }),
          this,
        );
      }),
      effect(() => {
        this.attribs.uris.get();
        this.load();
      }),
    ];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
  }

  attributeChangedCallback() {
    if (this.initialized) {
      // TODO - smarter updates?
      this.attribs.uris.set(this.parseUris());
      this.attribs.emptyMessage.set(this.getAttribute("empty-message"));
    }
  }

  parseUris() {
    const value = this.getAttribute("uris") ?? "";
    return value
      .split(",")
      .map((uri) => uri.trim())
      .filter(Boolean);
  }

  async load() {
    const uris = this.parseUris();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    this.state.error.set(null);
    try {
      await this.dataLayer.declarative.ensurePosts(uris);
      if (this._requestToken !== requestToken) return;
      this.state.loaded.set(true);
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.state.error.set(error.message ?? String(error));
    }
  }
}

PluginPostsFeed.register();
