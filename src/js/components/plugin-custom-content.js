import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";

class PluginCustomContent extends Component {
  constructor() {
    super();
    this.state = new ReactiveStore("plugin-custom-content");
    this.state.$customContent = new Signal.State(null);
    this.state.$result = new Signal.State(null);
    this.state.$error = new Signal.State(null);
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.pluginService) {
      throw new Error(
        "plugin-custom-content requires a pluginService property",
      );
    }
    this._disposers = [
      effect(() => {
        const error = this.state.$error.get();
        const result = this.state.$result.get();
        if (error) {
          render(
            html`<p class="error-message" data-testid="plugin-content-error">
              ${error}
            </p>`,
            this,
          );
          return;
        }
        if (!result) {
          render(
            html`<div class="plugins-loading-state">
              <div class="loading-spinner"></div>
            </div>`,
            this,
          );
          return;
        }
        render(result.element, this);
      }),
      // Load content when $customContent or $refresh change
      effect(() => {
        const customContent = this.state.$customContent.get();
        if (!customContent) return;
        const refresh = customContent.$refresh.get();
        this.load(customContent, { reset: refresh?.reset === true });
      }),
    ];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
  }

  set customContent(customContent) {
    if (customContent === untrack(() => this.state.$customContent.get())) {
      return;
    }
    // A different registration renders from scratch
    this._requestToken = null;
    this._root = null;
    this.state.$result.set(null);
    this.state.$error.set(null);
    this.state.$customContent.set(customContent);
  }

  get customContent() {
    return untrack(() => this.state.$customContent.get());
  }

  // Load the latest content - drop old dom nodes if reset: true
  async load(customContent, { reset = false } = {}) {
    if (reset) this._root?.reset();
    const requestToken = Symbol();
    this._requestToken = requestToken;
    let content = null;
    try {
      content = await customContent.display();
    } catch (error) {
      if (this._requestToken !== requestToken) return;
      this.state.$error.set(error.message ?? String(error));
      return;
    }
    if (this._requestToken !== requestToken) return;
    this.state.$error.set(null);
    this.state.$result.set({
      element: this.renderContent(customContent, content),
    });
  }

  renderContent(customContent, content) {
    if (content == null) return null;
    if (!this._root) {
      const renderer = this.pluginService.getRenderer(customContent.pluginId);
      this._root = renderer.createRoot();
    }
    return this._root.render(content);
  }
}

PluginCustomContent.register();
