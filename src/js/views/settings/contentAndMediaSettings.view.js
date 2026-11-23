import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { deviceState } from "/js/deviceState.js";
import { showToast } from "/js/toasts.js";
import { haptics } from "/js/haptics.js";
import "/js/components/toggle-switch.js";

function hapticsSettingTemplate({ hapticsDisabled, onChange }) {
  return html`<section
    class="setting-item"
    data-testid="settings-section-haptics"
  >
    <div class="setting-item-info">
      <h2 class="setting-item-name">Disable haptic feedback</h2>
      <p class="setting-item-desc">
        Stop vibrating when you like, repost, and more.
      </p>
    </div>
    <div class="setting-item-control">
      <toggle-switch
        data-testid="haptics-toggle"
        label="Disable haptic feedback"
        ?checked=${hapticsDisabled}
        @change=${(event) => onChange(event.detail.checked)}
      ></toggle-switch>
    </div>
  </section>`;
}

export default async function settingsContentAndMediaView({
  root,
  context: { auth, dataLayer },
}) {
  await auth.requireAuth();

  function handleAutoplayChange(enabled) {
    deviceState.$autoplayDisabledSetting.set(!enabled);
  }

  function handleHapticsChange(disabled) {
    deviceState.$hapticsDisabled.set(disabled);
  }

  function handleHandleLinkChange(shown) {
    deviceState.$handleLinkHidden.set(!shown);
  }

  function handleTrendingChange(shown) {
    dataLayer.mutations.setTrendingHidden(!shown);
  }

  function handleSuggestedFeedsChange(shown) {
    dataLayer.mutations.setSuggestedFeedsHidden(!shown);
  }

  async function handleThreadViewChange(isTree) {
    try {
      await dataLayer.mutations.setThreadView(isTree ? "tree" : "linear");
    } catch (error) {
      showToast("Failed to update thread view", { style: "error" });
    }
  }

  onPageShow(root, () => {
    dataLayer.preferencesProvider.requirePreferences().catch((error) => {
      console.warn("Failed to load preferences", error);
    });
  });

  bindPageTitle(root, () => "Content and media");

  pageEffect(root, () => {
    const autoplayDisabled = deviceState.$autoplayDisabled.get();
    const trendingHidden = dataLayer.derived.$trendingHidden.get();
    const suggestedFeedsHidden = dataLayer.derived.$suggestedFeedsHidden.get();
    const threadView = dataLayer.derived.$threadView.get();
    const hapticsDisabled = deviceState.$hapticsDisabled.get();
    const handleLinkHidden = deviceState.$handleLinkHidden.get();
    render(
      html`<div id="settings-content-and-media-view">
        ${headerTemplate({
          title: "Content and media",
          backButtonFallbackRoute: "/settings",
        })}
        <main>
          <section
            class="setting-item"
            data-testid="settings-section-thread-view"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Threaded replies</h2>
              <p class="setting-item-desc">
                Show post replies in a threaded tree view.
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="thread-view-toggle"
                label="Threaded replies"
                ?checked=${threadView === "tree"}
                ?disabled=${threadView === null}
                @change=${(event) =>
                  handleThreadViewChange(event.detail.checked)}
              ></toggle-switch>
            </div>
          </section>
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
          <section
            class="setting-item"
            data-testid="settings-section-handle-link"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Show link for custom handles</h2>
              <p class="setting-item-desc">
                Show a link to open custom domain handles in your browser.
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="handle-link-toggle"
                label="Show link for custom handles"
                ?checked=${!handleLinkHidden}
                @change=${(event) =>
                  handleHandleLinkChange(event.detail.checked)}
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
          <section
            class="setting-item"
            data-testid="settings-section-suggested-feeds"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Show suggested feeds</h2>
              <p class="setting-item-desc">
                Show suggested feeds in the sidebar.
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="suggested-feeds-toggle"
                label="Show suggested feeds"
                ?checked=${!suggestedFeedsHidden}
                @change=${(event) =>
                  handleSuggestedFeedsChange(event.detail.checked)}
              ></toggle-switch>
            </div>
          </section>
          ${haptics.isSupported()
            ? hapticsSettingTemplate({
                hapticsDisabled,
                onChange: handleHapticsChange,
              })
            : ""}
        </main>
      </div>`,
      root,
    );
  });
}
