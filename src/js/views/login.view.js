import { View } from "./view.js";
import { getAuth, requireNoAuth, BasicAuth } from "/js/auth.js";
import { html, render } from "/js/lib/lit-html.js";

class LoginView extends View {
  async render({ root, params, context }) {
    await requireNoAuth();

    const state = {
      loading: false,
      errorMessage: null,
    };

    const auth = await getAuth();
    const isBasicAuth = auth instanceof BasicAuth;

    async function handleSubmit(e) {
      e.preventDefault();
      const handle = e.target.handle.value;
      const password = isBasicAuth ? e.target.password.value : null;
      state.loading = true;
      renderPage();
      try {
        // allow truncated handles
        const fullHandle = handle.includes(".")
          ? handle
          : handle + ".bsky.social";
        await auth.login(fullHandle, password);
        window.location.href = "/";
      } catch (error) {
        console.error(error);
        state.errorMessage = "Incorrect username or password";
        state.loading = false;
        renderPage();
      }
    }

    function renderPage() {
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
                  <label for="email">Username or email</label>
                  <input
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
                        name="password"
                        type="password"
                        placeholder="Password"
                        required
                      />
                    </div>`
                  : ""}
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
        root
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
