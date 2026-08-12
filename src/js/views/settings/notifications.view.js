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
    // The tier the service actually granted, which can differ from what was
    // asked for — the grant is account-level.
    chatPreviews: params.get("chat_previews") === "1",
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
    const $chatPreviews = new Signal.State(
      courierPushService?.chatPreviewsEnabled ?? false,
    );
    const $pushBusy = new Signal.State(false);

    // The service is user-selectable per the spec, so its name is data, not a
    // constant — every mention of it in this view comes from the service's own
    // config document. Falls back to the DID until that resolves.
    const $serviceDid = new Signal.State(courierPushService?.serviceDid ?? "");
    const $serviceName = new Signal.State(courierPushService?.serviceDid ?? "");
    const $pickerOpen = new Signal.State(false);
    const $pickerValue = new Signal.State("");
    const $pickerBusy = new Signal.State(false);
    const $pickerError = new Signal.State("");

    async function loadServiceName() {
      if (!courierPushService) return;
      const did = courierPushService.serviceDid;
      $serviceDid.set(did);
      try {
        const { name } = await courierPushService.previewService(did);
        // Guard against a slow lookup landing after the user switched again.
        if (courierPushService.serviceDid === did) $serviceName.set(name);
      } catch {
        // Unreachable service: show the DID rather than an empty heading. The
        // failure surfaces properly when the user tries to enable.
        if (courierPushService.serviceDid === did) $serviceName.set(did);
      }
    }
    loadServiceName();

    async function handleServiceSelect() {
      const did = $pickerValue.get().trim();
      if (!did || !courierPushService) return;
      if (!did.startsWith("did:")) {
        $pickerError.set("That doesn't look like a DID.");
        return;
      }
      $pickerBusy.set(true);
      $pickerError.set("");
      try {
        // Resolve before switching: an unreachable or non-conforming service
        // should fail here, not after the current one has been torn down.
        const { name } = await courierPushService.previewService(did);
        const wasEnabled = courierPushService.isEnabled;
        await courierPushService.selectService(did);
        $pushEnabled.set(courierPushService.isEnabled);
        $chatPreviews.set(courierPushService.chatPreviewsEnabled);
        $serviceDid.set(did);
        $serviceName.set(name);
        $pickerOpen.set(false);
        $pickerValue.set("");
        showToast(
          wasEnabled
            ? `Switched to ${name}. Turn push notifications back on to finish.`
            : `Switched to ${name}.`,
        );
      } catch (error) {
        console.error(error);
        $pickerError.set(
          "Couldn't reach that service, or it isn't a notification service.",
        );
      } finally {
        $pickerBusy.set(false);
      }
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
        await courierPushService.startEnableFlow({
          chatPreviews: $chatPreviews.get(),
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
          "Message previews let Impro Courier read the content of your messages, so it can show who sent a message and what it says. Without this, chat notifications only tell you that you have unread messages.",
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
      $pushBusy.set(true);
      try {
        await courierPushService.completeEnableFlow({
          chatPreviews: callback.chatPreviews,
        });
        $pushEnabled.set(true);
        $chatPreviews.set(callback.chatPreviews);
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
      const chatPreviews = $chatPreviews.get();
      const pushSupported = courierPushService?.isSupported ?? false;
      const serviceName = $serviceName.get();
      const serviceDid = $serviceDid.get();
      const pickerOpen = $pickerOpen.get();
      const pickerBusy = $pickerBusy.get();
      const pickerError = $pickerError.get();
      const pushDescription = pushSupported
        ? `Get notified even when Impro is closed, via ${serviceName}.`
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
            ${pushEnabled
              ? html`<section
                  class="setting-item"
                  data-testid="settings-section-chat-previews"
                >
                  <div class="setting-item-info">
                    <h2 class="setting-item-name">Show message previews</h2>
                    <p class="setting-item-desc">
                      Include the sender and message text in chat notifications.
                      This lets ${serviceName} read your messages. With this
                      off, chat notifications only say that you have unread
                      messages.
                    </p>
                  </div>
                  <div class="setting-item-control">
                    <toggle-switch
                      data-testid="chat-previews-toggle"
                      label="Show message previews"
                      ?checked=${chatPreviews}
                      ?disabled=${pushBusy}
                      @change=${(event) =>
                        handlePreviewsToggle(event.detail.checked)}
                    ></toggle-switch>
                  </div>
                </section>`
              : null}
            ${pushSupported
              ? html`<section
                  class="setting-item"
                  data-testid="settings-section-notification-service"
                >
                  <div class="setting-item-info">
                    <h2 class="setting-item-name">Notification service</h2>
                    <p class="setting-item-desc">
                      Push notifications are delivered by
                      <strong>${serviceName}</strong>, which holds a read-only
                      grant to watch this account's notifications on your
                      behalf. You can point Impro at a different service, or run
                      your own. <br /><code>${serviceDid}</code>
                    </p>
                    ${pickerOpen
                      ? html`<div class="notification-service-picker">
                          <input
                            type="text"
                            inputmode="url"
                            autocapitalize="off"
                            autocomplete="off"
                            spellcheck="false"
                            data-testid="notification-service-input"
                            placeholder="did:web:notifs.example.com"
                            .value=${$pickerValue.get()}
                            ?disabled=${pickerBusy}
                            @input=${(event) =>
                              $pickerValue.set(event.target.value)}
                            @keydown=${(event) => {
                              if (event.key === "Enter") handleServiceSelect();
                            }}
                          />
                          <p class="setting-item-desc">
                            A notification service can read this account's
                            notifications, and its message content if you turn
                            previews on. Only use one you trust.
                          </p>
                          ${pickerError
                            ? html`<p
                                class="setting-item-desc error"
                                data-testid="notification-service-error"
                              >
                                ${pickerError}
                              </p>`
                            : null}
                          <button
                            class="button"
                            data-testid="notification-service-save"
                            ?disabled=${pickerBusy}
                            @click=${handleServiceSelect}
                          >
                            ${pickerBusy ? "Checking…" : "Use this service"}
                          </button>
                          <button
                            class="button secondary"
                            ?disabled=${pickerBusy}
                            @click=${() => {
                              $pickerOpen.set(false);
                              $pickerError.set("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>`
                      : html`<button
                          class="button secondary"
                          data-testid="notification-service-change"
                          @click=${() => {
                            $pickerValue.set(serviceDid);
                            $pickerError.set("");
                            $pickerOpen.set(true);
                          }}
                        >
                          Change service
                        </button>`}
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
