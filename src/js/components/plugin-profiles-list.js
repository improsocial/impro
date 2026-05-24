import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";

class PluginProfilesList extends Component {
  static get observedAttributes() {
    return ["dids", "empty-message"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.profiles = null;
    this.error = null;
    this.render();
    this.load();
  }

  attributeChangedCallback() {
    if (this.initialized) this.load();
  }

  parseDids() {
    const value = this.getAttribute("dids") ?? "";
    return value
      .split(",")
      .map((did) => did.trim())
      .filter(Boolean);
  }

  async load() {
    const dids = this.parseDids();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    if (dids.length === 0) {
      this.profiles = [];
      this.error = null;
      this.render();
      return;
    }
    this.profiles = null;
    this.error = null;
    this.render();
    try {
      const profiles = await this.dataLayer.declarative.ensureProfiles(dids);
      if (this._requestToken !== requestToken) return;
      this.profiles = profiles.filter(Boolean);
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.error = error.message ?? String(error);
    }
    this.render();
  }

  render() {
    if (this.error) {
      render(html`<div class="profile-list-error">${this.error}</div>`, this);
      return;
    }
    const emptyMessage = this.getAttribute("empty-message");
    render(
      profileFeedTemplate({
        profiles: this.profiles,
        hasMore: false,
        showEndMessage: false,
        skeletonCount: this.parseDids().length,
        ...(emptyMessage ? { emptyMessage } : {}),
      }),
      this,
    );
  }
}

PluginProfilesList.register();
