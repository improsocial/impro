import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { eyeIconTemplate } from "/js/templates/icons/eyeIcon.template.js";
import { mutedWordIconTemplate } from "/js/templates/icons/mutedWordIcon.template.js";
import { eyeSlashIconTemplate } from "/js/templates/icons/eyeSlashIcon.template.js";
import { codeIconTemplate } from "/js/templates/icons/codeIcon.template.js";
import { boxIconTemplate } from "/js/templates/icons/boxIcon.template.js";
import { getAuth, requireAuth } from "/js/auth.js";
import { headerTemplate } from "/js/templates/header.template.js";
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
      pluginService,
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
      {
        icon: mutedWordIconTemplate,
        label: "Muted words",
        url: "/settings/muted-words",
        enabled: true,
      },
      {
        icon: eyeSlashIconTemplate,
        label: "Blocked accounts",
        url: "/settings/blocked-accounts",
        enabled: true,
      },
      {
        icon: boxIconTemplate,
        label: "Plugins",
        url: "/settings/plugins",
        enabled: true,
      },
      {
        icon: codeIconTemplate,
        label: "Advanced",
        url: "/settings/advanced",
        enabled: true,
      },
    ];

    function renderPage() {
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
            onClickActiveNavItem: () => window.scrollTo(0, 0),
            pluginService,
            children: html`${headerTemplate({
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
                    `,
                  )}
                  <hr />
                  <button
                    class="vertical-nav-item danger-button"
                    @click=${async () => {
                      if (
                        !(await confirm("Are you sure you want to sign out?", {
                          confirmButtonStyle: "danger",
                          confirmButtonText: "Sign out",
                        }))
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
                  Impro v${window.env.version} - ${window.env.gitCommit}
                </div>
                <div class="settings-footer-links">
                  <a href="/tos.html" data-external="true">Terms</a>
                  <span class="settings-footer-separator">·</span>
                  <a href="/privacy.html" data-external="true"
                    >Privacy Policy</a
                  >
                  <span class="settings-footer-separator">·</span>
                  <a href="https://github.com/improsocial/impro">GitHub</a>
                </div>
              </main>`,
          })}
        </div>`,
        root,
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
