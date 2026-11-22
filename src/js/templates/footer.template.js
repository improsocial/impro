import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import { fillableIconTemplate } from "/js/templates/fillableIcon.template.js";
import { formatNumNotifications } from "/js/utils.js";
import { linkToLogin } from "/js/navigation.js";

function footerNavItemTemplate({ item, active }) {
  return html`<span class="nav-icon-anchor"
    >${fillableIconTemplate({ icon: item.icon, filled: active })}
    ${item.badge
      ? html`<div class="status-badge" data-testid="status-badge">
          <div class="status-badge-text">${item.badge}</div>
        </div>`
      : null}</span
  >`;
}

function loggedOutFooterTemplate() {
  return html`
    <footer
      class="footer-nav logged-out-footer"
      data-testid="logged-out-footer"
    >
      <a
        href=${linkToLogin()}
        class="rounded-button rounded-button-highlight login-button"
        data-testid="login-button"
        >Sign in</a
      >
    </footer>
  `;
}

export function footerTemplate({
  isAuthenticated,
  activeNavItem = null,
  isNavItemPage = false,
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
      icon: "home",
      url: "/",
    },
    {
      id: "search",
      icon: "search",
      url: "/search",
    },
    {
      id: "plugins",
      icon: "widgets",
      url: "/plugins/installed",
    },
    {
      id: "notifications",
      icon: "bell",
      url: "/notifications",
      badge:
        numNotifications > 0 ? formatNumNotifications(numNotifications) : null,
    },
    {
      id: "chat",
      icon: "chat-bubble",
      url: "/messages",
      badge:
        numChatNotifications > 0
          ? formatNumNotifications(numChatNotifications)
          : null,
    },
  ];

  return html`
    <footer class="footer-nav" data-testid="footer-nav">
      <nav>
        ${menuItems.map((item) => {
          const active = activeNavItem === item.id;
          return html`<a
            class=${classnames("footer-nav-item", { active })}
            href=${item.url}
            data-testid="footer-nav-${item.id}"
            @click=${(e) => {
              // tap the item for the page you're on to scroll to top; deeper
              // pages in the section just follow the link
              if (active && isNavItemPage) {
                e.preventDefault();
                e.stopPropagation();
                onClickActiveItem?.(item.id);
              }
            }}
            >${footerNavItemTemplate({ item, active })}
          </a>`;
        })}
      </nav>
    </footer>
  `;
}
