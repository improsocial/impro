import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import {
  theme,
  getDefaultHighlightColor,
  getDefaultLikeColor,
  getDefaultColorScheme,
} from "/js/theme.js";

class SettingsAppearanceView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      pluginService,
    },
  }) {
    await auth.requireAuth();

    function handleHighlightColorChange(newHighlightColor) {
      theme.updateHighlightColor(newHighlightColor);
      renderPage();
    }

    function handleLikeColorChange(newLikeColor) {
      theme.updateLikeColor(newLikeColor);
      renderPage();
    }

    function handleColorSchemeChange(newColorScheme) {
      theme.updateColorScheme(newColorScheme);
      renderPage();
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const currentHighlightColor = theme.highlightColor;
      const defaultHighlightColor = getDefaultHighlightColor();
      const currentLikeColor = theme.likeColor;
      const defaultLikeColor = getDefaultLikeColor();
      const currentColorScheme = theme.colorScheme;
      render(
        html`<div id="settings-appearance-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            activeNavItem: "settings",
            onClickActiveNavItem: () => window.router.go("/settings"),
            children: html`${headerTemplate({
                title: "Appearance",
                onClickBackButton: () => window.router.go("/settings"),
              })}
              <main>
                <section
                  class="setting-item"
                  data-testid="settings-section-color-scheme"
                >
                  <div class="setting-item-info">
                    <h2 class="setting-item-name">Color scheme</h2>
                    <p class="setting-item-desc">
                      Choose between light and dark mode.
                    </p>
                  </div>
                  <div class="setting-item-control">
                    <select
                      class="setting-item-dropdown"
                      data-testid="color-scheme-select"
                      @change=${(e) => {
                        handleColorSchemeChange(e.target.value);
                      }}
                      .value=${currentColorScheme}
                    >
                      <option
                        value="system"
                        ?selected=${currentColorScheme === "system"}
                      >
                        System
                      </option>
                      <option
                        value="light"
                        ?selected=${currentColorScheme === "light"}
                      >
                        Light
                      </option>
                      <option
                        value="dark"
                        ?selected=${currentColorScheme === "dark"}
                      >
                        Dark
                      </option>
                    </select>
                  </div>
                </section>
                <section
                  class="setting-item"
                  data-testid="settings-section-highlight-color"
                >
                  <div class="setting-item-info">
                    <h2 class="setting-item-name">Highlight color</h2>
                    <p class="setting-item-desc">
                      Choose the highlight color for buttons and links.
                    </p>
                  </div>
                  <div class="settings-color-picker">
                    <input
                      @change=${(e) => {
                        handleHighlightColorChange(e.target.value);
                      }}
                      type="color"
                      .value=${currentHighlightColor}
                    />
                    <button
                      class="settings-color-picker-reset"
                      @click=${() => {
                        handleHighlightColorChange(defaultHighlightColor);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </section>
                <section
                  class="setting-item"
                  data-testid="settings-section-like-color"
                >
                  <div class="setting-item-info">
                    <h2 class="setting-item-name">Like color</h2>
                    <p class="setting-item-desc">
                      Choose the color for liked posts.
                    </p>
                  </div>
                  <div class="settings-color-picker">
                    <input
                      @change=${(e) => {
                        handleLikeColorChange(e.target.value);
                      }}
                      type="color"
                      .value=${currentLikeColor}
                    />
                    <button
                      class="settings-color-picker-reset"
                      @click=${() => {
                        handleLikeColorChange(defaultLikeColor);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </section>
              </main>`,
          })}
        </div>`,
        root,
      );
    }

    root.addEventListener("page-enter", async () => {
      // Initial empty state
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

export default new SettingsAppearanceView();
