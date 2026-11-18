import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import { classnames, whenElementVisible } from "/js/utils.js";
import { cdnImageUrl } from "/js/dataHelpers.js";
import { linkToFeed } from "/js/navigation.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { sidebarPaneTemplate } from "/js/templates/sidebarPane.template.js";
import { fillableIconTemplate } from "/js/templates/fillableIcon.template.js";
import { feedLikeCountTemplate } from "/js/templates/feedLikeCount.template.js";
import "/js/components/app-icon.js";
import "/js/components/container-link.js";

const SUGGESTED_FEED_LIMIT = 3;
const SUGGESTED_FEED_FETCH_LIMIT = 10;

function suggestedFeedRowTemplate({ feed, isPinned, onTogglePin }) {
  return html`<container-link
    class="suggested-feed-row"
    data-testid="suggested-feed-row"
    href=${linkToFeed(feed)}
  >
    <img
      class="suggested-feed-avatar"
      src=${cdnImageUrl(feed.avatar) || "/img/feed-avatar-fallback.svg"}
      alt=""
    />
    <div class="suggested-feed-text">
      <div class="suggested-feed-title" data-testid="suggested-feed-title">
        ${feed.displayName}
      </div>
      <div class="suggested-feed-meta">
        <span
          class="suggested-feed-meta-item"
          data-testid="suggested-feed-creator"
          >@${feed.creator.handle}</span
        >${feed.likeCount
          ? feedLikeCountTemplate({
              likeCount: feed.likeCount,
              className: "suggested-feed-meta-item",
            })
          : ""}
      </div>
    </div>
    <button
      class=${classnames(
        "rounded-button pin-feed-button suggested-feed-pin-button",
        {
          pinned: isPinned,
        },
      )}
      data-testid="suggested-feed-pin-button"
      data-teststate=${isPinned ? "pinned" : "not-pinned"}
      aria-label=${isPinned ? "Unpin feed" : "Pin feed"}
      aria-pressed=${isPinned ? "true" : "false"}
      title=${isPinned ? "Unpin feed" : "Pin feed"}
      @click=${(event) => {
        event.preventDefault();
        event.stopPropagation();
        onTogglePin();
      }}
    >
      ${fillableIconTemplate({ icon: "pin", filled: isPinned })}
      ${isPinned ? "Unpin" : "Pin"}
    </button>
  </container-link>`;
}

function suggestedFeedSkeletonTemplate() {
  return html`<div
    class="suggested-feed-row suggested-feed-row-skeleton"
    data-testid="suggested-feed-skeleton"
  >
    <span class="suggested-feed-avatar skeleton-animate"></span>
    <div class="suggested-feed-text">
      <div class="suggested-feed-title">
        &#8203;
        <span class="skeleton-animate suggested-feed-skeleton-bar"></span>
      </div>
      <div class="suggested-feed-meta">
        &#8203;
        <span
          class="skeleton-animate suggested-feed-skeleton-bar suggested-feed-skeleton-bar-meta"
        ></span>
      </div>
    </div>
  </div>`;
}

function suggestedFeedsPaneTemplate({
  feeds,
  preferences,
  isLoading,
  onDismiss,
  onTogglePin,
}) {
  return sidebarPaneTemplate({
    className: "suggested-feeds-pane",
    testId: "suggested-feeds-pane",
    title: "Suggested feeds",
    dismissLabel: "Hide suggested feeds",
    dismissTestId: "suggested-feeds-dismiss-button",
    onDismiss,
    children: html`<div class="suggested-feeds-list">
      ${isLoading
        ? Array.from({ length: SUGGESTED_FEED_LIMIT }, () =>
            suggestedFeedSkeletonTemplate(),
          )
        : feeds.map((feed) => {
            const isPinned = preferences.isFeedPinned(feed.uri);
            return suggestedFeedRowTemplate({
              feed,
              isPinned,
              onTogglePin: () => onTogglePin(feed, !isPinned),
            });
          })}
    </div>`,
  });
}

class SuggestedFeedsPane extends Component {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.dataLayer) {
      throw new Error("suggested-feeds-pane requires a dataLayer property");
    }
    this.$failed = new Signal.State(false);
    this._disposers = [
      effect(() => {
        const hidden = this.dataLayer.derived.$suggestedFeedsHidden.get();
        const failed = this.$failed.get();
        const suggestedFeeds = this.dataLayer.derived.$suggestedFeeds.get();
        const preferences = this.dataLayer.derived.$preferences.get();
        const isLoading = !failed && suggestedFeeds === null;
        const feeds = (suggestedFeeds ?? []).slice(0, SUGGESTED_FEED_LIMIT);
        if (hidden || failed || (!isLoading && feeds.length === 0)) {
          render(html``, this);
          return;
        }
        render(
          suggestedFeedsPaneTemplate({
            feeds,
            preferences,
            isLoading,
            onDismiss: () => this.handleHide(),
            onTogglePin: (feed, doPin) =>
              this.feedInteractionHandler.handlePinFeed(feed.uri, doPin),
          }),
          this,
        );
      }),
      whenElementVisible(this, () => this.load()),
    ];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
    this.initialized = false;
  }

  async load() {
    try {
      await this.dataLayer.requests.loadSuggestedFeeds({
        limit: SUGGESTED_FEED_FETCH_LIMIT,
      });
    } catch (error) {
      console.warn("Could not load suggested feeds", error);
    }
    if (this.dataLayer.derived.$suggestedFeeds.get() === null) {
      this.$failed?.set(true);
    }
  }

  async handleHide() {
    await confirmModal(
      "You can turn this back on in Content and Media settings.",
      {
        title: "Hide suggested feeds?",
        confirmButtonText: "Hide",
        onConfirm: () => this.dataLayer.mutations.setSuggestedFeedsHidden(true),
      },
    );
  }
}

SuggestedFeedsPane.register();
