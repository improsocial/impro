import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { classnames } from "/js/utils.js";

const SCROLL_FREEZE_FALLBACK_MS = 500;

class TabBar extends Component {
  static observedAttributes = ["active-tab", "full-width"];

  #unfreezeTimeout = null;

  connectedCallback() {
    if (this.initialized) return;
    this._tabs = this._tabs ?? [];
    this.lastScrolledTab = null;
    this.render();
    this.initialized = true;
  }

  attributeChangedCallback(name) {
    if (!this.initialized) return;
    this.render();
    // The host restores page scroll in the frame it renders the new tab
    if (name === "active-tab" && this.classList.contains("is-scroll-frozen")) {
      requestAnimationFrame(() => this.#unfreezeScroll());
    }
  }

  disconnectedCallback() {
    clearTimeout(this.#unfreezeTimeout);
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
            @click=${() => this.#handleTabClick(tab.value)}
          >
            <span class="tab-bar-button-label">${tab.label}</span>
          </button>`,
      )}`,
      this,
    );
    this.scrollActiveIntoView();
  }

  #handleTabClick(value) {
    if (value !== this.activeTab) {
      this.#freezeScroll();
    }
    this.dispatchEvent(new CustomEvent("tab-click", { detail: value }));
  }

  // Temporarily freeze horizontal scroll to avoid flashing on tab changes
  #freezeScroll() {
    if (this.fullWidth) return;
    this.classList.add("is-scroll-frozen");
    clearTimeout(this.#unfreezeTimeout);
    // In case the host never switches to the clicked tab
    this.#unfreezeTimeout = setTimeout(
      () => this.#unfreezeScroll(),
      SCROLL_FREEZE_FALLBACK_MS,
    );
  }

  #unfreezeScroll() {
    clearTimeout(this.#unfreezeTimeout);
    this.classList.remove("is-scroll-frozen");
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
