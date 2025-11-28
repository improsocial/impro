import { html } from "/js/lib/lit-html.js";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { footerNavTemplate } from "/js/templates/footerNav.template.js";
import { editIconTemplate } from "/js/templates/icons/editIcon.template.js";
import "/js/components/animated-sidebar.js";

export function mainLayoutTemplate({
  isAuthenticated = true,
  currentUser,
  activeNavItem,
  numNotifications = 0,
  numChatNotifications = 0,
  onClickActiveNavItem,
  children,
  showFloatingComposeButton = false,
  onClickComposeButton,
  showSidebarOverlay = true,
}) {
  // This fixes a weird performance bug that was happening on the postThread view
  // (specifically with the profile image)
  // I'm not exactly why it was happening but this will fix it for now
  const isLargeScreen = window.innerWidth > 800;
  const doRenderSidebar = isLargeScreen || showSidebarOverlay;
  return html`
    <div class="view-columns">
      <div class="view-column-left">
        ${doRenderSidebar
          ? sidebarTemplate({
              isAuthenticated,
              currentUser,
              activeNavItem,
              numNotifications,
              numChatNotifications,
              onClickActiveItem: onClickActiveNavItem,
              onClickComposeButton,
            })
          : ""}
      </div>
      <div class="view-column-center">${children}</div>
      <div class="view-column-right"></div>
    </div>
    ${isAuthenticated
      ? footerNavTemplate({
          currentUser,
          activeNavItem,
          numNotifications,
          numChatNotifications,
          onClickActiveItem: onClickActiveNavItem,
        })
      : ""}
    ${currentUser && showFloatingComposeButton
      ? html`<button
          class="floating-compose-button"
          @click=${() => onClickComposeButton()}
        >
          ${editIconTemplate()}
        </button>`
      : ""}
  `;
}
