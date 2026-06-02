import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { auth } from "/js/auth.js";
import { Signal, ReactiveStore } from "/js/signals.js";

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

    const state = new ReactiveStore("settingsCommunityPluginsView");
    state.$error = new Signal.State(null);

    async function loadListings() {
      state.$error.set(null);
      try {
        await pluginService.loadRegistryListings();
      } catch (error) {
        console.error(error);
        state.$error.set(error.message ?? String(error));
      }
    }

    pageEffect(root, () => {
      const error = state.$error.get();
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
                            return html`
                              <li class="plugin-list-item">
                                <a
                                  class="plugin-list-item-link"
                                  href="/settings/plugins/community/${listing.id}"
                                >
                                  <div class="plugin-list-item-info">
                                    <div class="plugin-list-item-name">
                                      ${listing.name}
                                      ${listing.id.endsWith("__LOCAL")
                                        ? html`<span class="plugin-local-badge"
                                            >local</span
                                          >`
                                        : ""}
                                      ${listing.installed
                                        ? html`<span
                                            class="plugin-installed-badge"
                                            data-testid="plugin-installed-badge"
                                            >Installed</span
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
                                </a>
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
