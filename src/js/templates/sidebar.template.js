import { html, ref } from "/js/lib/lit-html.js";
import { getDisplayName } from "/js/dataHelpers.js";
import {
  classnames,
  formatLargeNumber,
  formatNumNotifications,
  enableLongPress,
  raf,
} from "/js/utils.js";
import { homeIconTemplate } from "/js/templates/icons/homeIcon.template.js";
import { userIconTemplate } from "/js/templates/icons/userIcon.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { chatIconTemplate } from "/js/templates/icons/chatIcon.template.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { widgetsIconTemplate } from "/js/templates/icons/widgetsIcon.template.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
import { hashtagIconTemplate } from "/js/templates/icons/hashtagIcon.template.js";
import { bookmarkIconTemplate } from "/js/templates/icons/bookmarkIcon.template.js";
import { listIconTemplate } from "/js/templates/icons/listIcon.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { editIconTemplate } from "/js/templates/icons/editIcon.template.js";
import {
  linkToProfileFollowers,
  linkToProfileFollowing,
  linkToLogin,
} from "/js/navigation.js";
import "/js/components/animated-sidebar.js";
import "/js/components/app-icon.js";
import { WelcomeModal } from "/js/modals/welcome.modal.js";

async function navigateFromSidebar(event, url) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }
  // Close the sidebar before navigating so the open sidebar isn't
  // captured in the ios safari screenshot
  event.preventDefault();
  const sidebar = event.currentTarget.closest("animated-sidebar");
  sidebar.close({ restoreScroll: false, animate: false });
  await raf();
  await raf();
  return window.router.go(url);
}

function pluginSidebarItemTemplate({ entry }) {
  return html`
    <button
      class="sidebar-nav-item sidebar-plugin-nav-item"
      title=${entry.title}
      @click=${(event) => {
        const sidebar = event.currentTarget.closest("animated-sidebar");
        if (sidebar) sidebar.close();
        entry.invoke();
      }}
    >
      <span class="sidebar-nav-icon">${entry.iconElement}</span>
      <span class="sidebar-nav-label">${entry.title}</span>
    </button>
  `;
}

function sidebarNavTemplate({
  menuItems,
  activeNavItem,
  onClickActiveItem,
  pluginSidebarItems = [],
}) {
  return html`
    <nav class="sidebar-nav" data-testid="sidebar-nav">
      ${menuItems.map(
        (item) => html`
          <a
            href="${item.url}"
            class=${classnames("sidebar-nav-item", {
              disabled: item.disabled,
            })}
            data-testid="sidebar-nav-${item.id}"
            @click=${function (e) {
              const isActive = activeNavItem === item.id;
              if (isActive) {
                e.preventDefault();
                e.stopPropagation();
                onClickActiveItem?.(item.id);
                const sidebar = this.closest("animated-sidebar");
                sidebar.close({ restoreScroll: true });
                return;
              }
              return navigateFromSidebar(e, item.url);
            }}
          >
            <span class="sidebar-nav-icon"
              >${item.icon({ filled: activeNavItem === item.id })}
              ${item.badge
                ? html`<div class="status-badge" data-testid="status-badge">
                    <div class="status-badge-text">${item.badge}</div>
                  </div>`
                : ""}
            </span>
            <span class="sidebar-nav-label">${item.label}</span>
          </a>
        `,
      )}
      ${pluginSidebarItems.map((entry) => pluginSidebarItemTemplate({ entry }))}
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
    <animated-sidebar
      class="logged-out-sidebar"
      data-testid="logged-out-sidebar"
    >
      <div class="sidebar-header">
        <a
          href="/"
          class="sidebar-title"
          @click=${(event) => navigateFromSidebar(event, "/")}
          ><h1>IMPRO</h1></a
        >
      </div>
      ${sidebarNavTemplate({
        menuItems,
        activeNavItem,
        onClickActiveItem,
      })}
      <div class="sidebar-action-items">
        <a
          href=${linkToLogin()}
          class="rounded-button rounded-button-primary login-button"
          data-testid="login-button"
          @click=${(event) => navigateFromSidebar(event, linkToLogin())}
          >Sign in</a
        >
        <button
          class="rounded-button sidebar-about-link"
          data-testid="sidebar-about-link"
          @click=${() => {
            WelcomeModal.open();
          }}
        >
          About
        </button>
      </div>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-footer" data-testid="sidebar-footer">
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
  pluginSidebarItems = [],
  onLongPressProfile = null,
}) {
  if (!isAuthenticated) {
    return loggedOutSidebarTemplate({
      activeNavItem,
      onClickActiveItem,
    });
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
      icon: hashtagIconTemplate,
      label: "Feeds",
      url: "/feeds",
    },
    {
      id: "lists",
      icon: listIconTemplate,
      label: "Lists",
      url: "/lists",
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
      id: "plugins",
      icon: widgetsIconTemplate,
      label: "Plugins",
      url: "/plugins/installed",
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
  const longPressEnabled = !!onLongPressProfile;
  return html`
    <animated-sidebar>
      <!-- Profile Section -->
      <div class="sidebar-profile" data-testid="sidebar-profile">
        <div
          class=${classnames("sidebar-profile-avatar", {
            "long-press-enabled": longPressEnabled,
          })}
          ${ref((el) => {
            if (el && longPressEnabled) {
              enableLongPress(el);
            }
          })}
          @long-press=${onLongPressProfile ? () => onLongPressProfile() : null}
        >
          ${currentUser
            ? html`${avatarTemplate({ author: currentUser })}`
            : html`<div class="avatar-placeholder"></div>`}
        </div>
        <div class="sidebar-profile-info">
          <div class="sidebar-profile-name" data-testid="sidebar-profile-name">
            ${displayName || html`<span>&nbsp;</span>`}
          </div>
          <div
            class="sidebar-profile-handle"
            data-testid="sidebar-profile-handle"
          >
            ${handle || html`<span>&nbsp;</span>`}
          </div>
        </div>
        <div class="sidebar-profile-stats" data-testid="sidebar-profile-stats">
          <a
            href="${currentUser ? linkToProfileFollowers(currentUser) : "#"}"
            @click=${(event) =>
              currentUser
                ? navigateFromSidebar(
                    event,
                    linkToProfileFollowers(currentUser),
                  )
                : null}
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
            @click=${(event) =>
              currentUser
                ? navigateFromSidebar(
                    event,
                    linkToProfileFollowing(currentUser),
                  )
                : null}
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
      ${sidebarNavTemplate({
        menuItems,
        activeNavItem,
        onClickActiveItem,
        pluginSidebarItems,
      })}
      ${onClickComposeButton
        ? html`<button
            class="rounded-button rounded-button-primary sidebar-compose-button"
            data-testid="sidebar-compose-button"
            @click=${() => onClickComposeButton()}
          >
            ${editIconTemplate()} <span>New Post</span>
          </button>`
        : ""}
      <div class="sidebar-spacer"></div>
    </animated-sidebar>
  `;
}
