import { View } from "./view.js";
import {
  getAuth,
  requireNoAuth,
  BasicAuth,
  InvalidUsernameError,
  AuthError,
} from "/js/auth.js";
import { html, render } from "/js/lib/lit-html.js";
import { AppViewConfig, DEFAULT_APP_VIEW_CONFIGS } from "/js/config.js";
import {
  getAppViewConfig,
  setAppViewConfig,
  isValidAppViewConfig,
  CUSTOM_APP_VIEW_CONFIG_ID,
} from "/js/appViewConfig.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import { validateReturnToParam } from "/js/navigation.js";

class LoginView extends View {
  async render({ root, params, context }) {
    await requireNoAuth();

    const storedConfig = getAppViewConfig();
    const isStoredCustom = storedConfig.id === CUSTOM_APP_VIEW_CONFIG_ID;
    const advancedOpenByDefault = storedConfig.id !== AppViewConfig.BLUESKY.id;

    const state = {
      loading: false,
      errorMessage: null,
      appViewSelection: storedConfig.id,
      customAppViewServiceDid: isStoredCustom
        ? storedConfig.appViewServiceDid
        : "",
      customChatServiceDid: isStoredCustom ? storedConfig.chatServiceDid : "",
    };

    function getCurrentReturnTo() {
      const params = new URLSearchParams(window.location.search);
      return validateReturnToParam(params.get("returnTo"));
    }

    const auth = await getAuth();
    const isBasicAuth = auth instanceof BasicAuth;

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

    async function handleSubmit(e) {
      e.preventDefault();
      const handle = e.target.handle.value;
      const password = isBasicAuth ? e.target.password.value : null;

      const selectedConfig = resolveSelectedAppViewConfig();
      if (!isValidAppViewConfig(selectedConfig)) {
        state.errorMessage = "Invalid App View configuration";
        renderPage();
        return;
      }

      state.loading = true;
      renderPage();
      try {
        setAppViewConfig(selectedConfig);

        // allow truncated handles
        let fullHandle = handle.includes(".")
          ? handle
          : handle + ".bsky.social";
        if (fullHandle.startsWith("@")) {
          fullHandle = fullHandle.slice(1);
        }
        const returnTo = getCurrentReturnTo();
        await auth.login(fullHandle, password, { returnTo });
        window.location.href = returnTo ?? "/";
      } catch (error) {
        if (error instanceof InvalidUsernameError) {
          state.errorMessage = "Invalid username";
        } else if (error instanceof AuthError) {
          state.errorMessage = "Authorization failed";
        } else {
          console.error(error);
          state.errorMessage = "Incorrect username or password";
        }
        state.loading = false;
        renderPage();
      }
    }

    function handleAppViewChange(e) {
      state.appViewSelection = e.target.value;
      renderPage();
    }

    function handleCustomAppViewDidInput(e) {
      state.customAppViewServiceDid = e.target.value;
    }

    function handleCustomChatDidInput(e) {
      state.customChatServiceDid = e.target.value;
    }

    function renderPage() {
      const isCustom = state.appViewSelection === CUSTOM_APP_VIEW_CONFIG_ID;
      render(
        html`<div id="login-view">
          <main>
            <div class="column-left">
              <h1>Sign in</h1>
              <h2><small>to</small> IMPRO</h2>
            </div>
            <div class="column-right">
              <form id="login-form" @submit=${(e) => handleSubmit(e)}>
                <div class="form-title">Sign in</div>
                <div class="form-group">
                  <label for="handle">Username or email</label>
                  <input
                    id="handle"
                    name="handle"
                    type="text"
                    placeholder="example.bsky.social"
                    required
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                  />
                </div>
                ${isBasicAuth
                  ? html` <div class="form-group">
                      <label for="password">Password</label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Password"
                        required
                      />
                    </div>`
                  : ""}
                <details id="login-advanced" ?open=${advancedOpenByDefault}>
                  <summary>Advanced options</summary>
                  <div class="form-group">
                    <label for="appview">Use App View</label>
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
                </details>
                <div class="button-group">
                  <button type="button" @click=${() => router.go("/")}>
                    Back
                  </button>
                  <button type="submit" ?disabled=${state.loading}>
                    Next
                    ${state.loading
                      ? html`<div class="loading-spinner"></div>`
                      : ""}
                  </button>
                </div>
              </form>
              <div class="error-message-container">
                ${state.errorMessage
                  ? html`<div class="error-message">${state.errorMessage}</div>`
                  : ""}
              </div>
            </div>
          </main>
        </div>`,
        root,
      );
    }

    root.addEventListener("page-enter", async () => {
      // this can happen when the oauth callback fails - see callback.html
      const params = new URLSearchParams(window.location.search);
      const errorMessage = params.get("error_message");
      if (errorMessage) {
        state.errorMessage = errorMessage;
        // clear from url
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("error_message");
        window.history.replaceState({}, "", newUrl.toString());
      }
      renderPage();
    });

    root.nativeRefreshDisabled = true;
  }
}

export default new LoginView();
