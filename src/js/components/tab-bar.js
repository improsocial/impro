import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { classnames } from "/js/utils.js";

class TabBar extends Component {
  static observedAttributes = ["active-tab", "full-width"];

  connectedCallback() {
    if (this.initialized) return;
    this._tabs = this._tabs ?? [];
    this.lastScrolledTab = null;
    this.render();
    this.initialized = true;
  }

  attributeChangedCallback() {
    if (!this.initialized) return;
    this.render();
  }

  set tabs(tabs) {
    this._tabs = tabs ?? [];
    if (this.initialized) this.render();
  }

  get tabs() {
    return this._tabs;
  }

  get activeTab() {
    return this.getAttribute("active-tab");
  }

  get fullWidth() {
    return this.hasAttribute("full-width");
  }

  render() {
    const activeTab = this.activeTab;
    render(
      html`${this._tabs.map(
        (tab) =>
          html`<button
            class=${classnames("tab-bar-button", {
              active: activeTab === tab.value,
            })}
            data-testid="tab-${tab.value}"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent("tab-click", { detail: tab.value }),
              )}
          >
            <span class="tab-bar-button-label">${tab.label}</span>
          </button>`,
      )}`,
      this,
    );
    this.scrollActiveIntoView();
  }

  scrollActiveIntoView() {
    if (this.fullWidth) return;
    const activeTab = this.activeTab;
    if (activeTab === this.lastScrolledTab) return;
    const activeButton = this.querySelector(".tab-bar-button.active");
    if (!activeButton) return;
    const behavior = this.lastScrolledTab === null ? "instant" : "smooth";
    this.lastScrolledTab = activeTab;
    requestAnimationFrame(() => {
      activeButton.scrollIntoView({
        behavior,
        inline: "nearest",
        block: "nearest",
      });
    });
  }
}

TabBar.register();
