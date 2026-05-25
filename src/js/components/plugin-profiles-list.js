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
    this.loadedDids = null;
    this.error = null;
    this._profileUnsubs = new Map();
    this._onLiveUpdate = () => this.render();
    this.render();
    this.load();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._profileUnsubs.forEach((unsub) => unsub());
    this._profileUnsubs.clear();
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

  _syncProfileSubscriptions(dids) {
    const next = new Set(dids);
    for (const did of [...this._profileUnsubs.keys()]) {
      if (!next.has(did)) {
        this._profileUnsubs.get(did)();
        this._profileUnsubs.delete(did);
      }
    }
    for (const did of dids) {
      if (this._profileUnsubs.has(did)) continue;
      const event = `profile:${did}`;
      this.dataLayer.events.on(event, this._onLiveUpdate);
      this._profileUnsubs.set(did, () =>
        this.dataLayer.events.off(event, this._onLiveUpdate),
      );
    }
  }

  async load() {
    const dids = this.parseDids();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    if (dids.length === 0) {
      this.loadedDids = [];
      this.error = null;
      this._syncProfileSubscriptions([]);
      this.render();
      return;
    }
    this.loadedDids = null;
    this.error = null;
    this.render();
    try {
      await this.dataLayer.declarative.ensureProfiles(dids);
      if (this._requestToken !== requestToken) return;
      this.loadedDids = dids;
      this._syncProfileSubscriptions(dids);
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
    let profiles = null;
    if (this.loadedDids) {
      profiles = this.loadedDids
        .map((did) => this.dataLayer.base.getProfile(did))
        .filter(Boolean);
    }
    render(
      profileFeedTemplate({
        profiles,
        hasMore: false,
        skeletonCount: this.parseDids().length,
        emptyMessage: this.getAttribute("empty-message"),
      }),
      this,
    );
  }
}

PluginProfilesList.register();
