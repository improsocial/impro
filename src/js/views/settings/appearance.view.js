import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { requireAuth } from "/js/auth.js";
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
    context: { dataLayer, notificationService, postComposerService },
  }) {
    await requireAuth();

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

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications = notificationService.getNumNotifications();
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
            activeNavItem: "settings",
            children: html`${textHeaderTemplate({
                title: "Appearance",
              })}
              <main>
                <section class="settings-section">
                  <h2>Color scheme</h2>
                  <p>Choose between light and dark mode.</p>
                  <select
                    class="settings-select"
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
                </section>
                <section class="settings-section">
                  <h2>Highlight color</h2>
                  <p>Choose the highlight color for buttons and links.</p>
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
                <section class="settings-section">
                  <h2>Like color</h2>
                  <p>Choose the color for liked posts.</p>
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
        root
      );
    }

    root.addEventListener("page-enter", async () => {
      // Initial empty state
      renderPage();
      dataLayer.declarations.ensureCurrentUser().then(() => {
        renderPage();
      });
    });

    root.addEventListener("page-restore", (e) => {
      window.scrollTo(0, 0);
    });

    notificationService.on("update", () => {
      renderPage();
    });
  }
}

export default new SettingsAppearanceView();
