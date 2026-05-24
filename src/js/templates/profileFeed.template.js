import { html } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { linkToProfile } from "/js/navigation.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { getDisplayName } from "/js/dataHelpers.js";

export function profileListItemTemplate({ actor }) {
  const displayName = getDisplayName(actor);
  return html`<div
    @click=${(e) => {
      if (e.target.closest("a")) return;
      window.router.go(linkToProfile(actor));
    }}
    class="profile-list-item"
  >
    ${avatarTemplate({ author: actor })}
    <div class="profile-list-item-body" data-testid="profile-list-item-body">
      <a class="profile-list-item-name" href="${linkToProfile(actor)}">
        <span
          class="profile-list-item-display-name"
          data-testid="profile-list-item-display-name"
        >
          ${displayName}${verificationBadgeTemplate({
            profile: actor,
          })}${automatedAccountBadgeTemplate({ profile: actor })}
        </span>
      </a>
      <div
        class="profile-list-item-handle"
        data-testid="profile-list-item-handle"
      >
        @${actor.handle}
      </div>
    </div>
  </div>`;
}

export function profileListItemSkeletonTemplate() {
  return html`<div class="profile-list-item profile-skeleton">
    <div
      class="skeleton-avatar skeleton-animate"
      data-testid="skeleton-avatar"
    ></div>
    <div class="profile-list-item-body">
      <div class="skeleton-line-short skeleton-animate"></div>
      <div class="skeleton-line-shorter skeleton-animate"></div>
    </div>
  </div>`;
}

export function profileFeedTemplate({
  profiles,
  hasMore,
  onLoadMore,
  emptyMessage = null,
  skeletonCount = 10,
  showEndMessage = true,
}) {
  if (!profiles) {
    return html`<div class="profile-list">
      ${Array.from({ length: skeletonCount }).map(() =>
        profileListItemSkeletonTemplate(),
      )}
    </div>`;
  }
  if (profiles.length === 0) {
    return html`<div class="feed-end-message" data-testid="feed-end-message">
      ${emptyMessage ?? "No profiles."}
    </div>`;
  }
  return html`<infinite-scroll-container
    lookahead="2500px"
    @load-more=${async (e) => {
      if (hasMore && onLoadMore) {
        await onLoadMore();
        e.detail.resume();
      }
    }}
  >
    <div class="profile-list" data-testid="profile-feed">
      ${profiles.map((profile) => profileListItemTemplate({ actor: profile }))}
    </div>
    ${hasMore
      ? html`<div
          class="feed-loading-indicator"
          data-testid="feed-loading-indicator"
        >
          <div class="loading-spinner"></div>
        </div>`
      : showEndMessage
        ? html`<div class="feed-end-message" data-testid="feed-end-message">
            End of feed
          </div>`
        : null}
  </infinite-scroll-container>`;
}
