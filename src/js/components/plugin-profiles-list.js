import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";

class PluginProfilesList extends Component {
  static get observedAttributes() {
    return ["dids", "empty-message"];
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.renderContext) {
      throw new Error("plugin-profiles-list requires a renderContext property");
    }
    const { dataLayer, pluginService } = this.renderContext;
    this.dataLayer = dataLayer;
    this.pluginService = pluginService;
    this.state = new ReactiveStore("plugin-profiles-list");
    this.state.$dids = new Signal.State(this.parseDids());
    this.state.$emptyMessage = new Signal.State(
      this.getAttribute("empty-message"),
    );
    this.state.$loaded = new Signal.State(false);
    this.state.$profiles = new Signal.Computed(() => {
      if (!this.state.$loaded.get()) return null;
      const dids = this.state.$dids.get();
      return dids
        .map((did) => this.dataLayer.derived.$hydratedProfiles.get(did))
        .filter(Boolean);
    });
    this.state.$error = new Signal.State(null);
    this._disposers = [
      effect(() => {
        const error = this.state.$error.get();
        const profiles = this.state.$profiles.get();
        const emptyMessage = this.state.$emptyMessage.get();
        const dids = this.state.$dids.get();
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
            pluginService: this.pluginService,
            rightItemTemplate: null,
          }),
          this,
        );
      }),
      effect(() => {
        this.state.$dids.get();
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
    if (name === "dids") {
      this.state.$dids.set(this.parseDids());
    } else if (name === "empty-message") {
      this.state.$emptyMessage.set(newValue);
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
    const dids = this.state.$dids.get();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    this.state.$error.set(null);
    if (dids.length === 0) {
      this.state.$loaded.set(true);
      return;
    }
    this.state.$loaded.set(false);
    try {
      await this.dataLayer.declarative.ensureProfiles(dids);
      if (this._requestToken !== requestToken) return;
      this.state.$loaded.set(true);
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.state.$error.set(error.message ?? String(error));
    }
  }
}

PluginProfilesList.register();
