import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import { classnames } from "/js/utils.js";
import { cdnImageUrl } from "/js/dataHelpers.js";
import { homeIconTemplate } from "/js/templates/icons/homeIcon.template.js";
import { hashtagIconTemplate } from "/js/templates/icons/hashtagIcon.template.js";

const SKELETON_COUNT = 5;

function pinnedItemAvatarTemplate({ item }) {
  if (item.type === "timeline") {
    return html`<span class="pinned-feeds-item-icon pinned-feeds-timeline-icon"
      >${homeIconTemplate({ filled: true })}</span
    >`;
  }
  const fallback =
    item.type === "list"
      ? "/img/list-avatar-fallback.svg"
      : "/img/feed-avatar-fallback.svg";
  return html`<img
    src=${cdnImageUrl(item.data.avatar) || fallback}
    alt=""
    class="pinned-feeds-item-avatar"
  />`;
}

function pinnedItemTemplate({ item, isCurrent, onSelect }) {
  return html`<button
    class=${classnames("pinned-feeds-item", { active: isCurrent })}
    data-testid="pinned-feeds-item"
    title=${item.displayName}
    @click=${onSelect}
  >
    ${pinnedItemAvatarTemplate({ item })}
    <span class="pinned-feeds-item-label">${item.displayName}</span>
  </button>`;
}

function pinnedFeedsSkeletonTemplate() {
  return html`${Array.from(
    { length: SKELETON_COUNT },
    (_, index) =>
      html`<div
        class="pinned-feeds-item pinned-feeds-item-skeleton"
        data-testid="pinned-feeds-skeleton"
      >
        <span
          class="skeleton-animate pinned-feeds-skeleton-bar"
          style="width: ${index % 2 === 0 ? 60 : 80}%"
        ></span>
      </div>`,
  )}`;
}

function pinnedFeedsPaneTemplate({
  pinnedItems,
  isLoading,
  currentFeedUri,
  moreFeedsActive,
  onSelect,
}) {
  return html`<nav class="pinned-feeds-pane" data-testid="pinned-feeds-pane">
    ${isLoading
      ? pinnedFeedsSkeletonTemplate()
      : pinnedItems.map((item) =>
          pinnedItemTemplate({
            item,
            isCurrent: item.uri === currentFeedUri,
            onSelect: () => onSelect(item.uri),
          }),
        )}
    <a
      class=${classnames("pinned-feeds-item pinned-feeds-more", {
        active: moreFeedsActive,
      })}
      href="/feeds"
      data-testid="pinned-feeds-more"
    >
      <span class="pinned-feeds-item-icon pinned-feeds-more-icon"
        >${hashtagIconTemplate()}</span
      >
      <span class="pinned-feeds-item-label">Manage feeds</span>
    </a>
  </nav>`;
}

class PinnedFeedsPane extends Component {
  static get observedAttributes() {
    return ["show-selected", "more-feeds-active"];
  }

  attributeChangedCallback() {
    if (this.initialized) {
      this.render();
    }
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.dataLayer) {
      throw new Error("pinned-feeds-pane requires a dataLayer property");
    }
    this.$failed = new Signal.State(false);
    this._disposers = [effect(() => this.render())];
    this.load();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
    this.initialized = false;
  }

  render() {
    const pinnedItems = this.dataLayer.derived.$hydratedPinnedItems.get();
    const failed = this.$failed.get();
    const selectedFeedUri = this.dataLayer.derived.$selectedFeedUri.get();
    const currentFeedUri = this.hasAttribute("show-selected")
      ? selectedFeedUri
      : null;
    if (failed) {
      render(html``, this);
      return;
    }
    render(
      pinnedFeedsPaneTemplate({
        pinnedItems: pinnedItems ?? [],
        isLoading: pinnedItems === null,
        currentFeedUri,
        moreFeedsActive: this.hasAttribute("more-feeds-active"),
        onSelect: (feedUri) => this.handleSelect(feedUri),
      }),
      this,
    );
  }

  handleSelect(feedUri) {
    // On the home page, a "home-feed-select" event lets the view run its
    // animated tab switch. From elsewhere, set the selection first so the home
    // view's first paint already shows the right feed, then navigate; the view
    // picks up the changed selection on page-show.
    if (window.location.pathname === "/") {
      window.dispatchEvent(
        new CustomEvent("home-feed-select", { detail: feedUri }),
      );
      return;
    }
    this.dataLayer.mutations.setSelectedFeedUri(feedUri);
    window.router.go("/");
  }

  async load() {
    try {
      await this.dataLayer.declarative.ensurePinnedItems();
    } catch (error) {
      console.warn("Could not load pinned feeds", error);
      this.$failed.set(true);
    }
  }
}

PinnedFeedsPane.register();
