import { html, render } from "/js/lib/lit-html.js";
import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
} from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { linkToCommunityPlugin, linkToLogin } from "/js/navigation.js";

export default async function communityPluginsView({
  root,
  router,
  layout,
  context: { pluginService, isAuthenticated },
}) {
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
          ${!isAuthenticated
            ? html`<div
                class="plugins-intro"
                data-testid="community-plugins-intro"
              >
                <div class="plugins-intro-header">
                  <span class="plugins-intro-icon">${globeIconTemplate()}</span>
                  <div class="plugins-intro-title">
                    Extend Impro with plugins
                  </div>
                </div>
                <p class="plugins-intro-message">
                  Community plugins are built by other people using Impro. They
                  can add new themes, display options, and functionality to the
                  app.
                </p>
                <a
                  class="rounded-button rounded-button-primary"
                  data-testid="plugins-intro-login-button"
                  href=${linkToLogin()}
                  >Sign in to install</a
                >
              </div>`
            : ""}
          ${error
            ? html`<div class="error-state">
                <div>Failed to load plugins</div>
                <button
                  class="rounded-button rounded-button-secondary-inverted"
                  @click=${() => loadListings()}
                >
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

  function loadPageData() {
    loadListings();
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });

  bindToPage(root, layout, "active-nav-click", () => {
    loadPageData();
  });
}
