import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import { homeIconTemplate } from "/js/templates/icons/homeIcon.template.js";
import { userIconTemplate } from "/js/templates/icons/userIcon.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { chatIconTemplate } from "/js/templates/icons/chatIcon.template.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { notificationsIconTemplate } from "/js/templates/icons/notificationsIcon.template.js";
import { formatNumNotifications } from "/js/utils.js";

function footerNavItemTemplate({ item, active }) {
  return html`${item.icon({ filled: active })}
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
      <a href="/"><h2>IMPRO</h2></a>
      <a
        href="/login"
        class="square-button primary-button login-button"
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
  numNotifications = 0,
  numChatNotifications = 0,
  onClickActiveItem,
}) {
  if (!isAuthenticated) {
    return loggedOutFooterTemplate();
  }
  const menuItems = [
    {
      id: "home",
      icon: homeIconTemplate,
      url: "/",
    },
    {
      id: "search",
      icon: searchIconTemplate,
      url: "/search",
    },
    {
      id: "chat",
      icon: chatIconTemplate,
      url: "/messages",
      badge:
        numChatNotifications > 0
          ? formatNumNotifications(numChatNotifications)
          : null,
    },
    {
      id: "notifications",
      icon: notificationsIconTemplate,
      url: "/notifications",
      badge:
        numNotifications > 0 ? formatNumNotifications(numNotifications) : null,
    },
    {
      id: "profile",
      // icon: userIconTemplate,
      url: currentUser ? `/profile/${currentUser.handle}` : "",
      disabled: !currentUser,
      template: () =>
        html`${currentUser
          ? avatarTemplate({ author: currentUser, clickAction: "none" })
          : html`<div class="avatar-image-placeholder"></div>`}`,
    },
  ];

  return html`
    <footer class="footer-nav" data-testid="footer-nav">
      <nav>
        ${menuItems.map((item) => {
          const active = activeNavItem === item.id;
          return html`<a
            class=${classnames("footer-nav-item", {
              active,
            })}
            href=${item.url}
            data-testid="footer-nav-${item.id}"
            ?disabled=${item.disabled}
            @click=${(e) => {
              // tap active item to scroll to top
              if (active) {
                e.preventDefault();
                e.stopPropagation();
                if (onClickActiveItem) {
                  onClickActiveItem(item.id);
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }
            }}
            >${item.template
              ? item.template({ item, active })
              : footerNavItemTemplate({ item, active })}
          </a>`;
        })}
      </nav>
      <!-- This adds a background color to the bottom of the footer when it's raised -->
      <div class="footer-nav-safe-area" data-testid="footer-safe-area"></div>
    </footer>
  `;
}
