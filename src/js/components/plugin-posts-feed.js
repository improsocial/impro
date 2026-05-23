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
    this.render();
    this.load();
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

  async load() {
    const uris = this.parseUris();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    if (uris.length === 0) {
      this.loadedUris = [];
      this.error = null;
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
    const emptyMessage = this.getAttribute("empty-message");
    const currentUser = this.dataLayer.selectors.getCurrentUser();
    let feed = null;
    if (this.loadedUris) {
      const selected = this.dataLayer.selectors.getPosts(this.loadedUris);
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
        ...(emptyMessage ? { emptyMessage } : {}),
      }),
      this,
    );
  }
}

PluginPostsFeed.register();
