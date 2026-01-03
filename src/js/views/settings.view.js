import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { eyeIconTemplate } from "/js/templates/icons/eyeIcon.template.js";
import { getAuth, requireAuth } from "/js/auth.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { classnames } from "/js/utils.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { confirm } from "/js/modals.js";

class SettingsView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
    },
  }) {
    await requireAuth();

    const menuItems = [
      {
        icon: eyeIconTemplate,
        label: "Appearance",
        url: "/settings/appearance",
        enabled: true,
      },
    ];

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      render(
        html`<div id="settings-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "settings",
            children: html`${textHeaderTemplate({
                title: "Settings",
              })}
              <main>
                <nav class="vertical-nav">
                  ${menuItems.map(
                    (item) => html`
                      <a
                        href="${item.url}"
                        class=${classnames("vertical-nav-item", {
                          disabled: !item.enabled,
                        })}
                      >
                        <span class="vertical-nav-icon">${item.icon()}</span>
                        <span class="vertical-nav-label">${item.label}</span>
                        <span class="vertical-nav-arrow"
                          >${chevronRightIconTemplate()}</span
                        >
                      </a>
                    `
                  )}
                  <hr />
                  <button
                    class="vertical-nav-item danger-button"
                    @click=${async () => {
                      if (
                        !(await confirm("Are you sure you want to sign out?"))
                      ) {
                        return;
                      }
                      const auth = await getAuth();
                      await auth.logout();
                      window.location.reload();
                    }}
                  >
                    Sign out
                  </button>
                </nav>
                <div class="version-info">
                  Impro v0.1.0 - ${window.env.gitCommit}
                </div>
                <div class="settings-footer-links">
                  <a href="/tos.html" data-external="true">Terms</a>
                  <span class="settings-footer-separator">·</span>
                  <a href="/privacy.html" data-external="true"
                    >Privacy Policy</a
                  >
                </div>
              </main>`,
          })}
        </div>`,
        root
      );
    }

    root.addEventListener("page-enter", async () => {
      // Initial empty state
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
    });

    root.addEventListener("page-restore", (e) => {
      window.scrollTo(0, 0);
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new SettingsView();
