import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindToPage, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { showToast } from "/js/toasts.js";
import { Signal } from "/js/signals.js";
import "/js/components/toggle-switch.js";

class SettingsNotificationsView extends View {
  async render({
    root,
    router,
    layout,
    context: { systemNotificationService, pushSubscriptionService },
  }) {
    await auth.requireAuth();

    const $enabled = new Signal.State(
      systemNotificationService?.isEnabled ?? false,
    );
    const $relayEnabled = new Signal.State(
      pushSubscriptionService?.isEnabled ?? false,
    );
    const $relayPending = new Signal.State(false);
    // null until the capability probe resolves; stays null forever on
    // deployments that haven't configured Tier 2, which hides the toggle.
    const $vapidKey = new Signal.State(null);

    if (pushSubscriptionService) {
      pushSubscriptionService.probeAvailability().then((key) => {
        $vapidKey.set(key);
      });
    }

    async function handleToggle(checked) {
      if (!systemNotificationService) return;
      if (!checked) {
        systemNotificationService.disable();
        $enabled.set(false);
        return;
      }
      const confirmed = await confirmModal(
        "Impro will ask your browser for permission to show notifications. You can turn this off again at any time.",
        { title: "Enable notifications?", confirmButtonText: "Continue" },
      );
      if (!confirmed) return;
      const result = await systemNotificationService.requestPermission();
      if (result === "granted") {
        $enabled.set(true);
      } else {
        $enabled.set(false);
        if (result === "denied") {
          showToast(
            "Notifications are blocked for this site. Re-enable them in your browser's site settings.",
            { style: "error" },
          );
        }
      }
    }

    async function handleRelayToggle(checked) {
      if (!pushSubscriptionService || $relayPending.get()) return;
      $relayPending.set(true);
      try {
        if (!checked) {
          await pushSubscriptionService.unsubscribe();
          $relayEnabled.set(false);
          return;
        }
        const vapidPublicKey = $vapidKey.get();
        if (!vapidPublicKey) return;
        const ok = await pushSubscriptionService.subscribe(vapidPublicKey);
        $relayEnabled.set(ok);
        if (!ok) {
          showToast("Couldn't enable notifications on your other devices.", {
            style: "error",
          });
        }
      } catch (error) {
        console.error(error);
        $relayEnabled.set(false);
        showToast("Couldn't enable notifications on your other devices.", {
          style: "error",
        });
      } finally {
        $relayPending.set(false);
      }
    }

    bindToPage(root, layout, "active-nav-click", (event) => {
      event.preventDefault();
      router.go("/settings");
    });

    bindPageTitle(root, () => "Notifications");

    pageEffect(root, () => {
      const enabled = $enabled.get();
      const isSupported = systemNotificationService?.isSupported ?? false;
      const permissionState =
        systemNotificationService?.permissionState ?? "unsupported";
      const isDenied = permissionState === "denied";

      let description =
        "Get notified when you have new activity while Impro is open in a tab or window.";
      if (!isSupported) {
        description = "Your browser doesn't support notifications.";
      } else if (isDenied) {
        description =
          "Notifications are blocked for this site. Re-enable them in your browser's site settings to turn this on.";
      }

      const vapidKey = $vapidKey.get();
      const relayEnabled = $relayEnabled.get();
      const relayPending = $relayPending.get();

      render(
        html`<div id="settings-notifications-view">
          ${headerTemplate({
            title: "Notifications",
            backButtonFallbackRoute: "/settings",
          })}
          <main>
            <section
              class="setting-item"
              data-testid="settings-section-system-notifications"
            >
              <div class="setting-item-info">
                <h2 class="setting-item-name">Enable system notifications</h2>
                <p class="setting-item-desc">${description}</p>
              </div>
              <div class="setting-item-control">
                <toggle-switch
                  data-testid="system-notifications-toggle"
                  label="Enable notifications"
                  ?checked=${enabled}
                  ?disabled=${!isSupported || isDenied}
                  @change=${(event) => handleToggle(event.detail.checked)}
                ></toggle-switch>
              </div>
            </section>
            ${vapidKey
              ? html`<section
                  class="setting-item"
                  data-testid="settings-section-relay-notifications"
                >
                  <div class="setting-item-info">
                    <h2 class="setting-item-name">Notify my other devices</h2>
                    <p class="setting-item-desc">
                      ${enabled
                        ? "When this device sees new activity, also send a notification to your other signed-in devices, even if they're closed."
                        : "Enable system notifications above first."}
                    </p>
                  </div>
                  <div class="setting-item-control">
                    <toggle-switch
                      data-testid="relay-notifications-toggle"
                      label="Notify my other devices"
                      ?checked=${relayEnabled}
                      ?disabled=${!enabled || relayPending}
                      @change=${(event) =>
                        handleRelayToggle(event.detail.checked)}
                    ></toggle-switch>
                  </div>
                </section>`
              : null}
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsNotificationsView();
