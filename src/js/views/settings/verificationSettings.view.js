import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { showToast } from "/js/toasts.js";
import "/js/components/toggle-switch.js";

export default async function settingsVerificationView({
  root,
  context: { auth, dataLayer },
}) {
  await auth.requireAuth();

  async function handleShowBadgesChange(shown) {
    try {
      await dataLayer.mutations.setVerificationBadgesHidden(!shown);
    } catch (error) {
      showToast("Failed to update verification settings", { style: "error" });
    }
  }

  onPageShow(root, () => {
    dataLayer.preferencesProvider.requirePreferences().catch((error) => {
      console.warn("Failed to load preferences", error);
    });
  });

  bindPageTitle(root, () => "Verification");

  pageEffect(root, () => {
    const badgesHidden = dataLayer.derived.$verificationBadgesHidden.get();
    render(
      html`<div id="settings-verification-view">
        ${headerTemplate({
          title: "Verification",
          backButtonFallbackRoute: "/settings",
        })}
        <main>
          <section
            class="setting-item"
            data-testid="settings-section-verification-badges"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Show verification badges</h2>
              <p class="setting-item-desc">
                Show check badges next to verified accounts and trusted
                verifiers.
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="verification-badges-toggle"
                label="Show verification badges"
                ?checked=${badgesHidden === false}
                ?disabled=${badgesHidden === null}
                @change=${(event) =>
                  handleShowBadgesChange(event.detail.checked)}
              ></toggle-switch>
            </div>
          </section>
        </main>
      </div>`,
      root,
    );
  });
}
