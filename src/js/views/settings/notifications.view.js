import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { classnames } from "/js/utils.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { showToast } from "/js/toasts.js";
import { Signal, ReactiveStore } from "/js/signals.js";
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
    // The tier the service actually granted, which can differ from what was
    // asked for — the grant is account-level.
    chatPreviews: params.get("chat_previews") === "1",
  };
  history.replaceState(null, "", window.location.pathname);
  return result;
}

export default async function settingsNotificationsView({
  root,
  router,
  layout,
  context: { systemNotificationService, courierPushService },
}) {
  await auth.requireAuth();

  const state = new ReactiveStore("settingsNotificationsView");
  state.$enabled = new Signal.State(
    systemNotificationService?.isEnabled ?? false,
  );
  state.$pushBusy = new Signal.State(false);
  // The grant tier courier echoed back on the way in. Only ever known on the
  // page load that handled the callback — there is no way to read it back —
  // so it starts false on every other load.
  state.$chatPreviews = new Signal.State(false);

  async function handleToggle(checked) {
    if (!systemNotificationService) return;
    if (!checked) {
      systemNotificationService.disable();
      state.$enabled.set(false);
      return;
    }
    const result = await systemNotificationService.requestPermission();
    if (result === "granted") {
      state.$enabled.set(true);
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
    if (!courierPushService) return;
    if (!checked) {
      state.$pushBusy.set(true);
      try {
        await courierPushService.disable();
      } finally {
        state.$pushBusy.set(false);
      }
      return;
    }
    let permission = null;
    const confirmed = await confirmModal(
      "You'll be sent to the notification service to authorize a separate, read-only grant for delivering push notifications. You can turn this off again at any time.",
      {
        title: "Enable push notifications?",
        confirmButtonText: "Continue",
        onConfirm: () => {
          permission = Notification.requestPermission();
          return permission;
        },
      },
    );
    if (!confirmed) return;
    if ((await permission) !== "granted") {
      showToast(
        "Notifications are blocked for this site. Re-enable them in your browser's site settings.",
        { style: "error" },
      );
      return;
    }
    try {
      await courierPushService.startEnableFlow({
        chatPreviews: state.$chatPreviews.get(),
      });
    } catch (error) {
      console.error(error);
      showToast("Couldn't reach the notification service.", {
        style: "error",
      });
    }
  }

  // Changing tier is a re-authorization, not a local setting: it re-walks
  // the handoff for the other scope set. Enabling previews additionally
  // needs consent, since it lets the service read message content.
  async function handlePreviewsToggle(checked) {
    if (!courierPushService) return;
    if (checked) {
      const confirmed = await confirmModal(
        "Message previews let the notification service read the content of your messages, so it can show who sent a message and what it says. Without this, chat notifications only tell you that you have unread messages.",
        {
          title: "Show message previews?",
          confirmButtonText: "Continue",
        },
      );
      if (!confirmed) return;
    }
    try {
      await courierPushService.startEnableFlow({ chatPreviews: checked });
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
    state.$pushBusy.set(true);
    try {
      await courierPushService.completeEnableFlow();
      state.$chatPreviews.set(callback.chatPreviews);
      showToast("Push notifications enabled.");
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
    const isSupported = systemNotificationService?.isSupported ?? false;
    const permissionState =
      systemNotificationService?.permissionState ?? "unsupported";
    const isDenied = permissionState === "denied";

    let description =
      "Get notified of new activity while the page is open in a tab or window.";
    if (!isSupported) {
      description = "Not supported on this device.";
    } else if (isDenied) {
      description =
        "Notifications are blocked for this site. Re-enable them in your browser's site settings to turn this on.";
    }

    const pushEnabled = courierPushService?.isEnabled ?? false;
    const pushBusy = state.$pushBusy.get();
    const chatPreviews = state.$chatPreviews.get();
    const pushSupported = courierPushService?.isSupported ?? false;
    const serviceDid = courierPushService?.serviceDid ?? null;
    const hasService = serviceDid !== null;

    // One source of truth per row, so the dimmed style and the toggle's own
    // disabled state can't drift apart.
    const systemRowDisabled = !isSupported || isDenied;
    const pushRowDisabled = !pushSupported || !hasService || pushBusy;
    const previewsRowDisabled = pushBusy;

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
            data-testid="settings-section-system-notifications"
          >
            <div class="setting-item-info">
              <h2 class="setting-item-name">Desktop notifications</h2>
              <p class="setting-item-desc">${description}</p>
            </div>
            <div class="setting-item-control">
              <toggle-switch
                data-testid="system-notifications-toggle"
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
                  ? "Your browser doesn't support push notifications."
                  : hasService
                    ? "Get notified even when the page is closed."
                    : html`Get notified even when the page is closed. You must
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
          </section>
          ${pushEnabled
            ? html`<section
                class=${classnames("setting-item", {
                  "setting-item-disabled": previewsRowDisabled,
                })}
                data-testid="settings-section-chat-previews"
              >
                <div class="setting-item-info">
                  <h2 class="setting-item-name">Show message previews</h2>
                  <p class="setting-item-desc">
                    Include the sender and message text in chat notifications.
                    This lets your notification service read your messages. With
                    this off, chat notifications only say that you have unread
                    messages.
                  </p>
                </div>
                <div class="setting-item-control">
                  <toggle-switch
                    data-testid="chat-previews-toggle"
                    label="Show message previews"
                    ?checked=${chatPreviews}
                    ?disabled=${previewsRowDisabled}
                    @change=${(event) =>
                      handlePreviewsToggle(event.detail.checked)}
                  ></toggle-switch>
                </div>
              </section>`
            : null}
        </main>
      </div>`,
      root,
    );
  });
}
