import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";

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
    this.loadedUris = null;
    this.error = null;
    this._postUnsubs = new Map();
    this._onLiveUpdate = () => this.render();
    this.dataLayer.events.on("preferences:changed", this._onLiveUpdate);
    this.render();
    this.load();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._postUnsubs.forEach((unsub) => unsub());
    this._postUnsubs.clear();
    this.dataLayer.events.off("preferences:changed", this._onLiveUpdate);
  }

  attributeChangedCallback() {
    if (this.initialized) this.load();
  }

  refresh() {
    if (!this.initialized) return;
    this.render();
  }

  parseUris() {
    const value = this.getAttribute("uris") ?? "";
    return value
      .split(",")
      .map((uri) => uri.trim())
      .filter(Boolean);
  }

  _syncPostSubscriptions(uris) {
    const next = new Set(uris);
    for (const uri of [...this._postUnsubs.keys()]) {
      if (!next.has(uri)) {
        this._postUnsubs.get(uri)();
        this._postUnsubs.delete(uri);
      }
    }
    for (const uri of uris) {
      if (this._postUnsubs.has(uri)) continue;
      const event = `post:${uri}`;
      this.dataLayer.events.on(event, this._onLiveUpdate);
      this._postUnsubs.set(uri, () =>
        this.dataLayer.events.off(event, this._onLiveUpdate),
      );
    }
  }

  async load() {
    const uris = this.parseUris();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    if (uris.length === 0) {
      this.loadedUris = [];
      this.error = null;
      this._syncPostSubscriptions([]);
      this.render();
      return;
    }
    this.loadedUris = null;
    this.error = null;
    this.render();
    try {
      await this.dataLayer.declarative.ensurePosts(uris);
      if (this._requestToken !== requestToken) return;
      this.loadedUris = uris;
      this._syncPostSubscriptions(uris);
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.error = error.message ?? String(error);
    }
    this.render();
  }

  render() {
    if (this.error) {
      render(html`<div class="posts-feed-error">${this.error}</div>`, this);
      return;
    }
    const currentUser = this.dataLayer.selectors.getCurrentUser();
    let feed = null;
    if (this.loadedUris) {
      const preferences = this.dataLayer.selectors.getPreferences();
      const selected = this.loadedUris.map((uri) => {
        const current = this.dataLayer.base.getPost(uri);
        if (!current) return null;
        return this.dataLayer.derived.hydratePostForView(current, {
          preferences,
          getPost: this.dataLayer.base.getPost,
        });
      });
      const missing = this.loadedUris.filter((_, index) => !selected[index]);
      if (missing.length > 0) {
        console.warn(
          "plugin-posts-feed: some posts could not be loaded",
          missing,
        );
      }
      const posts = selected.filter(Boolean);
      feed = { feed: posts.map((post) => ({ post })), cursor: null };
    }
    render(
      postFeedTemplate({
        feed,
        currentUser,
        isAuthenticated: this.isAuthenticated,
        postInteractionHandler: this.postInteractionHandler,
        pluginService: this.pluginService,
        emptyMessage: this.getAttribute("empty-message"),
      }),
      this,
    );
  }
}

PluginPostsFeed.register();
