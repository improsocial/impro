import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindToPage, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { classnames } from "/js/utils.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { showToast } from "/js/toasts.js";
import { Signal } from "/js/signals.js";
import "/js/components/toggle-switch.js";

// Reads and clears the courier auth-handoff callback params
// (chat_previews/error/error_description) so a refresh or back-navigation
// doesn't re-trigger handling.
function consumeCourierCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("chat_previews") && !params.has("error")) return null;
  const result = {
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
  history.replaceState(null, "", window.location.pathname);
  return result;
}

class SettingsNotificationsView extends View {
  async render({
    root,
    router,
    layout,
    context: { systemNotificationService, courierPushService },
  }) {
    await auth.requireAuth();

    const $enabled = new Signal.State(
      systemNotificationService?.isEnabled ?? false,
    );
    const $pushEnabled = new Signal.State(
      courierPushService?.isEnabled ?? false,
    );
    const $pushBusy = new Signal.State(false);

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

    async function handlePushToggle(checked) {
      if (!courierPushService) return;
      if (!checked) {
        $pushBusy.set(true);
        try {
          await courierPushService.disable();
        } finally {
          $pushBusy.set(false);
        }
        $pushEnabled.set(false);
        return;
      }
      const confirmed = await confirmModal(
        "You'll be sent to Impro Courier to authorize a separate, read-only grant for delivering push notifications. You can turn this off again at any time.",
        { title: "Enable push notifications?", confirmButtonText: "Continue" },
      );
      if (!confirmed) return;
      try {
        await courierPushService.startEnableFlow();
      } catch (error) {
        console.error(error);
        showToast("Couldn't reach the notification service.", {
          style: "error",
        });
      }
    }

    // Handle a return from courier's auth handoff (see
    // CourierPushService.startEnableFlow/completeEnableFlow).
    (async () => {
      const callback = consumeCourierCallbackParams();
      if (!callback || !courierPushService) return;
      if (callback.error) {
        showToast(
          callback.errorDescription || "Push notification setup was cancelled.",
          { style: "error" },
        );
        return;
      }
      $pushBusy.set(true);
      try {
        await courierPushService.completeEnableFlow();
        $pushEnabled.set(true);
        showToast("Push notifications enabled.");
      } catch (error) {
        console.error(error);
        const message =
          error?.message === "denied"
            ? "Notifications are blocked for this site. Re-enable them in your browser's site settings."
            : "Couldn't finish enabling push notifications.";
        showToast(message, { style: "error" });
      } finally {
        $pushBusy.set(false);
      }
    })();

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
        description = "Not supported on this device.";
      } else if (isDenied) {
        description =
          "Notifications are blocked for this site. Re-enable them in your browser's site settings to turn this on.";
      }

      const pushEnabled = $pushEnabled.get();
      const pushBusy = $pushBusy.get();
      const pushSupported = courierPushService?.isSupported ?? false;
      const pushDescription = pushSupported
        ? "Get notified even when Impro is closed, via Impro Courier."
        : "Your browser doesn't support push notifications.";

      render(
        html`<div id="settings-notifications-view">
          ${headerTemplate({
            title: "Notifications",
            backButtonFallbackRoute: "/settings",
          })}
          <main>
            <section
              class=${classnames("setting-item", {
                "setting-item-disabled": !isSupported,
              })}
              data-testid="settings-section-system-notifications"
            >
              <div class="setting-item-info">
                <h2 class="setting-item-name">Enable desktop notifications</h2>
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
            <section
              class="setting-item"
              data-testid="settings-section-push-notifications"
            >
              <div class="setting-item-info">
                <h2 class="setting-item-name">Push notifications</h2>
                <p class="setting-item-desc">${pushDescription}</p>
              </div>
              <div class="setting-item-control">
                <toggle-switch
                  data-testid="push-notifications-toggle"
                  label="Enable push notifications"
                  ?checked=${pushEnabled}
                  ?disabled=${!pushSupported || pushBusy}
                  @change=${(event) => handlePushToggle(event.detail.checked)}
                ></toggle-switch>
              </div>
            </section>
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
