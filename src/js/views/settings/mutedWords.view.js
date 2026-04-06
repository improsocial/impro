import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { confirm } from "/js/modals.js";
import { differenceInHours, differenceInDays } from "/js/utils.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-label.js";

class SettingsMutedWordsView extends View {
  async render({
    root,
    context: { dataLayer, notificationService, postComposerService },
  }) {
    await requireAuth();

    const state = {
      error: "",
      hasValue: false,
      isSaving: false,
      removingWordId: null,
      renewingWordId: null,
    };

    function sanitizeMutedWordValue(value) {
      return value
        .trim()
        .replace(/^#/, "")
        .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "");
    }

    function formatExpiration(expiresAt) {
      const expirationDate = new Date(expiresAt);
      const now = new Date();
      if (expirationDate < now) {
        return "Expired";
      }
      const diffDays = differenceInDays(expirationDate, now);
      if (diffDays <= 1) {
        const diffHours = differenceInHours(expirationDate, now);
        return `Expires in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
      }
      return `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
    }

    async function handleSubmit(e) {
      e.preventDefault();
      const formData = new FormData(e.target);

      const sanitized = sanitizeMutedWordValue(formData.get("word"));
      if (!sanitized) {
        state.error = "Please enter a valid word, tag, or phrase to mute";
        renderPage();
        return;
      }

      const targetValue = formData.get("target");
      const targets = targetValue === "content" ? ["content", "tag"] : ["tag"];
      const excludeFollowing = formData.get("exclude-following") === "on";
      const actorTarget = excludeFollowing ? "exclude-following" : "all";

      const duration = formData.get("duration");
      let expiresAt;
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (duration === "24_hours") {
        expiresAt = new Date(now + oneDayMs).toISOString();
      } else if (duration === "7_days") {
        expiresAt = new Date(now + 7 * oneDayMs).toISOString();
      } else if (duration === "30_days") {
        expiresAt = new Date(now + 30 * oneDayMs).toISOString();
      }

      state.isSaving = true;
      state.error = "";
      renderPage();

      try {
        await dataLayer.mutations.addMutedWord({
          value: sanitized,
          targets,
          actorTarget,
          expiresAt,
        });
        resetForm();
      } catch (err) {
        state.error = err.message || "Failed to add muted word";
      } finally {
        state.isSaving = false;
        renderPage();
      }
    }

    function resetForm() {
      root.querySelector(".muted-word-form").reset();
    }

    async function handleRemove(word) {
      const confirmed = await confirm(
        `This will delete "${word.value}" from your muted words. You can always add it back later.`,
        {
          title: "Are you sure?",
          confirmButtonText: "Remove",
          confirmButtonStyle: "danger",
        },
      );
      if (!confirmed) return;

      state.removingWordId = word.id;
      renderPage();
      try {
        await dataLayer.mutations.removeMutedWord(word.id);
      } catch (err) {
        state.error = err.message || "Failed to remove muted word";
      } finally {
        state.removingWordId = null;
        renderPage();
      }
    }

    async function handleRenew(word, duration) {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      let expiresAt;
      if (duration === "24_hours") {
        expiresAt = new Date(now + oneDayMs).toISOString();
      } else if (duration === "7_days") {
        expiresAt = new Date(now + 7 * oneDayMs).toISOString();
      } else if (duration === "30_days") {
        expiresAt = new Date(now + 30 * oneDayMs).toISOString();
      }

      state.renewingWordId = word.id;
      renderPage();
      try {
        await dataLayer.mutations.updateMutedWord(word.id, { expiresAt });
      } catch (err) {
        state.error = err.message || "Failed to renew muted word";
      } finally {
        state.renewingWordId = null;
        renderPage();
      }
    }

    function mutedWordItemTemplate({
      word,
      isRemoving,
      isRenewing,
      onRemove,
      onRenew,
    }) {
      const targetLabel = word.targets.includes("content")
        ? "text & tags"
        : "tags";
      const hasExpiration = !!word.expiresAt;
      const hasExcludeFollowing = word.actorTarget === "exclude-following";
      const metaParts = [];
      if (hasExpiration) {
        metaParts.push(formatExpiration(word.expiresAt));
      }
      if (hasExcludeFollowing) {
        metaParts.push("Excludes users you follow");
      }
      const expirationDate = word.expiresAt ? new Date(word.expiresAt) : null;
      const isExpired = expirationDate && expirationDate < new Date();

      return html`
        <div class="muted-word-item" data-testid="muted-word-item">
          <div class="muted-word-item-info">
            <div class="muted-word-item-value">
              ${word.value}
              <span class="muted-word-item-target">in ${targetLabel}</span>
            </div>
            ${metaParts.length > 0
              ? html`<div class="muted-word-item-meta">
                  ${metaParts.join(" \u2022 ")}
                </div>`
              : ""}
          </div>
          <div class="muted-word-item-actions">
            ${isExpired
              ? html`
                  <button
                    class="muted-word-renew-button"
                    data-testid="muted-word-renew"
                    ?disabled=${isRenewing}
                    aria-label="Renew muted word"
                    @click=${function (e) {
                      e.stopPropagation();
                      const contextMenu = this.nextElementSibling;
                      contextMenu.open(e.clientX, e.clientY);
                    }}
                  >
                    ${isRenewing
                      ? html`<div class="loading-spinner"></div>`
                      : "Renew"}
                  </button>
                  <context-menu>
                    <context-menu-label> Renew duration </context-menu-label>
                    <context-menu-item
                      @click=${() => onRenew(word, "24_hours")}
                    >
                      24 hours
                    </context-menu-item>
                    <context-menu-item @click=${() => onRenew(word, "7_days")}>
                      7 days
                    </context-menu-item>
                    <context-menu-item @click=${() => onRenew(word, "30_days")}>
                      30 days
                    </context-menu-item>
                    <context-menu-item @click=${() => onRenew(word, "forever")}>
                      Forever
                    </context-menu-item>
                  </context-menu>
                `
              : ""}
            <button
              class="muted-word-delete-button"
              data-testid="muted-word-delete"
              ?disabled=${isRemoving}
              @click=${() => onRemove(word)}
              aria-label="Remove muted word"
            >
              ${isRemoving
                ? html`<div class="loading-spinner"></div>`
                : html`<span>×</span>`}
            </button>
          </div>
        </div>
      `;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const preferences = dataLayer.preferencesProvider.requirePreferences();
      const mutedWords = [...preferences.getMutedWords()].reverse();

      render(
        html`<div id="settings-muted-words-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            activeNavItem: "settings",
            children: html`${textHeaderTemplate({
                title: "Muted words",
              })}
              <main>
                <form class="muted-word-form" @submit=${(e) => handleSubmit(e)}>
                  <h2>Add muted words and tags</h2>
                  <p>
                    Posts can be muted based on their text, their tags, or both.
                  </p>
                  <input
                    class="muted-word-input"
                    data-testid="muted-word-input"
                    type="text"
                    name="word"
                    autocapitalize="none"
                    autocomplete="off"
                    autocorrect="off"
                    placeholder="Enter a word or tag"
                    @input=${(e) => {
                      if (state.error) {
                        state.error = "";
                      }
                      state.hasValue = !!e.target.value.trim();
                      renderPage();
                    }}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="none"
                  />

                  <div class="muted-word-field-label">Duration:</div>
                  <div
                    class="muted-word-radio-group"
                    data-testid="duration-group"
                  >
                    <label>
                      <input
                        type="radio"
                        name="duration"
                        value="forever"
                        checked
                      />
                      Forever
                    </label>
                    <label>
                      <input type="radio" name="duration" value="24_hours" />
                      24 hours
                    </label>
                    <label>
                      <input type="radio" name="duration" value="7_days" />
                      7 days
                    </label>
                    <label>
                      <input type="radio" name="duration" value="30_days" />
                      30 days
                    </label>
                  </div>

                  <div class="muted-word-field-label">Mute in:</div>
                  <div
                    class="muted-word-radio-group"
                    data-testid="target-group"
                  >
                    <label>
                      <input
                        type="radio"
                        name="target"
                        value="content"
                        checked
                      />
                      Text & tags
                    </label>
                    <label>
                      <input type="radio" name="target" value="tag" />
                      Tags only
                    </label>
                  </div>

                  <div class="muted-word-field-label">Options:</div>
                  <label
                    class="muted-word-checkbox-row"
                    data-testid="exclude-following"
                  >
                    <input type="checkbox" name="exclude-following" />
                    Exclude users you follow
                  </label>

                  <button
                    class="muted-word-add-button"
                    data-testid="muted-word-add"
                    type="submit"
                    ?disabled=${state.isSaving || !state.hasValue}
                  >
                    ${state.isSaving
                      ? html`<div class="loading-spinner"></div>`
                      : "Add"}
                  </button>
                  ${state.error
                    ? html`<div
                        class="muted-word-error"
                        data-testid="muted-word-error"
                      >
                        ${state.error}
                      </div>`
                    : ""}
                </form>

                <h2 class="muted-word-list-header">Your muted words</h2>
                ${mutedWords.length > 0
                  ? html`<div
                      class="muted-word-list"
                      data-testid="muted-word-list"
                    >
                      ${mutedWords.map((word) =>
                        mutedWordItemTemplate({
                          word,
                          isRemoving: state.removingWordId === word.id,
                          isRenewing: state.renewingWordId === word.id,
                          onRemove: handleRemove,
                          onRenew: handleRenew,
                        }),
                      )}
                    </div>`
                  : html`<div
                      class="muted-word-empty"
                      data-testid="muted-word-empty"
                    >
                      You haven't muted any words or tags yet
                    </div>`}
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

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });

    notificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new SettingsMutedWordsView();
