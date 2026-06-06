import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { Signal, effect } from "/js/signals.js";

class PluginProfilesList extends Component {
  static get observedAttributes() {
    return ["dids", "empty-message"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.attribs = {
      dids: new Signal.State(this.parseDids()),
      emptyMessage: new Signal.State(this.getAttribute("empty-message")),
    };
    this.state = {
      loaded: new Signal.State(false),
      profiles: new Signal.Computed(() => {
        if (!this.state.loaded.get()) return null;
        const dids = this.attribs.dids.get();
        return dids
          .map((did) => this.dataLayer.derived.$hydratedProfiles.get(did))
          .filter(Boolean);
      }),
      error: new Signal.State(null),
    };
    this._disposers = [
      effect(() => {
        const error = this.state.error.get();
        const profiles = this.state.profiles.get();
        const emptyMessage = this.attribs.emptyMessage.get();
        const dids = this.attribs.dids.get();
        if (error) {
          render(html`<div class="profile-list-error">${error}</div>`, this);
          return;
        }
        render(
          profileFeedTemplate({
            profiles,
            hasMore: false,
            skeletonCount: dids.length,
            emptyMessage,
          }),
          this,
        );
      }),
      effect(() => {
        this.attribs.dids.get();
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
      this.attribs.dids.set(this.parseDids());
      this.attribs.emptyMessage.set(this.getAttribute("empty-message"));
    }
  }

  parseDids() {
    const value = this.getAttribute("dids") ?? "";
    return value
      .split(",")
      .map((did) => did.trim())
      .filter(Boolean);
  }

  async load() {
    const dids = this.attribs.dids.get();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    this.state.error.set(null);
    if (dids.length === 0) {
      this.state.loaded.set(true);
      return;
    }
    this.state.loaded.set(false);
    try {
      await this.dataLayer.declarative.ensureProfiles(dids);
      if (this._requestToken !== requestToken) return;
      this.state.loaded.set(true);
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.state.error.set(error.message ?? String(error));
    }
  }
}

PluginProfilesList.register();
