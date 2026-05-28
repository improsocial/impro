import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { eyeIconTemplate } from "/js/templates/icons/eyeIcon.template.js";
import { eyeSlashIconTemplate } from "/js/templates/icons/eyeSlashIcon.template.js";
import { mutedWordIconTemplate } from "/js/templates/icons/mutedWordIcon.template.js";
import { restrictedIconTemplate } from "/js/templates/icons/restrictedIcon.template.js";
import { codeIconTemplate } from "/js/templates/icons/codeIcon.template.js";
import { boxIconTemplate } from "/js/templates/icons/boxIcon.template.js";
import { auth } from "/js/auth.js";
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
    await auth.requireAuth();

    const menuItems = [
      {
        key: "appearance",
        icon: eyeIconTemplate,
        label: "Appearance",
        url: "/settings/appearance",
        enabled: true,
      },
      {
        key: "muted-words",
        icon: mutedWordIconTemplate,
        label: "Muted words",
        url: "/settings/muted-words",
        enabled: true,
      },
      {
        key: "muted-accounts",
        icon: eyeSlashIconTemplate,
        label: "Muted accounts",
        url: "/settings/muted-accounts",
        enabled: true,
      },
      {
        key: "blocked-accounts",
        icon: restrictedIconTemplate,
        label: "Blocked accounts",
        url: "/settings/blocked-accounts",
        enabled: true,
      },
      {
        key: "plugins",
        icon: boxIconTemplate,
        label: "Plugins (beta)",
        url: "/settings/plugins",
        enabled: true,
      },
      {
        key: "advanced",
        icon: codeIconTemplate,
        label: "Advanced",
        url: "/settings/advanced",
        enabled: true,
      },
    ];

    pageEffect(root, () => {
      const currentUser = dataLayer.signals.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
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
                onClickBackButton: () => {
                  // If navigating from settings detail page, go home instead of navigating back
                  if (
                    window.router.previousRoute &&
                    window.router.previousRoute.startsWith("/settings/")
                  ) {
                    window.router.go("/");
                  } else {
                    window.router.back();
                  }
                },
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
                        data-testid="settings-nav-${item.key}"
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
                    data-testid="settings-sign-out"
                    @click=${async () => {
                      if (
                        !(await confirm("Are you sure you want to sign out?", {
                          title: "Sign out?",
                          confirmButtonStyle: "danger",
                          confirmButtonText: "Sign out",
                        }))
                      ) {
                        return;
                      }
                      await auth.logout();
                      window.location.reload();
                    }}
                  >
                    Sign out
                  </button>
                </nav>
                <div class="version-info" data-testid="version-info">
                  Impro v${window.env.version} - ${window.env.gitCommit}
                </div>
                <div class="settings-footer-links">
                  <a
                    href="/tos.html"
                    data-testid="footer-link-terms"
                    data-external="true"
                    >Terms</a
                  >
                  <span class="settings-footer-separator">·</span>
                  <a
                    href="/privacy.html"
                    data-testid="footer-link-privacy"
                    data-external="true"
                    >Privacy Policy</a
                  >
                  <span class="settings-footer-separator">·</span>
                  <a
                    href="https://github.com/improsocial/impro"
                    data-testid="footer-link-github"
                    >GitHub</a
                  >
                </div>
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsView();
