import { html } from "/js/lib/lit-html.js";
import { getDisplayName } from "/js/dataHelpers.js";
import {
  classnames,
  formatLargeNumber,
  formatNumNotifications,
} from "/js/utils.js";
import { homeIconTemplate } from "/js/templates/icons/homeIcon.template.js";
import { userIconTemplate } from "/js/templates/icons/userIcon.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { chatIconTemplate } from "/js/templates/icons/chatIcon.template.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
import { feedIconTemplate } from "/js/templates/icons/feedIcon.template.js";
import { bookmarkIconTemplate } from "/js/templates/icons/bookmarkIcon.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { editIconTemplate } from "/js/templates/icons/editIcon.template.js";
import {
  linkToProfileFollowers,
  linkToProfileFollowing,
} from "/js/navigation.js";
import "/js/components/animated-sidebar.js";

function loggedOutSidebarTemplate() {
  return html`
    <animated-sidebar class="logged-out-sidebar">
      <div class="sidebar-content">
        <div class="sidebar-header">
          <h1>IMPRO</h1>
          <p>An extensible Bluesky client</p>
          <a href="/login" class="rounded-button rounded-button-primary"
            >Sign in</a
          >
        </div>
      </div>
    </animated-sidebar>
  `;
}

export function sidebarTemplate({
  isAuthenticated,
  currentUser,
  activeNavItem = null,
  numNotifications = 0,
  numChatNotifications = 0,
  onClickActiveItem,
  onClickComposeButton,
}) {
  if (!isAuthenticated) {
    return loggedOutSidebarTemplate();
  }

  const menuItems = [
    {
      id: "home",
      icon: homeIconTemplate,
      label: "Home",
      url: "/",
    },
    {
      id: "search",
      icon: searchIconTemplate,
      label: "Search",
      url: "/search",
    },
    {
      id: "notifications",
      icon: notificationsIconTemplate,
      label: "Notifications",
      url: "/notifications",
      badge:
        numNotifications > 0 ? formatNumNotifications(numNotifications) : null,
    },
    {
      id: "chat",
      icon: chatIconTemplate,
      label: "Chat",
      url: "/messages",
      badge:
        numChatNotifications > 0
          ? formatNumNotifications(numChatNotifications)
          : null,
    },
    {
      id: "feeds",
      icon: feedIconTemplate,
      label: "Feeds",
      url: "/feeds",
    },
    {
      id: "bookmarks",
      icon: bookmarkIconTemplate,
      label: "Saved",
      url: "/bookmarks",
    },
    {
      id: "profile",
      icon: userIconTemplate,
      label: "Profile",
      url: currentUser ? `/profile/${currentUser.did}` : "",
      disabled: !currentUser,
    },
    {
      id: "settings",
      icon: settingsIconTemplate,
      label: "Settings",
      url: "/settings",
    },
  ];

  const displayName = currentUser ? getDisplayName(currentUser) : null;
  const handle = currentUser?.handle ? "@" + currentUser.handle : null;
  const followersCount = currentUser?.followersCount ?? null;
  const followsCount = currentUser?.followsCount ?? null;

  return html`
    <animated-sidebar>
      <!-- Profile Section -->
      <div class="sidebar-profile">
        <div class="sidebar-profile-avatar">
          ${currentUser
            ? html`${avatarTemplate({ author: currentUser })}`
            : html`<div class="avatar-placeholder"></div>`}
        </div>
        <div class="sidebar-profile-info">
          <div class="sidebar-profile-name">
            ${displayName || html`<span>&nbsp;</span>`}
          </div>
          <div class="sidebar-profile-handle">
            ${handle || html`<span>&nbsp;</span>`}
          </div>
        </div>
        <div class="sidebar-profile-stats">
          <a
            href="${currentUser ? linkToProfileFollowers(currentUser) : "#"}"
            @click=${(e) => {
              if (currentUser) {
                const sidebar = e.target.closest("animated-sidebar");
                sidebar.close();
              }
            }}
          >
            <strong
              >${followersCount !== null
                ? formatLargeNumber(followersCount)
                : ""}</strong
            >
            followers
          </a>
          <span class="sidebar-profile-separator">·</span>
          <a
            href="${currentUser ? linkToProfileFollowing(currentUser) : "#"}"
            @click=${(e) => {
              if (currentUser) {
                const sidebar = e.target.closest("animated-sidebar");
                sidebar.close();
              }
            }}
          >
            <strong
              >${followsCount !== null
                ? formatLargeNumber(followsCount)
                : ""}</strong
            >
            following
          </a>
        </div>
      </div>

      <div class="sidebar-divider"></div>

      <!-- Menu Items -->
      <nav class="sidebar-nav">
        ${menuItems.map(
          (item) => html`
            <a
              href="${item.url}"
              class=${classnames("sidebar-nav-item", {
                disabled: item.disabled,
              })}
              @click=${function (e) {
                // Handle active item click
                if (activeNavItem === item.id) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onClickActiveItem) {
                    onClickActiveItem(item.id);
                  } else {
                    window.scrollTo(0, 0);
                  }
                }
                // Close sidebar
                const sidebar = this.closest("animated-sidebar");
                sidebar.close();
              }}
            >
              <span class="sidebar-nav-icon"
                >${item.icon({ filled: activeNavItem === item.id })}
                ${item.badge
                  ? html`<div class="status-badge">
                      <div class="status-badge-text">${item.badge}</div>
                    </div>`
                  : ""}
              </span>
              <span class="sidebar-nav-label">${item.label}</span>
            </a>
          `
        )}
      </nav>

      ${onClickComposeButton
        ? html`<button
            class="sidebar-compose-button"
            @click=${() => onClickComposeButton()}
          >
            ${editIconTemplate()} <span>New Post</span>
          </button>`
        : ""}

      <!-- <div class="sidebar-divider"></div> -->

      <!-- 
        <div class="sidebar-footer">
          <a href="#" class="sidebar-footer-link">Terms of Service</a>
          <a href="#" class="sidebar-footer-link">Privacy Policy</a>
        </div>
        -->
    </animated-sidebar>
  `;
}
