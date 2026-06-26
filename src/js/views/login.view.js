import { View } from "/js/views/view.js";
import { auth, BasicAuthProvider, getLoginErrorMessage } from "/js/auth.js";
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
import { getDisplayName } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { circleCheckIconTemplate } from "/js/templates/icons/circleCheckIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { userPlusIconTemplate } from "/js/templates/icons/userPlusIcon.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { pageEffect, bindToPage } from "/js/router.js";
import { Signal, ReactiveStore } from "/js/signals.js";

class LoginView extends View {
  async render({ root, router, params, context: { dataLayer } }) {
    await auth.requireNoAuth();

    const storedConfig = getAppViewConfig();
    const isStoredCustom = storedConfig.id === CUSTOM_APP_VIEW_CONFIG_ID;
    const advancedOpenByDefault = storedConfig.id !== AppViewConfig.BLUESKY.id;
    const isBasicAuth = auth.provider instanceof BasicAuthProvider;
    const supportsMultipleAccounts = auth.supportsMultipleAccounts();

    const state = new ReactiveStore("loginView");
    state.$loading = new Signal.State(false);
    state.$errorMessage = new Signal.State(null);
    state.$appViewSelection = new Signal.State(storedConfig.id);
    state.$customAppViewServiceDid = new Signal.State(
      isStoredCustom ? storedConfig.appViewServiceDid : "",
    );
    state.$customChatServiceDid = new Signal.State(
      isStoredCustom ? storedConfig.chatServiceDid : "",
    );
    state.$savedAccounts = new Signal.State([]);
    state.$savedAccountProfiles = new Signal.State({});
    state.$profilesLoading = new Signal.State(true);
    state.$pendingAccountDid = new Signal.State(null);
    state.$currentDid = new Signal.State(null);
    state.$forceShowForm = new Signal.State(false);

    function getCurrentReturnTo() {
      const params = new URLSearchParams(window.location.search);
      return validateReturnToParam(params.get("returnTo"));
    }

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

    async function handleSubmit(e) {
      e.preventDefault();
      const handle = e.target.handle.value;
      const password = isBasicAuth ? e.target.password.value : null;

      const selectedConfig = resolveSelectedAppViewConfig();
      if (!isValidAppViewConfig(selectedConfig)) {
        state.$errorMessage.set("Invalid App View configuration");
        return;
      }

      state.$loading.set(true);
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
        await auth.login(
          isBasicAuth
            ? { handle: fullHandle, password }
            : { handle: fullHandle, returnTo },
        );
        window.location.href = returnTo ?? "/";
      } catch (error) {
        state.$errorMessage.set(getLoginErrorMessage(error));
        state.$loading.set(false);
      }
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

    async function loadSavedAccounts() {
      if (!supportsMultipleAccounts) return;
      const session = await auth.getSession();
      state.$currentDid.set(session?.did ?? null);
      state.$savedAccounts.set(await auth.listAccounts());
    }

    pageEffect(root, () => {
      const accounts = state.$savedAccounts.get();
      if (accounts.length === 0) return;
      dataLayer.declarative
        .ensureDetailedProfiles(accounts.map((account) => account.did))
        .then((profiles) => {
          const profilesByDid = {};
          for (const profile of profiles) {
            if (profile) profilesByDid[profile.did] = profile;
          }
          state.$savedAccountProfiles.set(profilesByDid);
        })
        .catch(() => {
          // fall back to handle-only rendering
        })
        .finally(() => {
          state.$profilesLoading.set(false);
        });
    });

    async function handleSelectAccount(account) {
      if (state.$pendingAccountDid.get() !== null) return;
      const returnTo = getCurrentReturnTo();
      if (account.did === state.$currentDid.get()) {
        window.location.href = returnTo ?? "/";
        return;
      }
      state.$pendingAccountDid.set(account.did);
      try {
        if (account.needsReauth) {
          await auth.login({ handle: account.handle, returnTo });
        } else {
          await auth.provider.switchToAccount(account.did);
          window.location.href = returnTo ?? "/";
        }
      } catch (error) {
        state.$pendingAccountDid.set(null);
        state.$errorMessage.set(getLoginErrorMessage(error));
      }
    }

    function handleUseAnotherAccount() {
      if (state.$pendingAccountDid.get() !== null) return;
      state.$forceShowForm.set(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const input = root.querySelector('input[name="handle"]');
          if (input) {
            input.value = "";
            input.focus();
          }
        });
      });
    }

    function handleBack() {
      if (state.$forceShowForm.get() && state.$savedAccounts.get().length > 0) {
        state.$forceShowForm.set(false);
        state.$errorMessage.set(null);
        return;
      }
      router.go("/");
    }

    function savedAccountsTemplate({
      savedAccounts,
      profilesByDid,
      currentDid,
      pendingDid,
      profilesLoading,
    }) {
      return html`
        <div class="saved-accounts-section">
          <h2
            class="saved-accounts-heading"
            data-testid="saved-accounts-heading"
          >
            Sign in as...
          </h2>
          <div class="account-switcher-list" data-testid="saved-accounts-list">
            ${savedAccounts.map((account) => {
              const profile = profilesByDid[account.did] ?? null;
              const isCurrent = account.did === currentDid;
              const isPendingRow = pendingDid === account.did;
              const handle = profile?.handle ?? account.handle;
              const showSkeleton = profile === null && profilesLoading;
              const teststate = isPendingRow
                ? "pending"
                : isCurrent
                  ? "current"
                  : account.needsReauth
                    ? "reauth"
                    : "other";
              return html`
                <button
                  type="button"
                  class="account-switcher-item ${account.needsReauth
                    ? "account-switcher-item-reauth"
                    : ""}"
                  data-testid="saved-account-row"
                  data-did=${account.did}
                  data-handle=${account.handle ?? ""}
                  data-teststate=${teststate}
                  aria-label=${isCurrent
                    ? `Continue as @${handle ?? account.did} (currently signed in)`
                    : `Sign in as @${handle ?? account.did}`}
                  ?disabled=${pendingDid !== null}
                  @click=${() => handleSelectAccount(account)}
                >
                  ${showSkeleton
                    ? html`
                        <span class="account-switcher-avatar">
                          <span class="skeleton-avatar skeleton-animate"></span>
                        </span>
                        <span
                          class="account-switcher-names account-switcher-names-skeleton"
                          data-testid="account-switcher-skeleton"
                        >
                          <span
                            class="skeleton-line-short skeleton-animate"
                          ></span>
                          <span
                            class="skeleton-line-shorter skeleton-animate"
                          ></span>
                        </span>
                      `
                    : html`
                        <span class="account-switcher-avatar">
                          ${profile
                            ? avatarTemplate({
                                author: profile,
                                clickAction: "none",
                              })
                            : html`<div
                                class="avatar-image-placeholder"
                              ></div>`}
                        </span>
                        <span class="account-switcher-names">
                          <span class="account-switcher-display-name">
                            ${profile
                              ? getDisplayName(profile)
                              : (account.handle ?? account.did)}${profile
                              ? verificationBadgeTemplate({ profile })
                              : ""}${profile
                              ? automatedAccountBadgeTemplate({ profile })
                              : ""}
                          </span>
                          ${handle
                            ? html`<span class="account-switcher-handle"
                                >@${handle}</span
                              >`
                            : null}
                          ${account.needsReauth
                            ? html`<span
                                class="account-switcher-reauth-hint"
                                data-testid="saved-account-reauth-hint"
                                >Sign in again</span
                              >`
                            : null}
                        </span>
                      `}
                  ${isPendingRow
                    ? html`<span class="account-spinner"
                        ><span class="loading-spinner"></span
                      ></span>`
                    : isCurrent
                      ? html`<span class="account-switcher-current-check"
                          >${circleCheckIconTemplate()}</span
                        >`
                      : html`<span class="account-switcher-chevron"
                          >${chevronRightIconTemplate()}</span
                        >`}
                </button>
              `;
            })}
            <button
              type="button"
              class="account-switcher-item account-switcher-add"
              data-testid="saved-account-add"
              ?disabled=${pendingDid !== null}
              @click=${() => handleUseAnotherAccount()}
            >
              <span class="account-switcher-avatar account-switcher-add-icon">
                ${userPlusIconTemplate()}
              </span>
              <span class="account-switcher-names">
                <span class="account-switcher-display-name"
                  >Use another account</span
                >
              </span>
            </button>
          </div>
        </div>
      `;
    }

    pageEffect(root, () => {
      const isCustom =
        state.$appViewSelection.get() === CUSTOM_APP_VIEW_CONFIG_ID;
      const loading = state.$loading.get();
      const errorMessage = state.$errorMessage.get();
      const appViewSelection = state.$appViewSelection.get();
      const customAppViewServiceDid = state.$customAppViewServiceDid.get();
      const customChatServiceDid = state.$customChatServiceDid.get();
      const savedAccounts = state.$savedAccounts.get();
      const savedAccountProfiles = state.$savedAccountProfiles.get();
      const profilesLoading = state.$profilesLoading.get();
      const pendingAccountDid = state.$pendingAccountDid.get();
      const currentDid = state.$currentDid.get();
      const listVisible =
        !state.$forceShowForm.get() &&
        supportsMultipleAccounts &&
        savedAccounts.length > 0;
      render(
        html`<div id="login-view">
          <main>
            <div class="column-left">
              <h1>Sign in</h1>
              <h2><small>to</small> IMPRO</h2>
            </div>
            <div class="column-right">
              ${listVisible
                ? savedAccountsTemplate({
                    savedAccounts,
                    profilesByDid: savedAccountProfiles,
                    currentDid,
                    pendingDid: pendingAccountDid,
                    profilesLoading,
                  })
                : ""}
              <form
                id="login-form"
                ?hidden=${listVisible}
                @submit=${(e) => handleSubmit(e)}
              >
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
                    <label for="appview">App View</label>
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
                              ?selected=${appViewSelection === defaultConfig.id}
                            >
                              ${defaultConfig.displayName}
                            </option>
                          `,
                        )}
                        <option
                          value=${CUSTOM_APP_VIEW_CONFIG_ID}
                          ?selected=${appViewSelection ===
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
                            .value=${customAppViewServiceDid}
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
                            .value=${customChatServiceDid}
                            @input=${(e) => handleCustomChatDidInput(e)}
                          />
                        </div>
                      `
                    : ""}
                </details>
                <div class="button-group">
                  <button
                    class="rounded-button rounded-button-secondary"
                    type="button"
                    @click=${() => handleBack()}
                  >
                    Back
                  </button>
                  <button
                    class="rounded-button rounded-button-primary"
                    type="submit"
                    ?disabled=${loading}
                  >
                    Next
                    ${loading ? html`<div class="loading-spinner"></div>` : ""}
                  </button>
                </div>
              </form>
              <div class="error-message-container">
                ${errorMessage
                  ? html`<div class="error-message">${errorMessage}</div>`
                  : ""}
              </div>
            </div>
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      // this can happen when the oauth callback fails - see callback.html
      const params = new URLSearchParams(window.location.search);
      const errorMessage = params.get("error_message");
      if (errorMessage) {
        state.$errorMessage.set(errorMessage);
        // clear from url
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("error_message");
        window.history.replaceState({}, "", newUrl.toString());
      }
      if (params.get("addAccount") === "1") {
        state.$forceShowForm.set(true);
      }
      loadSavedAccounts();
    });

    // Account actions navigate away with the pending spinner showing; if the
    // user comes back via the back/forward cache the document is restored
    // as-is, so reset the stuck pending state.
    bindToPage(root, window, "pageshow", (event) => {
      if (event.persisted) {
        state.$pendingAccountDid.set(null);
      }
    });

    root.nativeRefreshDisabled = true;
  }
}

export default new LoginView();
