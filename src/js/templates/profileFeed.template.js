import { html } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { plusIconTemplate } from "/js/templates/icons/plusIcon.template.js";
import { linkToProfile } from "/js/navigation.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { authorBadgesTemplate } from "/js/templates/labelBadges.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { classnames } from "/js/utils.js";
import "/js/components/container-link.js";

// clickAction: "link" | "none" | callback
function itemWrapperTemplate({ actor, clickAction, isDisabled, children }) {
  if (typeof clickAction === "function") {
    return html`<button
      type="button"
      class=${classnames("profile-list-item", "profile-list-item-button", {
        "is-disabled": isDisabled,
      })}
      data-testid="profile-list-item-button"
      data-teststate=${isDisabled ? "disabled" : "enabled"}
      ?disabled=${isDisabled}
      @click=${() => {
        if (isDisabled) return;
        clickAction(actor);
      }}
    >
      ${children}
    </button>`;
  }
  if (clickAction === "none") {
    return html`<div class="profile-list-item">${children}</div>`;
  }
  return html`<container-link
    href=${linkToProfile(actor)}
    class="profile-list-item"
    >${children}</container-link
  >`;
}

function nameTemplate({ actor, doLink }) {
  const content = html`<span
    class="profile-list-item-display-name"
    data-testid="profile-list-item-display-name"
  >
    ${getDisplayName(actor)}${verificationBadgeTemplate({
      profile: actor,
    })}${automatedAccountBadgeTemplate({ profile: actor })}
  </span>`;
  if (doLink) {
    return html`<a class="profile-list-item-name" href="${linkToProfile(actor)}"
      >${content}</a
    >`;
  }
  return html`<span class="profile-list-item-name">${content}</span>`;
}

function followButtonRightItem({
  actor,
  isAuthenticated,
  currentUserDid,
  profileInteractionHandler,
}) {
  const isCurrentUser = currentUserDid && actor.did === currentUserDid;
  const isBlocking = !!actor.viewer?.blocking;
  const isBlockedBy = !!actor.viewer?.blockedBy;
  if (isCurrentUser || !isAuthenticated || isBlocking || isBlockedBy) {
    return null;
  }
  const isFollowing = !!actor.viewer?.following;
  const isFollowedBy = !!actor.viewer?.followedBy;
  return html`<button
    @click=${() => {
      if (!profileInteractionHandler) {
        console.warn("No profileInteractionHandler provided for follow button");
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
        ? html`${plusIconTemplate()} Follow back`
        : html`${plusIconTemplate()} Follow`}
  </button>`;
}

export function profileListItemTemplate({
  actor,
  isAuthenticated = false,
  currentUserDid = null,
  profileInteractionHandler = null,
  pluginService = null,
  rightItemTemplate,
  clickAction = "link",
  compact = false,
  isDisabled = false,
}) {
  const isFollowedBy = !!actor.viewer?.followedBy;
  const isBlocking = !!actor.viewer?.blocking;
  const isBlockedBy = !!actor.viewer?.blockedBy;
  const showsFollowsYou = isFollowedBy && !isBlocking && !isBlockedBy;
  const showsLabelBadges =
    actor.did !== currentUserDid && !!actor.badgeLabels?.length;
  const description = actor.description?.trim();
  // Render follow button by default
  const rightItem =
    rightItemTemplate === undefined
      ? (followButtonRightItem({
          actor,
          isAuthenticated,
          currentUserDid,
          profileInteractionHandler,
        }) ?? "")
      : rightItemTemplate === null
        ? ""
        : (rightItemTemplate(actor) ?? "");
  return itemWrapperTemplate({
    actor,
    clickAction,
    isDisabled,
    children: html`
      <div class="profile-list-item-row">
        ${avatarTemplate({
          author: actor,
          clickAction: clickAction === "link" ? "link" : "none",
        })}
        <div
          class="profile-list-item-body"
          data-testid="profile-list-item-body"
        >
          ${nameTemplate({ actor, doLink: clickAction === "link" })}
          <div
            class="profile-list-item-handle"
            data-testid="profile-list-item-handle"
          >
            @${actor.handle}
          </div>
        </div>
        ${rightItem}
      </div>
      ${showsFollowsYou && !compact
        ? html`<div class="profile-follows-you" data-testid="follows-you-badge">
            Follows you
          </div>`
        : ""}
      ${!compact
        ? html`<div class="profile-list-item-badges">
            ${authorBadgesTemplate({
              badgeLabels: showsLabelBadges ? actor.badgeLabels : null,
              did: actor.did,
              pluginService,
            })}
          </div>`
        : ""}
      ${!compact && description
        ? html`<div
            class="profile-list-item-description"
            data-testid="profile-list-item-description"
          >
            ${richTextTemplate({ text: description })}
          </div>`
        : ""}
    `,
  });
}

export function profileListItemSkeletonTemplate({ compact = false } = {}) {
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
    ${compact
      ? ""
      : html`<div class="profile-list-item-skeleton-bio">
          <div class="skeleton-line-short skeleton-animate"></div>
          <div class="skeleton-line-short skeleton-animate"></div>
        </div>`}
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
  pluginService = null,
  rightItemTemplate,
  clickAction = "link",
  compact = false,
  disabledProfiles = null,
}) {
  if (!compact && !pluginService) {
    console.warn(
      "profileFeedTemplate: non-compact feed rendered without a pluginService — plugin author badges won't render",
    );
  }
  if (!profiles) {
    return html`<div class="profile-list">
      ${Array.from({ length: skeletonCount }).map(() =>
        profileListItemSkeletonTemplate({ compact }),
      )}
    </div>`;
  }
  if (profiles.length === 0) {
    return html`<div class="feed-end-message" data-testid="feed-end-message">
      ${emptyMessage ?? "No profiles to show."}
    </div>`;
  }
  const disabledSet = disabledProfiles ? new Set(disabledProfiles) : null;
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
          pluginService,
          rightItemTemplate,
          clickAction,
          compact,
          isDisabled: disabledSet ? disabledSet.has(profile.did) : false,
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
