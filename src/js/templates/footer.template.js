import { html, ref } from "/js/lib/lit-html.js";
import { classnames, enableLongPress } from "/js/utils.js";
import { fillableIconTemplate } from "/js/templates/icons/fillableIcon.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { formatNumNotifications } from "/js/utils.js";
import { linkToLogin } from "/js/navigation.js";

function footerNavItemTemplate({ item, active }) {
  return html`${fillableIconTemplate({ icon: item.icon, filled: active })}
  ${item.badge
    ? html`<div class="status-badge" data-testid="status-badge">
        <div class="status-badge-text">${item.badge}</div>
      </div>`
    : null} `;
}

function loggedOutFooterTemplate() {
  return html`
    <footer
      class="footer-nav logged-out-footer"
      data-testid="logged-out-footer"
    >
      <a href="/"><h2 data-testid="brand-title">IMPRO</h2></a>
      <a
        href=${linkToLogin()}
        class="rounded-button rounded-button-primary login-button"
        data-testid="login-button"
        >Sign in</a
      >
    </footer>
  `;
}

export function footerTemplate({
  isAuthenticated,
  currentUser,
  activeNavItem = null,
  isNavItemPage = false,
  numNotifications = 0,
  numChatNotifications = 0,
  onClickActiveItem,
  onLongPressProfile = null,
}) {
  if (!isAuthenticated) {
    return loggedOutFooterTemplate();
  }
  const menuItems = [
    {
      id: "home",
      icon: "home",
      url: "/",
    },
    {
      id: "search",
      icon: "search",
      url: "/search",
    },
    {
      id: "chat",
      icon: "chat-dots",
      url: "/messages",
      badge:
        numChatNotifications > 0
          ? formatNumNotifications(numChatNotifications)
          : null,
    },
    {
      id: "notifications",
      icon: "bell",
      url: "/notifications",
      badge:
        numNotifications > 0 ? formatNumNotifications(numNotifications) : null,
    },
    {
      id: "profile",
      url: currentUser ? `/profile/${currentUser.handle}` : "",
      disabled: !currentUser,
      template: () =>
        html`${currentUser
          ? avatarTemplate({ author: currentUser, clickAction: "none" })
          : html`<div class="avatar-placeholder"></div>`}`,
    },
  ];

  return html`
    <footer class="footer-nav" data-testid="footer-nav">
      <nav>
        ${menuItems.map((item) => {
          const active = activeNavItem === item.id;
          const longPressEnabled =
            item.id === "profile" && onLongPressProfile !== null;
          return html`<a
            ${ref((el) => {
              if (el && longPressEnabled) {
                enableLongPress(el);
              }
            })}
            class=${classnames("footer-nav-item", {
              active,
              "long-press-enabled": longPressEnabled,
            })}
            href=${item.url}
            data-testid="footer-nav-${item.id}"
            ?disabled=${item.disabled}
            @long-press=${longPressEnabled ? () => onLongPressProfile() : null}
            @click=${(e) => {
              // tap the item for the page you're on to scroll to top; deeper
              // pages in the section just follow the link
              if (active && isNavItemPage) {
                e.preventDefault();
                e.stopPropagation();
                onClickActiveItem?.(item.id);
              }
            }}
            >${item.template
              ? item.template({ item, active })
              : footerNavItemTemplate({ item, active })}
          </a>`;
        })}
      </nav>
    </footer>
  `;
}
