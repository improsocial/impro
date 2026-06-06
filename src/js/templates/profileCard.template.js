import { html, render } from "/js/lib/lit-html.js";
import {
  getPermalinkForProfile,
  linkToProfileFollowers,
  linkToProfileFollowing,
  linkToSearchPostsByProfile,
} from "/js/navigation.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { showToast } from "/js/toasts.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { chatIconTemplate } from "/js/templates/icons/chatIcon.template.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
import {
  formatLargeNumber,
  classnames,
  groupBy,
  noop,
  sortBy,
} from "/js/utils.js";
import { showSignInModal } from "/js/modals.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import "/js/components/lightbox-image-group.js";

function getBlueskyLinkForProfile(profile) {
  return `https://bsky.app/profile/${profile.handle}`;
}

function profileStatsTemplate({ profile }) {
  return html` <div class="profile-stats" data-testid="profile-stats">
    <a href="${linkToProfileFollowers(profile)}" class="profile-stat">
      <strong>${formatLargeNumber(profile.followersCount)}</strong>
      followers
    </a>
    <a href="${linkToProfileFollowing(profile)}" class="profile-stat">
      <strong>${formatLargeNumber(profile.followsCount)}</strong>
      following
    </a>
    <span class="profile-stat">
      <strong>${formatLargeNumber(profile.postsCount)}</strong> posts
    </span>
  </div>`;
}

function profileDescriptionTemplate({
  isLabeler,
  isBlocking,
  isBlockedBy,
  profile,
  richTextProfileDescription,
  labelerInfo,
}) {
  if (isBlocking) {
    return html`<div>
      <div class="profile-blocked-badge" data-testid="blocked-badge">
        You are blocking this user
      </div>
    </div>`;
  }
  if (isBlockedBy) {
    return html`<div>
      <div class="profile-blocked-badge" data-testid="blocked-by-badge">
        This user is blocking you
      </div>
    </div>`;
  }
  return html`
    ${!isLabeler ? profileStatsTemplate({ profile }) : null}
    ${richTextProfileDescription
      ? html`<div class="profile-description">
          ${richTextTemplate({
            text: richTextProfileDescription.text,
            facets: richTextProfileDescription.facets,
            truncateUrls: true,
          })}
        </div>`
      : ""}
    <!-- TODO: Add like button -->
  `;
}

// Match the default banner color in social-app
const LABELER_BANNER_FALLBACK_COLOR = "rgb(105, 0, 255)";

function profileContextMenuTemplate({
  profile,
  isAuthenticated,
  isCurrentUser,
  isLabeler,
  pluginItems,
  onClickFollow,
  onClickMute,
  onClickBlock,
  onClickAddToLists,
  onClickReport,
}) {
  const isFollowing = profile.viewer?.following;
  const pluginGroups = [...groupBy(pluginItems, "pluginId").values()];
  return html`
    <context-menu-item-group>
      <context-menu-item
        data-testid="menu-action-profile-open-in-bsky"
        @click=${() => {
          window.open(getBlueskyLinkForProfile(profile), "_blank");
        }}
      >
        Open in bsky.app
      </context-menu-item>
      <context-menu-item
        data-testid="menu-action-profile-copy-link"
        @click=${() => {
          navigator.clipboard.writeText(getPermalinkForProfile(profile));
          showToast("Link copied to clipboard", { style: "success" });
        }}
      >
        Copy link to profile
      </context-menu-item>
    </context-menu-item-group>
    ${isAuthenticated
      ? html`
          <context-menu-item
            data-testid="menu-action-profile-search-posts"
            @click=${() => {
              router.go(linkToSearchPostsByProfile(profile));
            }}
          >
            Search posts
          </context-menu-item>
        `
      : null}
    ${isAuthenticated && !isCurrentUser
      ? html`
          ${isLabeler
            ? html`
                <context-menu-item
                  data-testid="menu-action-profile-follow"
                  data-teststate=${isFollowing ? "following" : "not-following"}
                  @click=${() => {
                    onClickFollow(profile, !isFollowing);
                  }}
                >
                  ${isFollowing ? "Unfollow account" : "Follow account"}
                </context-menu-item>
              `
            : null}
          <context-menu-item-group>
            <context-menu-item
              data-testid="menu-action-profile-add-to-lists"
              @click=${() => {
                onClickAddToLists(profile);
              }}
            >
              Add to Lists
            </context-menu-item>
            <context-menu-item
              data-testid="menu-action-profile-mute"
              data-teststate=${profile.viewer?.muted ? "muted" : "unmuted"}
              @click=${() => {
                onClickMute(profile, !profile.viewer?.muted);
              }}
            >
              ${profile.viewer?.muted ? "Unmute Account" : "Mute Account"}
            </context-menu-item>
            <context-menu-item
              data-testid="menu-action-profile-block"
              data-teststate=${profile.viewer?.blocking
                ? "blocking"
                : "not-blocking"}
              @click=${() => {
                onClickBlock(profile, !profile.viewer?.blocking);
              }}
            >
              ${profile.viewer?.blocking ? "Unblock Account" : "Block Account"}
            </context-menu-item>
            <context-menu-item
              data-testid="menu-action-profile-report"
              @click=${() => {
                onClickReport(profile);
              }}
            >
              Report account
            </context-menu-item>
          </context-menu-item-group>
        `
      : null}
    ${pluginGroups.map(
      (group) => html`
        <context-menu-item-group>
          ${group.map(
            (item) => html`
              <context-menu-item @click=${() => item.invoke()}>
                ${item.title}
              </context-menu-item>
            `,
          )}
        </context-menu-item-group>
      `,
    )}
  `;
}

