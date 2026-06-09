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
import { chevronUpIconTemplate } from "/js/templates/icons/chevronUp.template.js";
import { classnames } from "/js/utils.js";
import { linkToLogin } from "/js/navigation.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import { confirm } from "/js/modals.js";
import { Signal } from "/js/signals.js";
import { userIconTemplate } from "/js/templates/icons/userIcon.template.js";
import { userPlusIconTemplate } from "/js/templates/icons/userPlusIcon.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName } from "/js/dataHelpers.js";

class SettingsView extends View {
  async render({ root, context: { dataLayer, mainLayout } }) {
    const currentSession = await auth.requireAuth();
    const supportsMultipleAccounts = auth.supportsMultipleAccounts();

    const $otherAccounts = new Signal.State(null);
    const $otherAccountProfiles = new Signal.State({});
    const $accountSwitcherExpanded = new Signal.State(false);

    function accountsSwitcherTemplate({
      expanded,
      accounts,
      accountProfiles,
      onToggle,
      onSwitch,
      onAdd,
      onRemove,
    }) {
      const hasOthers = accounts.length > 0;
      return html`
        <button
          class="vertical-nav-item"
          data-testid="settings-switch-account-toggle"
          data-teststate=${expanded ? "expanded" : "collapsed"}
          aria-expanded=${hasOthers ? (expanded ? "true" : "false") : null}
          @click=${hasOthers ? onToggle : onAdd}
        >
          <span class="vertical-nav-icon"
            >${hasOthers ? userIconTemplate() : userPlusIconTemplate()}</span
          >
          <span class="vertical-nav-label"
            >${hasOthers ? "Switch account" : "Add another account"}</span
          >
          ${!hasOthers
            ? null
            : expanded
              ? html`<span class="vertical-nav-arrow"
                  >${chevronUpIconTemplate()}</span
                >`
              : html`<span
                  class="settings-account-avatar-stack"
                  data-testid="settings-account-avatar-stack"
                >
                  ${accounts.slice(0, 5).map((account) => {
                    const profile = accountProfiles[account.did] ?? null;
                    if (!profile) {
                      return null;
                    }
                    return avatarTemplate({
                      author: profile,
                    });
                  })}
                </span>`}
        </button>
        ${expanded && hasOthers
          ? html`
              <div
                class="settings-accounts-list"
                data-testid="settings-accounts"
              >
                ${accounts.map((account) => {
                  const profile = accountProfiles[account.did] ?? null;
                  return html`
                    <div
                      class="vertical-nav-item"
                      data-testid="settings-account-row"
                      data-account-did=${account.did}
                      role="button"
                      tabindex="0"
                      @click=${() => onSwitch(account.did)}
                      @keydown=${(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSwitch(account.did);
                        }
                      }}
                    >
                      ${profile
                        ? html`<span class="vertical-nav-icon"
                            >${avatarTemplate({ author: profile })}</span
                          >`
                        : null}
                      <span class="vertical-nav-label">
                        ${getDisplayName(account)}
                      </span>
                      <button
                        class="settings-account-ellipsis"
                        data-testid="settings-account-menu-trigger"
                        aria-label="Account actions"
                        @click=${function (event) {
                          event.stopPropagation();
                          this.nextElementSibling.open(
                            event.clientX,
                            event.clientY,
                          );
                        }}
                      >
                        <span>⋯</span>
                      </button>
                      <context-menu>
                        <context-menu-item
                          data-testid="settings-account-remove"
                          @click=${() => onRemove(account)}
                        >
                          Remove account
                        </context-menu-item>
                      </context-menu>
                    </div>
                  `;
                })}
                <button
                  class="vertical-nav-item"
                  data-testid="settings-account-add"
                  @click=${onAdd}
                >
                  <span class="vertical-nav-icon"
                    >${userPlusIconTemplate()}</span
                  >
                  <span class="vertical-nav-label">Add account</span>
                </button>
              </div>
            `
          : null}
        <hr />
      `;
    }

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
      const otherAccounts = $otherAccounts.get();
      const otherAccountProfiles = $otherAccountProfiles.get();
      if (otherAccounts === null) return;
      render(
        html`<div id="settings-view">
          ${mainLayout({
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.scrollTo(0, 0),
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
                  ${supportsMultipleAccounts
                    ? accountsSwitcherTemplate({
                        expanded: $accountSwitcherExpanded.get(),
                        accounts: otherAccounts,
                        accountProfiles: otherAccountProfiles,
                        onToggle: () =>
                          $accountSwitcherExpanded.set(
                            !$accountSwitcherExpanded.get(),
                          ),
                        onSwitch: (did) => auth.switchAccount(did),
                        onAdd: () => {
                          window.location.href = linkToLogin({
                            query: { addAccount: 1 },
                          });
                        },
                        onRemove: async (account) => {
                          const ok = await confirm(
                            `Remove @${account.handle} from this device?`,
                            {
                              title: "Remove account?",
                              confirmButtonStyle: "danger",
                              confirmButtonText: "Remove",
                            },
                          );
                          if (!ok) return;
                          await auth.removeAccount(account.did);
                          await loadOtherAccounts();
                          const stillHasOthers =
                            $otherAccounts.get().length > 0;
                          if (!stillHasOthers) {
                            $accountSwitcherExpanded.set(false);
                          }
                        },
                      })
                    : null}
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

    async function loadOtherAccounts() {
      const accounts = await auth.listAccounts();
      const otherAccounts = accounts.filter(
        (account) => account.did !== currentSession.did,
      );
      $otherAccounts.set(otherAccounts);
    }

    pageEffect(root, () => {
      // Load account profiles
      const otherAccounts = $otherAccounts.get();
      if (otherAccounts === null) return;
      dataLayer.declarative
        .ensureDetailedProfiles(otherAccounts.map((account) => account.did))
        .then((profiles) => {
          const profilesByDid = {};
          for (const profile of profiles) {
            profilesByDid[profile.did] = profile;
          }
          $otherAccountProfiles.set(profilesByDid);
        });
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      loadOtherAccounts();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsView();
