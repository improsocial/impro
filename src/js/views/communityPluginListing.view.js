import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { linkToLogin, getPermalinkForCommunityPlugin } from "/js/navigation.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { PermissionsDeclinedError } from "/js/plugins/pluginService.js";
import { repoWebUrl } from "/js/plugins/sourceProvider.js";
import "/js/components/rendered-markdown.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";

class CommunityPluginListingView extends View {
  async render({ root, params, context: { pluginService, isAuthenticated } }) {
    const { pluginId } = params;
    const isLocal = pluginId.endsWith("__LOCAL");

    const state = new ReactiveStore("communityPluginListingView");
    state.$loadError = new Signal.State(null);
    state.$version = new Signal.State(null);
    state.$readme = new Signal.State(null);
    state.$loading = new Signal.State(true);
    state.$pendingAction = new Signal.State(null); // ("install" | "uninstall")

    state.$listing = new Signal.Computed(() => {
      const listings = pluginService.$registryListings.get();
      if (!listings) return null;
      return listings.find((listing) => listing.id === pluginId) ?? null;
    });

    async function loadListings() {
      state.$loadError.set(null);
      try {
        await pluginService.loadRegistryListings();
      } catch (error) {
        console.error(error);
        state.$loadError.set(error.message ?? String(error));
      }
    }

    async function loadDetails() {
      const listing = state.$listing.get();
      if (!listing) {
        state.$loading.set(false);
        return;
      }
      const { id, repo } = listing;
      await Promise.all([
        pluginService
          .getLiveManifest(id, repo)
          .then((manifest) => state.$version.set(manifest?.version ?? null))
          .catch((error) =>
            console.error("Failed to load plugin manifest", error),
          ),
        pluginService
          .getReadme(id, repo)
          .then((readme) => state.$readme.set(readme))
          .catch((error) =>
            console.error("Failed to load plugin README", error),
          ),
      ]);
      state.$loading.set(false);
    }

    async function toggleInstall(listing) {
      const wasInstalled = listing.installed;
      if (wasInstalled) {
        const confirmed = await confirmModal(
          `"${listing.name}" will be uninstalled and its settings will be deleted.`,
          {
            title: "Uninstall plugin?",
            confirmButtonStyle: "danger",
            confirmButtonText: "Uninstall",
          },
        );
        if (!confirmed) return;
      }
      state.$pendingAction.set(wasInstalled ? "uninstall" : "install");
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
      state.$pendingAction.set(null);
    }

    function installButtonTemplate({ listing, pendingAction }) {
      const installButtonClass = listing.installed
        ? "plugin-install-button rounded-button"
        : "plugin-install-button rounded-button rounded-button-primary";
      return html`<button
        class=${installButtonClass}
        data-testid="plugin-listing-install-button"
        ?disabled=${pendingAction !== null}
        @click=${() => toggleInstall(listing)}
      >
        ${pendingAction
          ? html`${pendingAction === "uninstall"
                ? "Uninstalling"
                : "Installing"}
              <div class="loading-spinner" data-testid="loading-spinner"></div>`
          : listing.installed
            ? "Uninstall"
            : "Install"}
      </button>`;
    }

    pageEffect(root, () => {
      const listing = state.$listing.get();
      const loadError = state.$loadError.get();
      const version = state.$version.get();
      const readme = state.$readme.get();
      const loading = state.$loading.get();
      const pendingAction = state.$pendingAction.get();
      const pluginPermalink = getPermalinkForCommunityPlugin(pluginId);
      render(
        html`<div id="community-plugin-listing-view">
          ${headerTemplate({
            title: "Community plugins",
            backButtonFallbackRoute: "/plugins/community",
            rightItemTemplate: listing
              ? () => html`
                  <button
                    class="context-menu-button"
                    @click=${function (e) {
                      const contextMenu = this.nextElementSibling;
                      contextMenu.open(e.clientX, e.clientY);
                    }}
                  >
                    <span>...</span>
                  </button>
                  <context-menu>
                    <context-menu-item
                      data-testid="menu-action-plugin-copy-link"
                      @click=${() => {
                        navigator.clipboard.writeText(pluginPermalink);
                        showToast("Link copied to clipboard", {
                          style: "success",
                        });
                      }}
                    >
                      Copy link to plugin
                    </context-menu-item>
                  </context-menu>
                `
              : null,
          })}
          <main>
            ${(() => {
              if (loadError) {
                return html`<div class="error-state">
                  <div>Failed to load plugin</div>
                  <button
                    class="rounded-button"
                    @click=${() => window.location.reload()}
                  >
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
                            href="${repoWebUrl(listing.repo)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-external
                            >${repoWebUrl(listing.repo)}</a
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
                    ${isAuthenticated
                      ? installButtonTemplate({ listing, pendingAction })
                      : html`<a
                          class="plugin-install-button rounded-button rounded-button-primary"
                          data-testid="plugin-listing-login-button"
                          href=${linkToLogin()}
                          >Sign in to install</a
                        >`}
                  </div>
                </div>
                ${readme
                  ? html` <div class="plugin-listing-readme">
                      <rendered-markdown
                        data-testid="plugin-listing-readme"
                        content=${readme}
                      ></rendered-markdown>
                    </div>`
                  : ""}
              `;
            })()}
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      await loadListings();
      await loadDetails();
    });

    root.addEventListener("page-restore", () => {
      // window.scrollTo(0, 0);
    });
  }
}

export default new CommunityPluginListingView();
