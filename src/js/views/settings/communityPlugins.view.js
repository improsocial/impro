import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";
import { showToast } from "/js/toasts.js";
import { confirm } from "/js/modals.js";
import { Signal, SignalSet } from "/js/signals.js";
import { PermissionsDeclinedError } from "/js/plugins/pluginService.js";

class SettingsCommunityPluginsView extends View {
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

    const $error = new Signal.State(null);
    const $pendingIds = new SignalSet();

    async function loadListings() {
      $error.set(null);
      try {
        await pluginService.loadRegistryListings();
      } catch (error) {
        console.error(error);
        $error.set(error.message ?? String(error));
      }
    }

    async function toggleInstall(listing) {
      const wasInstalled = listing.installed;
      if (wasInstalled) {
        const confirmed = await confirm(
          `"${listing.name}" will be disabled and uninstalled.`,
          {
            title: "Uninstall plugin?",
            confirmButtonStyle: "danger",
            confirmButtonText: "Uninstall",
          },
        );
        if (!confirmed) return;
      }
      $pendingIds.add(listing.id);
      try {
        if (wasInstalled) {
          await pluginService.uninstallPlugin(listing.id);
        } else {
          await pluginService.installPlugin(listing.id);
        }
        showToast(
          wasInstalled
            ? `Uninstalled ${listing.name}`
            : `Installed ${listing.name}`,
          { style: wasInstalled ? "default" : "success" },
        );
      } catch (e) {
        if (e instanceof PermissionsDeclinedError) {
          // User declined the permission prompt; nothing to report.
        } else {
          console.error(e);
          showToast(
            wasInstalled
              ? `Failed to uninstall ${listing.name}`
              : `Failed to install ${listing.name}`,
            { style: "error" },
          );
        }
      }
      $pendingIds.delete(listing.id);
    }

    pageEffect(root, () => {
      const error = $error.get();
      const currentUser = dataLayer.derived.$currentUser.get();
      const listings = pluginService.$registryListings.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      render(
        html`<div id="settings-community-plugins-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.router.go("/settings"),
            children: html`${headerTemplate({
                title: "Community plugins",
                onClickBackButton: () => window.router.go("/settings/plugins"),
              })}
              <main>
                ${error
                  ? html`<div class="error-state">
                      <div>Failed to load plugins</div>
                      <button @click=${() => loadListings()}>Try again</button>
                    </div>`
                  : !listings
                    ? html`<div
                        class="plugins-loading-state"
                        data-testid="plugins-loading-state"
                      >
                        <div
                          class="loading-spinner"
                          data-testid="loading-spinner"
                        ></div>
                      </div>`
                    : listings.length === 0
                      ? html`<div class="plugins-empty-state">
                          <div class="plugins-empty-state-title">
                            No community plugins to show
                          </div>
                          <p class="plugins-empty-state-message">
                            The registry is empty right now.
                          </p>
                        </div>`
                      : html`<ul class="plugin-list">
                          ${listings.map((listing) => {
                            const pending = $pendingIds.has(listing.id);
                            const buttonClass = listing.installed
                              ? "plugin-install-button rounded-button"
                              : "plugin-install-button rounded-button rounded-button-primary";
                            return html`
                              <li class="plugin-list-item">
                                <div class="plugin-list-item-info">
                                  <div class="plugin-list-item-name">
                                    ${listing.name}
                                    ${listing.id.endsWith("__LOCAL")
                                      ? html`<span class="plugin-local-badge"
                                          >local</span
                                        >`
                                      : ""}
                                  </div>
                                  ${listing.description
                                    ? html`<div
                                        class="plugin-list-item-description"
                                      >
                                        ${listing.description}
                                      </div>`
                                    : ""}
                                  <div class="plugin-list-item-version">
                                    By ${listing.author}
                                  </div>
                                </div>
                                <div class="plugin-list-item-controls">
                                  <button
                                    class=${buttonClass}
                                    ?disabled=${pending}
                                    @click=${() => toggleInstall(listing)}
                                  >
                                    ${pending
                                      ? html`${listing.installed
                                            ? "Uninstalling"
                                            : "Installing"}
                                          <div
                                            class="loading-spinner"
                                            data-testid="loading-spinner"
                                          ></div>`
                                      : listing.installed
                                        ? "Uninstall"
                                        : "Install"}
                                  </button>
                                </div>
                              </li>
                            `;
                          })}
                        </ul>`}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await loadListings();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      loadListings();
    });
  }
}

export default new SettingsCommunityPluginsView();
