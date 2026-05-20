import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";
import { showToast } from "/js/toasts.js";
import { confirm } from "/js/modals.js";

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

    const state = {
      error: null,
      pending: new Set(),
    };

    async function loadListings() {
      state.error = null;
      renderPage();
      try {
        await pluginService.loadRegistryListings();
      } catch (error) {
        console.error(error);
        state.error = error.message ?? String(error);
      }
      renderPage();
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
      state.pending.add(listing.id);
      renderPage();
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
        console.error(e);
        showToast(
          wasInstalled
            ? `Failed to uninstall ${listing.name}`
            : `Failed to install ${listing.name}`,
          { style: "error" },
        );
      }
      state.pending.delete(listing.id);
      renderPage();
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const listings = pluginService.getRegistryListings();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
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
                ${state.error
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
                            const pending = state.pending.has(listing.id);
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
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => renderPage());
      await loadListings();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      loadListings();
    });

    notificationService?.on("update", () => renderPage());
    chatNotificationService?.on("update", () => renderPage());
  }
}

export default new SettingsCommunityPluginsView();
