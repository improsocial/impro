import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { linkToCommunityPlugin } from "/js/navigation.js";

class CommunityPluginsView extends View {
  async render({ root, context: { pluginService, isAuthenticated } }) {
    const state = new ReactiveStore("communityPluginsView");
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

    bindPageTitle(root, () => "Community plugins");

    pageEffect(root, () => {
      const error = state.$error.get();
      const listings = pluginService.$registryListings.get();
      render(
        html`<div id="community-plugins-view">
          ${headerTemplate({
            title: "Community plugins",
          })}
          <main>
            ${error
              ? html`<div class="error-state">
                  <div>Failed to load plugins</div>
                  <button class="rounded-button" @click=${() => loadListings()}>
                    Try again
                  </button>
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
                              href=${linkToCommunityPlugin(listing.id)}
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
                              <span class="plugin-list-item-arrow"
                                >${chevronRightIconTemplate()}</span
                              >
                            </a>
                          </li>
                        `;
                      })}
                    </ul>`}
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      await loadListings();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
      loadListings();
    });
  }
}

export default new CommunityPluginsView();
