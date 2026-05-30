import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";
import { showToast } from "/js/toasts.js";
import { confirm } from "/js/modals.js";
import { Signal } from "/js/signals.js";
import { PermissionsDeclinedError } from "/js/plugins/pluginService.js";
import "/js/components/rendered-markdown.js";

class SettingsCommunityPluginListingView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      pluginService,
    },
  }) {
    await auth.requireAuth();

    const { pluginId } = params;
    const isLocal = pluginId.endsWith("__LOCAL");

    const $loadError = new Signal.State(null);
    const $version = new Signal.State(null);
    const $readme = new Signal.State(null);
    const $loading = new Signal.State(true);
    const $pendingAction = new Signal.State(null); // ("install" | "uninstall")

    const $listing = new Signal.Computed(() => {
      const listings = pluginService.$registryListings.get();
      if (!listings) return null;
      return listings.find((listing) => listing.id === pluginId) ?? null;
    });

    async function loadListings() {
      $loadError.set(null);
      try {
        await pluginService.loadRegistryListings();
      } catch (error) {
        console.error(error);
        $loadError.set(error.message ?? String(error));
      }
    }

    async function loadDetails() {
      const listing = $listing.get();
      if (!listing) {
        $loading.set(false);
        return;
      }
      const { id, repo } = listing;
      await Promise.all([
        pluginService
          .getLiveManifest(id, repo)
          .then((manifest) => $version.set(manifest?.version ?? null))
          .catch((error) =>
            console.error("Failed to load plugin manifest", error),
          ),
        pluginService
          .getReadme(id, repo)
          .then((readme) => $readme.set(readme))
          .catch((error) =>
            console.error("Failed to load plugin README", error),
          ),
      ]);
      $loading.set(false);
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
      $pendingAction.set(wasInstalled ? "uninstall" : "install");
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
      } catch (error) {
        if (error instanceof PermissionsDeclinedError) {
          // User declined the permission prompt; nothing to report.
        } else {
          console.error(error);
          showToast(
            wasInstalled
              ? `Failed to uninstall ${listing.name}`
              : `Failed to install ${listing.name}`,
            { style: "error" },
          );
        }
      }
      $pendingAction.set(null);
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const listing = $listing.get();
      const loadError = $loadError.get();
      const version = $version.get();
      const readme = $readme.get();
      const loading = $loading.get();
      const pendingAction = $pendingAction.get();
      const installButtonClass = listing?.installed
        ? "plugin-install-button rounded-button"
        : "plugin-install-button rounded-button rounded-button-primary";
      render(
        html`<div id="settings-community-plugin-listing-view">
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
                title: listing?.name ?? pluginId,
                onClickBackButton: () =>
                  window.router.go("/settings/plugins/community"),
              })}
              <main>
                ${(() => {
                  if (loadError) {
                    return html`<div class="error-state">
                      <div>Failed to load plugin</div>
                      <button @click=${() => window.location.reload()}>
                        Try again
                      </button>
                    </div>`;
                  }
                  if (loading) {
                    return html`<div
                      class="plugins-loading-state"
                      data-testid="plugins-loading-state"
                    >
                      <div
                        class="loading-spinner"
                        data-testid="loading-spinner"
                      ></div>
                    </div>`;
                  }
                  if (!listing) {
                    return html`<p
                      class="error-message"
                      data-testid="plugin-listing-not-found"
                    >
                      Plugin not found.
                    </p>`;
                  }
                  return html`
                    <div
                      class="plugin-listing-header"
                      data-testid="plugin-listing-header"
                    >
                      <h1
                        class="plugin-listing-name"
                        data-testid="plugin-listing-name"
                      >
                        ${listing.name}
                        ${isLocal
                          ? html`<span class="plugin-local-badge">local</span>`
                          : ""}
                      </h1>
                      <div class="plugin-listing-meta">
                        ${version
                          ? html`<div class="plugin-listing-version">
                              Version: ${version}
                            </div>`
                          : ""}
                        <div class="plugin-listing-author">
                          By ${listing.author}
                        </div>
                        ${listing.repo
                          ? html`<div class="plugin-listing-repo">
                              Repository:
                              <a
                                href="https://github.com/${listing.repo}"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-external
                                >https://github.com/${listing.repo}</a
                              >
                            </div>`
                          : ""}
                      </div>
                      ${listing.description
                        ? html`<p class="plugin-listing-description">
                            ${listing.description}
                          </p>`
                        : ""}
                      <div class="plugin-listing-actions">
                        <button
                          class=${installButtonClass}
                          data-testid="plugin-listing-install-button"
                          ?disabled=${pendingAction !== null}
                          @click=${() => toggleInstall(listing)}
                        >
                          ${pendingAction
                            ? html`${pendingAction === "uninstall"
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
                    </div>
                    ${readme
                      ? html`<div class="plugin-listing-readme">
                          <rendered-markdown
                            data-testid="plugin-listing-readme"
                            content=${readme}
                          ></rendered-markdown>
                        </div>`
                      : ""}
                  `;
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await loadListings();
      await loadDetails();
    });

    root.addEventListener("page-restore", () => {
      // window.scrollTo(0, 0);
    });
  }
}

export default new SettingsCommunityPluginListingView();