async function openProfileContextMenu(event, props) {
  const pluginItems = props.pluginService
    ? await props.pluginService.getProfileContextMenuItems(props.profile)
    : [];
  const menu = document.createElement("context-menu");
  menu.classList.add("profile-context-menu");
  const itemHolder = document.createElement("div");
  render(profileContextMenuTemplate({ ...props, pluginItems }), itemHolder);
  while (itemHolder.firstChild) menu.appendChild(itemHolder.firstChild);
  document.body.appendChild(menu);
  menu.open(event.clientX, event.clientY);
  menu
    .querySelector("dialog")
    .addEventListener("close", () => menu.remove(), { once: true });
}

export function profileCardTemplate({
  profile,
  richTextProfileDescription,
  isAuthenticated,
  isCurrentUser,
  profileChatStatus = null,
  isLabeler = false,
  showSubscribeButton = false,
  labelerInfo = null,
  isSubscribed = false,
  activitySubscription = null,
  onClickChat = noop,
  onClickFollow = noop,
  onClickMute = noop,
  onClickBlock = noop,
  onClickSubscribe = noop,
  onClickPostNotifications = noop,
  onClickAddToLists = noop,
  onClickReport = noop,
  onClickEditProfile = noop,
  pluginService = null,
}) {
  const isFollowing = profile.viewer?.following;
  const isFollowedBy = profile.viewer?.followedBy;
  const isBlocking = !!profile.viewer?.blocking;
  const isBlockedBy = !!profile.viewer?.blockedBy;
  const canChat = profileChatStatus?.canChat || !!profileChatStatus?.convo;
  return html`<div class="profile-card">
    <div
      class="profile-banner-container"
      style="${!profile.banner && isLabeler
        ? `background-color: ${LABELER_BANNER_FALLBACK_COLOR}`
        : ""}"
    >
      ${profile.banner
        ? html`
            <lightbox-image-group hide-alt-text="true">
              <img
                src="${profile.banner}"
                alt="${profile.displayName} banner"
                class=${classnames("profile-banner", {
                  "profile-banner--blurred": !!profile.blurLabel,
                })}
              />
            </lightbox-image-group>
          `
        : ""}
    </div>
    <div class="profile-header">
      <div class="profile-top-row">
        ${avatarTemplate({
          author: profile,
          clickAction: "lightbox",
        })}
        ${!isCurrentUser && !isLabeler && isAuthenticated && !isBlockedBy
          ? html` ${isFollowing
              ? html`<button
                  class="rounded-button bell-button"
                  data-testid="post-notifications-button"
                  title="${activitySubscription?.post
                    ? "Manage post notifications"
                    : "Get notified of new posts"}"
                  @click=${() => {
                    onClickPostNotifications(profile);
                  }}
                >
                  ${notificationsIconTemplate({
                    filled: !!activitySubscription?.post,
                  })}
                </button>`
              : ""}
            ${isFollowing
              ? html`<button
                  class="rounded-button chat-button"
                  data-testid="chat-button"
                  title="Go to chat"
                  ?disabled=${!canChat}
                  @click=${() => {
                    onClickChat(profile);
                  }}
                >
                  ${chatIconTemplate()}
                </button>`
              : ""}`
          : null}
        ${(() => {
          if (isCurrentUser) {
            return html`<button
              class="rounded-button profile-edit-button"
              data-testid="edit-profile-button"
              @click=${() => onClickEditProfile()}
            >
              Edit Profile
            </button>`;
          }
          if (isBlockedBy && !isBlocking) {
            return null;
          }
          if (isBlocking) {
            return html`<button
              @click=${() => onClickBlock(profile, false)}
              class="rounded-button profile-following-button"
              data-testid="unblock-button"
            >
              Unblock
            </button>`;
          }
          if (isLabeler) {
            if (showSubscribeButton) {
              return html`<button
                @click=${() => {
                  if (!isAuthenticated) {
                    return showSignInModal();
                  }
                  onClickSubscribe(profile, !isSubscribed, labelerInfo);
                }}
                class=${classnames("rounded-button  profile-following-button", {
                  "rounded-button-primary": !isSubscribed,
                })}
                data-testid="subscribe-button"
                data-teststate=${isSubscribed ? "subscribed" : "not-subscribed"}
              >
                ${isSubscribed ? "Subscribed" : "+ Subscribe"}
              </button>`;
            } else {
              return null;
            }
          }
          return html`<button
            @click=${() => {
              if (!isAuthenticated) {
                return showSignInModal();
              }
              onClickFollow(profile, !isFollowing);
            }}
            class=${classnames("rounded-button  profile-following-button", {
              "rounded-button-primary": !isFollowing,
            })}
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
          </button>`;
        })()}
        <button
          class="rounded-button ellipsis-button"
          @click=${(e) => {
            openProfileContextMenu(e, {
              profile,
              isAuthenticated,
              isCurrentUser,
              isLabeler,
              pluginService,
              onClickFollow,
              onClickMute,
              onClickBlock,
              onClickAddToLists,
              onClickReport,
            });
          }}
        >
          <span>...</span>
        </button>
      </div>
      <div class="profile-info">
        <h1 class="profile-name" data-testid="profile-name">
          ${getDisplayName(profile)}${verificationBadgeTemplate({
            profile,
          })}${automatedAccountBadgeTemplate({ profile })}
        </h1>
        <div class="profile-handle-row">
          ${isFollowedBy && !isBlocking && !isBlockedBy
            ? html`<div
                class="profile-follows-you"
                data-testid="follows-you-badge"
              >
                Follows you
              </div>`
            : ""}
          <div class="profile-handle">@${profile.handle}</div>
        </div>
      </div>
    </div>
    ${profileDescriptionTemplate({
      isBlocking,
      isBlockedBy,
      isLabeler,
      labelerInfo,
      profile,
      richTextProfileDescription,
    })}
  </div>`;
}
