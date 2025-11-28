import { html } from "/js/lib/lit-html.js";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { footerNavTemplate } from "/js/templates/footerNav.template.js";
import { editIconTemplate } from "/js/templates/icons/editIcon.template.js";
import "/js/components/animated-sidebar.js";

function loggedOutSidebarTemplate() {
  return html`
    <animated-sidebar class="logged-out-sidebar">
      <div class="sidebar-content">
        <div class="sidebar-header">
          <h1>IMPRO</h1>
          <a href="/login" class="rounded-button rounded-button-primary"
            >Sign in</a
          >
        </div>
      </div>
    </animated-sidebar>
  `;
}

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
          ? isAuthenticated
            ? sidebarTemplate({
                currentUser,
                activeNavItem,
                numNotifications,
                numChatNotifications,
                onClickActiveItem: onClickActiveNavItem,
                onClickComposeButton,
              })
            : loggedOutSidebarTemplate()
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
