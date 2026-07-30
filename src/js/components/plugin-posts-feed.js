import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";

class PluginPostsFeed extends Component {
  static get observedAttributes() {
    return ["uris", "empty-message"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.renderContext) {
      throw new Error("plugin-posts-feed requires a renderContext property");
    }
    const {
      dataLayer,
      isAuthenticated,
      pluginService,
      postInteractionHandler,
    } = this.renderContext;
    this.dataLayer = dataLayer;
    this.isAuthenticated = isAuthenticated;
    this.pluginService = pluginService;
    this.postInteractionHandler = postInteractionHandler;
    this.state = new ReactiveStore("plugin-posts-feed");
    this.state.$uris = new Signal.State(this.parseUris());
    this.state.$emptyMessage = new Signal.State(
      this.getAttribute("empty-message"),
    );
    this.state.$loaded = new Signal.State(false);
    this.state.$posts = new Signal.Computed(() => {
      if (!this.state.$loaded.get()) return null;
      const uris = this.state.$uris.get();
      if (!uris) return null;
      return uris
        .map((uri) => this.dataLayer.derived.$hydratedPosts.get(uri))
        .filter(Boolean);
    });
    this.state.$error = new Signal.State(null);
    this._disposers = [
      effect(() => {
        const error = this.state.$error.get();
        const posts = this.state.$posts.get();
        const currentUser = this.dataLayer.derived.$currentUser.get();
        const emptyMessage = this.state.$emptyMessage.get();
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
        this.state.$uris.get();
        this.load();
      }),
    ];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    if (name === "uris") {
      this.state.$uris.set(this.parseUris());
    } else if (name === "empty-message") {
      this.state.$emptyMessage.set(newValue);
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
    this.state.$error.set(null);
    try {
      await this.dataLayer.declarative.ensurePosts(uris);
      if (this._requestToken !== requestToken) return;
      this.state.$loaded.set(true);
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.state.$error.set(error.message ?? String(error));
    }
  }
}

PluginPostsFeed.register();
