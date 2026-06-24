import { html } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { linkToProfile } from "/js/navigation.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { classnames } from "/js/utils.js";
import "/js/components/container-link.js";

export function profileListItemTemplate({
  actor,
  isAuthenticated = false,
  currentUserDid = null,
  profileInteractionHandler = null,
  showFollowButton = true,
}) {
  const displayName = getDisplayName(actor);
  const isCurrentUser = currentUserDid && actor.did === currentUserDid;
  const isFollowing = !!actor.viewer?.following;
  const isFollowedBy = !!actor.viewer?.followedBy;
  const isBlocking = !!actor.viewer?.blocking;
  const isBlockedBy = !!actor.viewer?.blockedBy;
  const showsFollowsYou = isFollowedBy && !isBlocking && !isBlockedBy;
  const showsFollowControl =
    showFollowButton &&
    !isCurrentUser &&
    isAuthenticated &&
    !isBlocking &&
    !isBlockedBy;
  const description = actor.description?.trim();
  return html`<container-link
    href=${linkToProfile(actor)}
    class="profile-list-item"
  >
    <div class="profile-list-item-row">
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
      ${showsFollowControl
        ? html`<button
            @click=${() => {
              if (!profileInteractionHandler) {
                console.warn(
                  "No profileInteractionHandler provided for follow button",
                );
                return;
              }
              profileInteractionHandler.handleFollow(actor, !isFollowing);
            }}
            class=${classnames(
              "rounded-button profile-following-button profile-list-item-follow",
              {
                "rounded-button-primary": !isFollowing,
              },
            )}
            data-testid="follow-button"
            data-teststate=${isFollowing
              ? "following"
              : isFollowedBy
                ? "follow-back"
                : "follow"}
          >
            ${isFollowing
              ? "Following"
              : isFollowedBy
                ? "+ Follow back"
                : "+ Follow"}
          </button>`
        : ""}
    </div>
    ${showsFollowsYou
      ? html`<div class="profile-follows-you" data-testid="follows-you-badge">
          Follows you
        </div>`
      : ""}
    ${description
      ? html`<div
          class="profile-list-item-description"
          data-testid="profile-list-item-description"
        >
          ${richTextTemplate({ text: description })}
        </div>`
      : ""}
  </container-link>`;
}

export function profileListItemSkeletonTemplate() {
  return html`<div class="profile-list-item profile-skeleton">
    <div class="profile-list-item-row">
      <div
        class="skeleton-avatar skeleton-animate"
        data-testid="skeleton-avatar"
      ></div>
      <div class="profile-list-item-body">
        <div class="skeleton-line-short skeleton-animate"></div>
        <div class="skeleton-line-shorter skeleton-animate"></div>
      </div>
    </div>
    <div class="profile-list-item-skeleton-bio">
      <div class="skeleton-line-short skeleton-animate"></div>
      <div class="skeleton-line-short skeleton-animate"></div>
    </div>
  </div>`;
}

export function profileFeedTemplate({
  profiles,
  hasMore,
  onLoadMore,
  emptyMessage = null,
  skeletonCount = 10,
  showEndMessage = false,
  isAuthenticated = false,
  currentUserDid = null,
  profileInteractionHandler = null,
  showFollowButton = true,
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
    @load-more=${async (event) => {
      if (hasMore && onLoadMore) {
        await onLoadMore();
        event.detail.resume();
      }
    }}
  >
    <div class="profile-list" data-testid="profile-feed">
      ${profiles.map((profile) =>
        profileListItemTemplate({
          actor: profile,
          isAuthenticated,
          currentUserDid,
          profileInteractionHandler,
          showFollowButton,
        }),
      )}
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
