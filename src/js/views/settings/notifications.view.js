import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { classnames } from "/js/utils.js";
import { choiceModal } from "/js/modals/choice.modal.js";
import { showToast } from "/js/toasts.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import "/js/components/toggle-switch.js";

function consumePushNotificationServiceCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("chat_previews") && !params.has("error")) return null;
  const result = {
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
  history.replaceState(null, "", window.location.pathname);
  return result;
}

export default async function settingsNotificationsView({
  root,
  router,
  layout,
  context: { auth, desktopNotificationService, pushNotificationService },
}) {
  await auth.requireAuth();

  const state = new ReactiveStore("settingsNotificationsView");
  state.$enabled = new Signal.State(
    desktopNotificationService?.isEnabled ?? false,
  );
  state.$pushBusy = new Signal.State(false);

  async function handleToggle(checked) {
    if (!desktopNotificationService) return;
    if (!checked) {
      desktopNotificationService.disable();
      state.$enabled.set(false);
      showToast("Desktop notifications disabled.");
      return;
    }
    const result = await desktopNotificationService.requestPermission();
    if (result === "granted") {
      state.$enabled.set(true);
      showToast("Desktop notifications enabled.", { style: "success" });
    } else {
      state.$enabled.set(false);
      if (result === "denied") {
        showToast(
          "Notifications are blocked for this site. Re-enable them in your browser's site settings.",
          { style: "error" },
        );
      }
    }
  }

  async function handlePushToggle(checked) {
    if (!pushNotificationService) return;
    if (!checked) {
      state.$pushBusy.set(true);
      try {
        await pushNotificationService.disable();
        showToast("Push notifications disabled.");
      } catch (error) {
        console.error(error);
        showToast("Couldn't fully disable push notifications.", {
          style: "error",
        });
      } finally {
        state.$pushBusy.set(false);
      }
      return;
    }
    await startPushEnableFlow();
  }

  async function startPushEnableFlow() {
    let permission = null;
    const choice = await choiceModal(
      "You'll be sent to the notification service to authorize push notifications. Message previews require additional read-only access to chat messages.",
      {
        title: "Enable push notifications?",
        choices: [
          {
            value: "with-previews",
            label: "Enable",
            style: "primary",
          },
          {
            value: "without-previews",
            label: "Enable without message previews",
            style: "primary",
          },
          { value: "cancel", label: "Cancel", style: "cancel" },
        ],
        onChoose: (value) => {
          if (value === "cancel") return null;
          permission = Notification.requestPermission();
          return permission;
        },
      },
    );
    if (choice === null || choice === "cancel") return;
    if ((await permission) !== "granted") {
      showToast(
        "Notifications are blocked for this site. Re-enable them in your browser's site settings.",
        { style: "error" },
      );
      return;
    }
    try {
      await pushNotificationService.startEnableFlow({
        chatPreviews: choice === "with-previews",
      });
    } catch (error) {
      console.error(error);
      showToast("Couldn't reach the notification service.", {
        style: "error",
      });
    }
  }

  (async () => {
    const callback = consumePushNotificationServiceCallbackParams();
    if (!callback || !pushNotificationService) return;
    if (callback.error) {
      showToast(
        callback.errorDescription || "Push notification setup was cancelled.",
        { style: "error" },
      );
      return;
    }
    state.$pushBusy.set(true);
    try {
      await pushNotificationService.completeEnableFlow();
      showToast("Push notifications enabled.", { style: "success" });
    } catch (error) {
      console.error(error);
      const message =
        error?.message === "denied"
          ? "Notifications are blocked for this site. Re-enable them in your browser's site settings."
          : "Couldn't finish enabling push notifications.";
      showToast(message, { style: "error" });
    } finally {
      state.$pushBusy.set(false);
    }
  })();

  bindPageTitle(root, () => "Notifications");

  pageEffect(root, () => {
    const enabled = state.$enabled.get();
    const isSupported = desktopNotificationService?.isSupported ?? false;
    const permissionState =
      desktopNotificationService?.permissionState ?? "unsupported";
    const isDenied = permissionState === "denied";

    let description =
      "Get notified of new activity while the page is open in a tab or window.";
    if (!isSupported) {
      description = "Not supported on this device.";
    } else if (isDenied) {
      description =
        "Notifications are blocked for this site. Re-enable them in your browser's site settings to turn this on.";
    }

    const pushEnabled = pushNotificationService?.isEnabled ?? false;
    const pushBusy = state.$pushBusy.get();
    const pushSupported = pushNotificationService?.isSupported ?? false;
    const pushRequiresInstall =
      pushNotificationService?.requiresInstall ?? false;
    const serviceDid = pushNotificationService?.serviceDid ?? null;
    const hasService = serviceDid !== null;
    const pushNeedsReauth = pushNotificationService?.needsReauth ?? false;
    const showReauthWarning =
      pushSupported && hasService && pushEnabled && pushNeedsReauth;

    const systemRowDisabled = !isSupported || isDenied;
    const pushRowDisabled = !pushSupported || !hasService || pushBusy;

    render(
      html`<div id="settings-notifications-view">
        ${headerTemplate({
          title: "Notifications",
          backButtonFallbackRoute: "/settings",
        })}
        <main>
          <section
            class=${classnames("setting-item", {
              "setting-item-disabled": systemRowDisabled,
            })}
            data-testid="settings-section-desktop-notifications"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Desktop notifications</h2>
              <p class="setting-item-desc">${description}</p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="desktop-notifications-toggle"
                label="Enable notifications"
                ?checked=${enabled}
                ?disabled=${systemRowDisabled}
                @change=${(event) => handleToggle(event.detail.checked)}
              ></toggle-switch>
            </div>
          </section>
          <section
            class=${classnames("setting-item", {
              "setting-item-disabled": pushRowDisabled,
            })}
            data-testid="settings-section-push-notifications"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Push notifications (beta)</h2>
              <p class="setting-item-desc">
                ${!pushSupported
                  ? pushRequiresInstall
                    ? "Only available in PWA mode (add to home screen)."
                    : "Only available on mobile devices."
                  : hasService
                    ? "Receive push notifications for new activity."
                    : html`Receive push notifications for new activity. You must
                        select a notification service in
                        <a
                          href="/settings/advanced"
                          data-testid="notification-service-unset"
                          >Advanced</a
                        >
                        to enable this feature.`}
              </p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="push-notifications-toggle"
                label="Enable push notifications"
                ?checked=${pushEnabled}
                ?disabled=${pushRowDisabled}
                @change=${(event) => handlePushToggle(event.detail.checked)}
              ></toggle-switch>
            </div>
            ${showReauthWarning
              ? html`
                  <div class="warning-area" data-testid="push-reauth-warning">
                    <h4>${alertIconTemplate()} Authorization needed</h4>
                    The notification service no longer accepts this device's
                    registration, so push notifications aren't being delivered.
                    Disable and reenable the setting to re-authorize.
                  </div>
                `
              : null}
          </section>
        </main>
      </div>`,
      root,
    );
  });
}
