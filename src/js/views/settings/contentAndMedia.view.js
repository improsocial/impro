import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { deviceState } from "/js/deviceState.js";
import "/js/components/toggle-switch.js";

export default async function settingsContentAndMediaView({
  root,
  context: { auth, dataLayer },
}) {
  await auth.requireAuth();

  function handleAutoplayChange(enabled) {
    deviceState.$autoplayDisabledSetting.set(!enabled);
  }

  function handleTrendingChange(shown) {
    dataLayer.mutations.setTrendingHidden(!shown);
  }

  bindPageTitle(root, () => "Content and media");

  pageEffect(root, () => {
    const autoplayDisabled = deviceState.$autoplayDisabled.get();
    const trendingHidden = dataLayer.derived.$trendingHidden.get();
    render(
      html`<div id="settings-content-and-media-view">
        ${headerTemplate({
          title: "Content and media",
          backButtonFallbackRoute: "/settings",
        })}
        <main>
          <section class="setting-item" data-testid="settings-section-autoplay">
            <div class="setting-item-info">
              <h2 class="setting-item-name">Autoplay videos and GIFs</h2>
              <p class="setting-item-desc">
                Play videos and GIFs automatically as they scroll into view.
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="autoplay-toggle"
                label="Autoplay videos and GIFs"
                ?checked=${!autoplayDisabled}
                @change=${(event) => handleAutoplayChange(event.detail.checked)}
              ></toggle-switch>
            </div>
          </section>
          <section class="setting-item" data-testid="settings-section-trending">
            <div class="setting-item-info">
              <h2 class="setting-item-name">Show trending topics</h2>
              <p class="setting-item-desc">
                Show trending topics in the sidebar.
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="trending-toggle"
                label="Show trending topics"
                ?checked=${!trendingHidden}
                @change=${(event) => handleTrendingChange(event.detail.checked)}
              ></toggle-switch>
            </div>
          </section>
        </main>
      </div>`,
      root,
    );
  });
}
