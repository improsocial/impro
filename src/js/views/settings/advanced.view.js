import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { AppViewConfig, DEFAULT_APP_VIEW_CONFIGS } from "/js/config.js";
import {
  getAppViewConfig,
  setAppViewConfig,
  isValidAppViewConfig,
  CUSTOM_APP_VIEW_CONFIG_ID,
} from "/js/appViewConfig.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import { showToast } from "/js/toasts.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { PermissionsDeclinedError } from "/js/plugins/pluginService.js";

class SettingsAdvancedView extends View {
  async render({ root, context: { dataLayer, pluginService, mainLayout } }) {
    await auth.requireAuth();

    const storedConfig = getAppViewConfig();
    const isStoredCustom = storedConfig.id === CUSTOM_APP_VIEW_CONFIG_ID;

    const state = new ReactiveStore("settingsAdvancedView");
    state.$loading = new Signal.State(false);
    state.$errorMessage = new Signal.State(null);
    state.$appViewSelection = new Signal.State(storedConfig.id);
    state.$customAppViewServiceDid = new Signal.State(
      isStoredCustom ? storedConfig.appViewServiceDid : "",
    );
    state.$customChatServiceDid = new Signal.State(
      isStoredCustom ? storedConfig.chatServiceDid : "",
    );
    state.$pluginInstallLoading = new Signal.State(false);

    function resolveSelectedAppViewConfig() {
      if (state.$appViewSelection.get() === CUSTOM_APP_VIEW_CONFIG_ID) {
        return {
          id: CUSTOM_APP_VIEW_CONFIG_ID,
          appViewServiceDid: state.$customAppViewServiceDid.get().trim(),
          chatServiceDid: state.$customChatServiceDid.get().trim(),
        };
      }
      return (
        DEFAULT_APP_VIEW_CONFIGS.find(
          (config) => config.id === state.$appViewSelection.get(),
        ) ?? AppViewConfig.BLUESKY
      );
    }

    function isDirty() {
      if (state.$appViewSelection.get() !== storedConfig.id) return true;
      if (state.$appViewSelection.get() === CUSTOM_APP_VIEW_CONFIG_ID) {
        return (
          state.$customAppViewServiceDid.get() !==
            storedConfig.appViewServiceDid ||
          state.$customChatServiceDid.get() !== storedConfig.chatServiceDid
        );
      }
      return false;
    }

    function handleSubmit(e) {
      e.preventDefault();
      const selectedConfig = resolveSelectedAppViewConfig();
      if (!isValidAppViewConfig(selectedConfig)) {
        state.$errorMessage.set("Invalid App View configuration");
        return;
      }
      state.$loading.set(true);
      state.$errorMessage.set(null);
      setAppViewConfig(selectedConfig);
      window.location.reload();
    }

    function handleAppViewChange(e) {
      state.$appViewSelection.set(e.target.value);
    }

    function handleCustomAppViewDidInput(e) {
      state.$customAppViewServiceDid.set(e.target.value);
    }

    function handleCustomChatDidInput(e) {
      state.$customChatServiceDid.set(e.target.value);
    }

    async function handleInstallPlugin(e) {
      e.preventDefault();
      const input = e.target.elements.pluginUrl;
      const url = input.value.trim();
      if (!url) return;
      state.$pluginInstallLoading.set(true);
      try {
        const result = await pluginService.installUnregisteredPlugin(url);
        input.value = "";
        showToast(`Installed ${result.name}`, { style: "success" });
      } catch (error) {
        if (error instanceof PermissionsDeclinedError) {
          // User declined the permission prompt; nothing to report.
        } else {
          showToast(error?.message ?? "Failed to install plugin", {
            style: "error",
          });
        }
      } finally {
        state.$pluginInstallLoading.set(false);
      }
    }

    pageEffect(root, () => {
      const isCustom =
        state.$appViewSelection.get() === CUSTOM_APP_VIEW_CONFIG_ID;
      render(
        html`<div id="settings-advanced-view">
          ${mainLayout({
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.router.go("/settings"),
            children: html`${headerTemplate({
                title: "Advanced",
                onClickBackButton: () => window.router.go("/settings"),
              })}
              <main>
                <form
                  id="settings-advanced-form"
                  @submit=${(e) => handleSubmit(e)}
                >
                  <section class="settings-section">
                    <h2>App View</h2>
                    <p>
                      Choose which App View (backend) to use for fetching
                      content. Tip: You can use the query parameter
                      ?reset-appview to reset the App View in case of
                      misconfiguration.
                    </p>
                    <div class="form-group">
                      <div class="select-wrapper">
                        <select
                          id="appview"
                          name="appview"
                          @change=${(e) => handleAppViewChange(e)}
                        >
                          ${DEFAULT_APP_VIEW_CONFIGS.map(
                            (defaultConfig) => html`
                              <option
                                value=${defaultConfig.id}
                                ?selected=${state.$appViewSelection.get() ===
                                defaultConfig.id}
                              >
                                ${defaultConfig.displayName}
                              </option>
                            `,
                          )}
                          <option
                            value=${CUSTOM_APP_VIEW_CONFIG_ID}
                            ?selected=${state.$appViewSelection.get() ===
                            CUSTOM_APP_VIEW_CONFIG_ID}
                          >
                            Custom
                          </option>
                        </select>
                      </div>
                    </div>
                    ${isCustom
                      ? html`
                          <div
                            class="warning-area"
                            data-testid="custom-appview-warning"
                          >
                            <h4>${alertIconTemplate()} Warning</h4>
                            Only set these values if you know what they mean!
                          </div>
                          <div class="form-group">
                            <label for="appViewServiceDid">
                              App View service DID
                            </label>
                            <input
                              id="appViewServiceDid"
                              name="appViewServiceDid"
                              type="text"
                              placeholder="did:web:example.com#bsky_appview"
                              required
                              autocorrect="off"
                              autocapitalize="off"
                              spellcheck="false"
                              .value=${state.$customAppViewServiceDid.get()}
                              @input=${(e) => handleCustomAppViewDidInput(e)}
                            />
                          </div>
                          <div class="form-group">
                            <label for="chatServiceDid">Chat service DID</label>
                            <input
                              id="chatServiceDid"
                              name="chatServiceDid"
                              type="text"
                              placeholder="did:web:example.com#bsky_chat"
                              required
                              autocorrect="off"
                              autocapitalize="off"
                              spellcheck="false"
                              .value=${state.$customChatServiceDid.get()}
                              @input=${(e) => handleCustomChatDidInput(e)}
                            />
                          </div>
                        `
                      : ""}

                    <div class="button-group">
                      <button
                        type="submit"
                        class="settings-button"
                        ?disabled=${state.$loading.get() || !isDirty()}
                      >
                        Save and reload
                        ${state.$loading.get()
                          ? html`<div class="loading-spinner"></div>`
                          : ""}
                      </button>
                    </div>
                    <div class="error-message-container">
                      ${state.$errorMessage.get()
                        ? html`<div class="error-message">
                            ${state.$errorMessage.get()}
                          </div>`
                        : ""}
                    </div>
                  </section>
                </form>
                <form
                  id="install-unregistered-plugin-form"
                  @submit=${(e) => handleInstallPlugin(e)}
                >
                  <section class="settings-section">
                    <h2>Install plugin from URL</h2>
                    <p>
                      Install a plugin directly from a public GitHub repository.
                      The repo must contain a valid manifest.json on its main
                      branch.
                    </p>
                    <div class="warning-area">
                      <h4>${alertIconTemplate()} Warning</h4>
                      Unregistered plugins have not been reviewed. Only install
                      plugins from sources you trust.
                    </div>
                    <div class="form-group">
                      <label for="pluginUrl">GitHub repo URL</label>
                      <input
                        id="pluginUrl"
                        name="pluginUrl"
                        type="url"
                        placeholder="https://github.com/owner/repo"
                        required
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck="false"
                        data-testid="install-unregistered-plugin-input"
                      />
                    </div>
                    <div class="button-group">
                      <button
                        type="submit"
                        class="settings-button"
                        data-testid="install-unregistered-plugin-submit"
                        ?disabled=${state.$pluginInstallLoading.get()}
                      >
                        ${state.$pluginInstallLoading.get()
                          ? html`Installing
                              <div class="loading-spinner"></div>`
                          : "Install"}
                      </button>
                    </div>
                  </section>
                </form>
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new SettingsAdvancedView();
