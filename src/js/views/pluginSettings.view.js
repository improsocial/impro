import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import "/js/components/plugin-custom-content.js";
import { showToast } from "/js/toasts.js";

function pluginOwnedSettingsTemplate({ pluginService, settingTab }) {
  return html`<section
    class="plugin-owned-settings"
    data-testid="plugin-owned-settings"
  >
    <div class="plugin-content plugin-content-page">
      <plugin-custom-content
        .pluginService=${pluginService}
        .customContent=${settingTab.customContent}
      ></plugin-custom-content>
    </div>
  </section>`;
}

function systemSettingsTemplate({ origins, onRevoke }) {
  return html`<section
    class="plugin-system-settings"
    data-testid="plugin-system-settings"
  >
    <div class="plugin-system-settings-bar">System settings</div>
    <div
      class="plugin-system-settings-body"
      data-testid="plugin-network-access"
    >
      <h2 class="plugin-network-access-title">Network access</h2>
      <p class="plugin-network-access-description">
        You granted this plugin permission to send requests to these addresses.
      </p>
      <ul class="plugin-network-access-list">
        ${origins.map(
          (origin) =>
            html`<li class="plugin-network-access-item">
              <code>${origin}</code>
              <button
                class="rounded-button"
                data-testid="revoke-fetch-origin"
                aria-label="Revoke access to ${origin}"
                @click=${() => onRevoke(origin)}
              >
                Revoke
              </button>
            </li>`,
        )}
      </ul>
    </div>
  </section>`;
}

export default async function pluginSettingsView({
  root,
  router,
  layout,
  params,
  context: { auth, pluginService },
}) {
  await auth.requireAuth();

  const { pluginId } = params;

  const state = new ReactiveStore("pluginSettingsView");
  state.$pluginDetails = new Signal.Computed(() => {
    const installed = pluginService.$installedPlugins
      .get()
      .find((plugin) => plugin.id === pluginId);
    return installed ?? null;
  });

  state.$settingTab = new Signal.Computed(() => {
    const tab = pluginService.$settingTabs.get(pluginId);
    return tab ?? null;
  });
  state.$loadStatus = new Signal.Computed(() =>
    pluginService.getPluginLoadStatus(pluginId),
  );

  bindPageTitle(root, () => {
    return state.$pluginDetails.get()?.name ?? null;
  });

  pageEffect(root, () => {
    const pluginDetails = state.$pluginDetails.get();
    const settingTab = state.$settingTab.get();
    const { loading: pluginLoading, error: pluginLoadError } =
      state.$loadStatus.get();
    render(
      html`<div id="plugin-settings-view">
        ${headerTemplate({
          title: pluginDetails?.name ?? pluginId,
          backButtonFallbackRoute: "/plugins/installed",
        })}
        <main>
          ${(() => {
            if (!pluginDetails) {
              return html`<p
                class="error-message"
                data-testid="plugin-detail-not-found"
              >
                Plugin not found.
              </p>`;
            }
            if (!pluginDetails.enabled) {
              return html`<p
                class="error-message"
                data-testid="plugin-detail-disabled"
              >
                This plugin is not enabled.
              </p>`;
            }
            if (pluginLoadError) {
              return html`<p
                class="error-message"
                data-testid="plugin-detail-load-failed"
              >
                ${pluginLoadError.message ?? "This plugin failed to load."}
              </p>`;
            }
            const grantedOrigins =
              pluginService.permissionsManager.getUserGrantedFetchOrigins(
                pluginId,
              );
            if (!settingTab) {
              if (pluginLoading) {
                return html`<div class="plugins-loading-state">
                  <div class="loading-spinner"></div>
                </div>`;
              }
              if (grantedOrigins.length === 0) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-detail-no-settings"
                >
                  This plugin has no settings.
                </p>`;
              }
            }
            return html`${settingTab
              ? pluginOwnedSettingsTemplate({ pluginService, settingTab })
              : ""}
            ${grantedOrigins.length > 0
              ? systemSettingsTemplate({
                  origins: grantedOrigins,
                  onRevoke: (origin) =>
                    pluginService.permissionsManager
                      .revokeUserGrantedFetchOrigin(pluginId, origin)
                      .catch((e) => {
                        console.error(e);
                        showToast("Failed to revoke access", {
                          style: "error",
                        });
                      }),
                })
              : ""}`;
          })()}
        </main>
      </div>`,
      root,
    );
  });
}
