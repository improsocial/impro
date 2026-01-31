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
import { showInfoModal } from "/js/modals.js";

function showAboutModal() {
  showInfoModal({
    title: "About Impro",
    message: html`<div>
      Impro is an <strong>alternative Bluesky client</strong> built from the
      ground up to be extensible and customizable. You can find more information
      about the project, including the full source code, at our
      <a href="https://github.com/improsocial/impro/blob/main/README.md"
        >GitHub repository</a
      >.
    </div>`,
    confirmButtonText: "Got it!",
  });
}

function sidebarNavTemplate({ menuItems, activeNavItem, onClickActiveItem }) {
  return html`
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
        `,
      )}
    </nav>
  `;
}

function loggedOutSidebarTemplate({ activeNavItem, onClickActiveItem }) {
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
  ];
  return html`
    <animated-sidebar class="logged-out-sidebar">
      <div class="sidebar-header">
        <a href="/" class="sidebar-title"><h1>IMPRO</h1></a>
      </div>
      ${sidebarNavTemplate({ menuItems, activeNavItem, onClickActiveItem })}
      <a href="/login" class="square-button primary-button login-button"
        >Sign in</a
      >
      <button
        class="sidebar-about-link sidebar-text-link"
        @click=${() => {
          showAboutModal();
        }}
      >
        About
      </button>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-footer">
        <a href="/tos.html" class="sidebar-text-link" data-external="true"
          >Terms</a
        >
        <a href="/privacy.html" class="sidebar-text-link" data-external="true"
          >Privacy Policy</a
        >
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
    return loggedOutSidebarTemplate({ activeNavItem, onClickActiveItem });
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
      ${sidebarNavTemplate({ menuItems, activeNavItem, onClickActiveItem })}
      ${onClickComposeButton
        ? html`<button
            class="sidebar-compose-button"
            @click=${() => onClickComposeButton()}
          >
            ${editIconTemplate()} <span>New Post</span>
          </button>`
        : ""}
      <div class="sidebar-spacer"></div>
      <div class="sidebar-footer">
        <a
          href="https://github.com/improsocial/impro/issues"
          class="sidebar-text-link"
          >Bug report
        </a>
      </div>
    </animated-sidebar>
  `;
}
