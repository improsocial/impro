import { html } from "/js/lib/lit-html.js";
import { getDisplayName } from "/js/dataHelpers.js";
import {
  classnames,
  formatLargeNumber,
  formatNumNotifications,
} from "/js/utils.js";
import { fillableIconTemplate } from "/js/templates/fillableIcon.template.js";
import {
  avatarPlaceholderTemplate,
  avatarTemplate,
} from "/js/templates/avatar.template.js";
import { profileBadgesTemplate } from "/js/templates/profileBadges.template.js";
import { siteLinksTemplate } from "/js/templates/siteLinks.template.js";
import {
  linkToProfileFollowers,
  linkToProfileFollowing,
  linkToLogin,
} from "/js/navigation.js";
import "/js/components/animated-sidebar.js";
import "/js/components/app-icon.js";

function navigateFromSidebar(event, url) {
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
  event.preventDefault();
  const sidebar = event.currentTarget.closest("animated-sidebar");
  return sidebar.navigate(() => window.router.go(url));
}

function pluginSidebarItemTemplate({ entry }) {
  return html`
    <button
      class="sidebar-nav-item sidebar-plugin-nav-item"
      data-testid="sidebar-plugin-item"
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
  isNavItemPage,
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
              active: activeNavItem === item.id,
            })}
            data-testid="sidebar-nav-${item.id}"
            @click=${function (e) {
              const isActive = activeNavItem === item.id;
              if (isActive && isNavItemPage) {
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
              ><span class="nav-icon-anchor"
                >${fillableIconTemplate({
                  icon: item.icon,
                  filled: activeNavItem === item.id,
                })}
                ${item.badge
                  ? html`<div class="status-badge" data-testid="status-badge">
                      <div class="status-badge-text">${item.badge}</div>
                    </div>`
                  : ""}</span
              ></span
            >
            <span class="sidebar-nav-label">${item.label}</span>
          </a>
        `,
      )}
      ${pluginSidebarItems.map((entry) => pluginSidebarItemTemplate({ entry }))}
    </nav>
  `;
}

function loggedOutSidebarTemplate({
  activeNavItem,
  isNavItemPage,
  onClickActiveItem,
}) {
  const menuItems = [
    {
      id: "home",
      icon: "home",
      label: "Home",
      url: "/",
    },
    {
      id: "search",
      icon: "search",
      label: "Search",
      url: "/search",
    },
    {
      id: "plugins",
      icon: "widgets",
      label: "Plugins",
      url: "/plugins/community",
    },
  ];
  return html`
    <animated-sidebar
      class="logged-out-sidebar"
      data-testid="logged-out-sidebar"
    >
      ${sidebarNavTemplate({
        menuItems,
        activeNavItem,
        isNavItemPage,
        onClickActiveItem,
      })}
      <div class="sidebar-action-items">
        <a
          href=${linkToLogin()}
          class="rounded-button rounded-button-highlight login-button"
          data-testid="login-button"
          @click=${(event) => navigateFromSidebar(event, linkToLogin())}
          >Sign in</a
        >
      </div>
      <div class="sidebar-spacer"></div>
      ${siteLinksTemplate({ className: "sidebar-site-links" })}
    </animated-sidebar>
  `;
}

function sidebarAccountSkeletonTemplate() {
  return html`
    <div
      class="sidebar-account sidebar-account-skeleton loading-block"
      data-testid="sidebar-account-skeleton"
    >
      <div class="sidebar-account-row">
        <span class="sidebar-account-info">
          <span class="sidebar-account-name"
            >&#8203;<span
              class="sidebar-account-skeleton-bar skeleton-animate"
            ></span
          ></span>
          <span class="sidebar-account-handle"
            >&#8203;<span
              class="sidebar-account-skeleton-bar sidebar-account-skeleton-bar-handle skeleton-animate"
            ></span
          ></span>
        </span>
      </div>
      <div class="sidebar-account-avatar">
        <div class="avatar">
          <div class="avatar-image-frame skeleton-animate"></div>
        </div>
      </div>
    </div>
  `;
}

function sidebarAccountTemplate({
  currentUser,
  displayName,
  handle,
  onOpenAccountSwitcher,
}) {
  if (!currentUser) {
    return sidebarAccountSkeletonTemplate();
  }
  const profileUrl = `/profile/${currentUser.did}`;
  const info = html`<span class="sidebar-account-info">
    <span class="sidebar-account-name">${displayName}</span>
    <span class="sidebar-account-handle">${handle}</span>
  </span>`;
  return html`
    <div class="sidebar-account" data-testid="sidebar-account">
      ${onOpenAccountSwitcher
        ? html`<button
            class="sidebar-account-row"
            data-testid="sidebar-account-switcher-button"
            aria-label="Switch accounts"
            @click=${() => onOpenAccountSwitcher()}
          >
            ${info}
            <app-icon icon="more-menu-large"></app-icon>
          </button>`
        : html`<a
            class="sidebar-account-row"
            href=${profileUrl}
            tabindex="-1"
            @click=${(event) => navigateFromSidebar(event, profileUrl)}
          >
            ${info}
          </a>`}
      <a
        class="sidebar-account-avatar"
        href=${profileUrl}
        data-testid="sidebar-account-avatar"
        aria-label="Profile"
        @click=${(event) => navigateFromSidebar(event, profileUrl)}
      >
        ${avatarTemplate({ author: currentUser, clickAction: "none" })}
      </a>
    </div>
  `;
}

function sidebarProfileAccountSwitcherTemplate({
  otherAccounts,
  onOpenAccountSwitcher,
  onSwitchAccount,
  pendingSwitchDid,
}) {
  const stackAccounts = otherAccounts
    .filter(({ account }) => !account.needsReauth)
    .slice(0, 3);
  return html`<div class="sidebar-account-switcher-buttons">
    ${stackAccounts.length > 0
      ? html`<span
          class="sidebar-account-avatar-stack"
          data-testid="sidebar-account-avatar-stack"
        >
          ${stackAccounts.map(
            ({ account, profile }) =>
              html`<button
                class=${classnames("sidebar-account-stack-item", {
                  "is-selected": pendingSwitchDid === account.did,
                })}
                data-testid="sidebar-account-stack-item"
                data-teststate=${pendingSwitchDid === account.did
                  ? "selected"
                  : "idle"}
                data-did=${account.did}
                aria-label="Switch to @${profile?.handle ?? account.handle}"
                @click=${() => onSwitchAccount(account)}
              >
                ${profile
                  ? avatarTemplate({ author: profile, clickAction: "none" })
                  : avatarPlaceholderTemplate()}
              </button>`,
          )}
        </span>`
      : null}
    <button
      class="rounded-button ellipsis-button"
      data-testid="sidebar-profile-account-switcher-button"
      aria-label="Switch accounts"
      @click=${() => onOpenAccountSwitcher()}
    >
      <span>...</span>
    </button>
  </div>`;
}

export function sidebarTemplate({
  isAuthenticated,
  currentUser,
  activeNavItem = null,
  isNavItemPage = false,
  numNotifications = 0,
  numChatNotifications = 0,
  onClickActiveItem,
  onClickComposeButton,
  pluginSidebarItems = [],
  onOpenAccountSwitcher = null,
  otherAccounts = null,
  onSwitchAccount = null,
  pendingSwitchDid = null,
}) {
  if (!isAuthenticated) {
    return loggedOutSidebarTemplate({
      activeNavItem,
      isNavItemPage,
      onClickActiveItem,
    });
  }

  const menuItems = [
    {
      id: "home",
      icon: "home",
      label: "Home",
      url: "/",
    },
    {
      id: "search",
      icon: "search",
      label: "Search",
      url: "/search",
    },
    {
      id: "notifications",
      icon: "bell",
      label: "Notifications",
      url: "/notifications",
      badge:
        numNotifications > 0 ? formatNumNotifications(numNotifications) : null,
    },
    {
      id: "chat",
      icon: "chat-bubble",
      label: "Chat",
      url: "/messages",
      badge:
        numChatNotifications > 0
          ? formatNumNotifications(numChatNotifications)
          : null,
    },
    {
      id: "feeds",
      icon: "hashtag",
      label: "Feeds",
      url: "/feeds",
    },
    {
      id: "lists",
      icon: "checkbox-list",
      label: "Lists",
      url: "/lists",
    },
    {
      id: "bookmarks",
      icon: "bookmark",
      label: "Saved",
      url: "/bookmarks",
    },
    {
      id: "profile",
      icon: "user",
      label: "Profile",
      url: currentUser ? `/profile/${currentUser.did}` : "",
      disabled: !currentUser,
    },
    {
      id: "plugins",
      icon: "widgets",
      label: "Plugins",
      url: "/plugins/installed",
    },
    {
      id: "settings",
      icon: "settings-cog",
      label: "Settings",
      url: "/settings",
    },
  ];

  const displayName = currentUser ? getDisplayName(currentUser) : null;
  const handle = currentUser?.handle ? "@" + currentUser.handle : null;
  const followersCount = currentUser?.followersCount ?? null;
  const followsCount = currentUser?.followsCount ?? null;
  // A partial profile has no counts to show
  const showStats = !currentUser?.isPartial;
  return html`
    <animated-sidebar>
      <!-- Profile Section -->
      <div class="sidebar-profile" data-testid="sidebar-profile">
        <div class="sidebar-profile-top">
          <div class="sidebar-profile-avatar">
            ${currentUser
              ? html`${avatarTemplate({ author: currentUser })}`
              : avatarPlaceholderTemplate()}
          </div>
          ${onOpenAccountSwitcher
            ? sidebarProfileAccountSwitcherTemplate({
                otherAccounts: otherAccounts ?? [],
                onOpenAccountSwitcher,
                onSwitchAccount,
                pendingSwitchDid,
              })
            : null}
        </div>
        <div class="sidebar-profile-info">
          <div class="sidebar-profile-name" data-testid="sidebar-profile-name">
            ${displayName
              ? html`${displayName}${profileBadgesTemplate({
                  profile: currentUser,
                })}`
              : html`<span>&nbsp;</span>`}
          </div>
          <div
            class="sidebar-profile-handle"
            data-testid="sidebar-profile-handle"
          >
            ${handle || html`<span>&nbsp;</span>`}
          </div>
        </div>
        ${showStats
          ? html`<div
              class="sidebar-profile-stats"
              data-testid="sidebar-profile-stats"
            >
              <a
                data-testid="sidebar-profile-followers"
                href="${currentUser
                  ? linkToProfileFollowers(currentUser)
                  : "#"}"
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
                data-testid="sidebar-profile-following"
                href="${currentUser
                  ? linkToProfileFollowing(currentUser)
                  : "#"}"
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
            </div>`
          : null}
      </div>
      <div class="sidebar-divider"></div>
      ${sidebarNavTemplate({
        menuItems,
        activeNavItem,
        isNavItemPage,
        onClickActiveItem,
        pluginSidebarItems,
      })}
      <button
        class="rounded-button rounded-button-highlight sidebar-compose-button"
        data-testid="sidebar-compose-button"
        ?disabled=${!currentUser}
        @click=${() => onClickComposeButton()}
      >
        <app-icon icon="edit-pen-2"></app-icon>
        <span>New Post</span>
      </button>
      <div class="sidebar-spacer"></div>
      ${sidebarAccountTemplate({
        currentUser,
        displayName,
        handle,
        onOpenAccountSwitcher,
      })}
    </animated-sidebar>
  `;
}
