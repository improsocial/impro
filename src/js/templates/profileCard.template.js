import { html } from "/js/lib/lit-html.js";
import {
  getPermalinkForProfile,
  linkToProfileFollowers,
  linkToProfileFollowing,
} from "/js/navigation.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { showToast } from "/js/toasts.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { chatIconTemplate } from "/js/templates/icons/chatIcon.template.js";
import { formatLargeNumber, classnames, noop, sortBy } from "/js/utils.js";
import { showSignInModal } from "/js/modals.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/lightbox-image-group.js";

function getBlueskyLinkForProfile(profile) {
  return `https://bsky.app/profile/${profile.handle}`;
}

export function profileCardTemplate({
  profile,
  richTextProfileDescription,
  isAuthenticated,
  isCurrentUser,
  profileChatStatus = null,
  isLabeler = false,
  isSubscribed = false,
  onClickChat = noop,
  onClickFollow = noop,
  onClickMute = noop,
  onClickBlock = noop,
  onClickSubscribe = noop,
}) {
  const isFollowing = profile.viewer?.following;
  const isBlocked = !!profile.viewer?.blocking;
  const canChat = profileChatStatus?.canChat || !!profileChatStatus?.convo;
  return html`<div class="profile-card">
    <div class="profile-banner-container">
      ${profile.banner
        ? html`
            <lightbox-image-group hide-alt-text="true">
              <img
                src="${profile.banner}"
                alt="${profile.displayName} banner"
                class="profile-banner"
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
        ${!isCurrentUser && isAuthenticated
          ? html`<button
              class="rounded-button chat-button"
              ?disabled=${!canChat}
              title="Go to chat"
              @click=${() => {
                onClickChat(profile);
              }}
            >
              ${chatIconTemplate()}
            </button>`
          : null}
        ${(() => {
          if (isCurrentUser) {
            return null;
          }
          if (isBlocked) {
            return html`<button
              @click=${() => onClickBlock(profile, false)}
              class="rounded-button profile-following-button"
            >
              Unblock
            </button>`;
          }
          if (isLabeler) {
            return html`<button
              @click=${() => {
                if (!isAuthenticated) {
                  return showSignInModal();
                }
                onClickSubscribe(profile, !isSubscribed);
              }}
              class=${classnames("rounded-button  profile-following-button", {
                "rounded-button-primary": !isSubscribed,
              })}
            >
              ${isSubscribed ? "Subscribed" : "+ Subscribe"}
            </button>`;
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
          >
            ${isFollowing ? "Following" : "+ Follow"}
          </button>`;
        })()}
        <button
          class="rounded-button ellipsis-button"
          @click=${function (e) {
            const contextMenu = this.nextElementSibling;
            contextMenu.open(e.clientX, e.clientY);
          }}
        >
          <span>...</span>
        </button>
        <context-menu>
          <context-menu-item
            @click=${() => {
              window.open(getBlueskyLinkForProfile(profile), "_blank");
            }}
          >
            Open in bsky.app
          </context-menu-item>
          <context-menu-item
            @click=${() => {
              navigator.clipboard.writeText(getPermalinkForProfile(profile));
              showToast("Link copied to clipboard");
            }}
          >
            Copy link to profile
          </context-menu-item>
          ${isAuthenticated && !isCurrentUser
            ? html`
                ${isLabeler
                  ? html`
                      <context-menu-item
                        @click=${() => {
                          onClickFollow(profile, !isFollowing);
                        }}
                      >
                        ${isFollowing ? "Unfollow account" : "Follow account"}
                      </context-menu-item>
                    `
                  : null}
                <context-menu-item
                  @click=${() => {
                    onClickMute(profile, !profile.viewer?.muted);
                  }}
                >
                  ${profile.viewer?.muted ? "Unmute Account" : "Mute Account"}
                </context-menu-item>
                <context-menu-item
                  @click=${() => {
                    onClickBlock(profile, !profile.viewer?.blocking);
                  }}
                >
                  ${profile.viewer?.blocking
                    ? "Unblock Account"
                    : "Block Account"}
                </context-menu-item>
              `
            : null}
        </context-menu>
      </div>
      <div class="profile-info">
        <h1 class="profile-name">${getDisplayName(profile)}</h1>
        <div class="profile-handle-row">
          ${profile.viewer?.followedBy && !isBlocked
            ? html`<div class="profile-follows-you">Follows you</div>`
            : ""}
          <div class="profile-handle">@${profile.handle}</div>
        </div>
      </div>
    </div>
    ${isBlocked
      ? html`<div><div class="profile-blocked-badge">User Blocked</div></div>`
      : html`
          <div class="profile-stats">
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
          </div>
          ${richTextProfileDescription
            ? html`<div class="profile-description">
                ${richTextTemplate({
                  text: richTextProfileDescription.text,
                  facets: richTextProfileDescription.facets,
                })}
              </div>`
            : ""}
        `}
  </div>`;
}
