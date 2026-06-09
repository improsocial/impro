import { html } from "/js/lib/lit-html.js";
import { sidebarTemplate } from "/js/templates/sidebar.template.js";
import { footerTemplate } from "/js/templates/footer.template.js";
import { editIconTemplate } from "/js/templates/icons/editIcon.template.js";
import "/js/components/animated-sidebar.js";

export function createMainLayout(context) {
  const {
    isAuthenticated,
    dataLayer,
    notificationService,
    chatNotificationService,
    postComposerService,
    pluginService,
  } = context;
  return function mainLayout(options) {
    const currentUser = dataLayer.derived.$currentUser.get();
    return mainLayoutTemplate({
      isAuthenticated,
      currentUser,
      numNotifications: notificationService?.$numNotifications.get() ?? null,
      numChatNotifications:
        chatNotificationService?.$numNotifications.get() ?? null,
      pluginService,
      onClickComposeButton: () =>
        postComposerService.composePost({ currentUser }),
      ...options,
    });
  };
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
  pluginService,
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
              pluginSidebarItems: pluginService.getSidebarItems(),
            })
          : ""}
      </div>
      <div class="view-column-center" data-testid="view-column-center">
        ${children}
      </div>
      <div class="view-column-right"></div>
    </div>
    ${footerTemplate({
      isAuthenticated,
      currentUser,
      activeNavItem,
      numNotifications,
      numChatNotifications,
      onClickActiveItem: onClickActiveNavItem,
    })}
    ${currentUser && showFloatingComposeButton
      ? html`<button
          class="floating-compose-button"
          data-testid="floating-compose-button"
          @click=${() => onClickComposeButton()}
        >
          ${editIconTemplate()}
        </button>`
      : ""}
  `;
}
