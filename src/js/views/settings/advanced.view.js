import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { AppViewConfig, DEFAULT_APP_VIEW_CONFIGS } from "/js/config.js";
import {
  getAppViewConfig,
  setAppViewConfig,
  isValidAppViewConfig,
  CUSTOM_APP_VIEW_CONFIG_ID,
} from "/js/appViewConfig.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";

class SettingsAdvancedView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
    },
  }) {
    await requireAuth();

    const storedConfig = getAppViewConfig();
    const isStoredCustom = storedConfig.id === CUSTOM_APP_VIEW_CONFIG_ID;

    const state = {
      loading: false,
      errorMessage: null,
      appViewSelection: storedConfig.id,
      customAppViewServiceDid: isStoredCustom
        ? storedConfig.appViewServiceDid
        : "",
      customChatServiceDid: isStoredCustom ? storedConfig.chatServiceDid : "",
    };

    function resolveSelectedAppViewConfig() {
      if (state.appViewSelection === CUSTOM_APP_VIEW_CONFIG_ID) {
        return {
          id: CUSTOM_APP_VIEW_CONFIG_ID,
          appViewServiceDid: state.customAppViewServiceDid.trim(),
          chatServiceDid: state.customChatServiceDid.trim(),
        };
      }
      return (
        DEFAULT_APP_VIEW_CONFIGS.find(
          (config) => config.id === state.appViewSelection,
        ) ?? AppViewConfig.BLUESKY
      );
    }

    function isDirty() {
      if (state.appViewSelection !== storedConfig.id) return true;
      if (state.appViewSelection === CUSTOM_APP_VIEW_CONFIG_ID) {
        return (
          state.customAppViewServiceDid !== storedConfig.appViewServiceDid ||
          state.customChatServiceDid !== storedConfig.chatServiceDid
        );
      }
      return false;
    }

    function handleSubmit(e) {
      e.preventDefault();
      const selectedConfig = resolveSelectedAppViewConfig();
      if (!isValidAppViewConfig(selectedConfig)) {
        state.errorMessage = "Invalid App View configuration";
        renderPage();
        return;
      }
      state.loading = true;
      state.errorMessage = null;
      renderPage();
      setAppViewConfig(selectedConfig);
      window.location.reload();
    }

    function handleAppViewChange(e) {
      state.appViewSelection = e.target.value;
      renderPage();
    }

    function handleCustomAppViewDidInput(e) {
      state.customAppViewServiceDid = e.target.value;
      renderPage();
    }

    function handleCustomChatDidInput(e) {
      state.customChatServiceDid = e.target.value;
      renderPage();
    }

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const isCustom = state.appViewSelection === CUSTOM_APP_VIEW_CONFIG_ID;
      render(
        html`<div id="settings-advanced-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.router.go("/settings"),
            children: html`${textHeaderTemplate({
                title: "Advanced",
              })}
              <main>
                <form
                  id="settings-advanced-form"
                  @submit=${(e) => handleSubmit(e)}
                >
                  <section class="settings-section">
                    <h2>AppView</h2>
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
                                ?selected=${state.appViewSelection ===
                                defaultConfig.id}
                              >
                                ${defaultConfig.displayName}
                              </option>
                            `,
                          )}
                          <option
                            value=${CUSTOM_APP_VIEW_CONFIG_ID}
                            ?selected=${state.appViewSelection ===
                            CUSTOM_APP_VIEW_CONFIG_ID}
                          >
                            Custom
                          </option>
                        </select>
                      </div>
                    </div>
                    ${isCustom
                      ? html`
                          <div class="warning-area">
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
                              .value=${state.customAppViewServiceDid}
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
                              .value=${state.customChatServiceDid}
                              @input=${(e) => handleCustomChatDidInput(e)}
                            />
                          </div>
                        `
                      : ""}

                    <div class="button-group">
                      <button
                        type="submit"
                        ?disabled=${state.loading || !isDirty()}
                      >
                        Apply and reload
                        ${state.loading
                          ? html`<div class="loading-spinner"></div>`
                          : ""}
                      </button>
                    </div>
                    <div class="helper-text">
                      Tip: You can use the query parameter ?reset-appview to
                      reset the App View in case of misconfiguration.
                    </div>
                    <div class="error-message-container">
                      ${state.errorMessage
                        ? html`<div class="error-message">
                            ${state.errorMessage}
                          </div>`
                        : ""}
                    </div>
                  </section>
                </form>
              </main>`,
          })}
        </div>`,
        root,
      );
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
    });

    root.addEventListener("page-restore", (e) => {
      window.scrollTo(0, 0);
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new SettingsAdvancedView();
