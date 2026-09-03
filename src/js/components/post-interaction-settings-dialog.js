import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";
import {
  normalizeThreadgateAllowSettings,
  buildThreadgateAllowFromNormalized,
  hasDisableEmbeddingRule,
  buildPostgateEmbeddingRules,
  cdnImageUrl,
  parseUri,
} from "/js/dataHelpers.js";
import "/js/components/toggle-switch.js";
import "/js/components/app-icon.js";

const MAX_ALLOW_RULES = 5;
const CURATE_LIST_PURPOSE = "app.bsky.graph.defs#curatelist";

const RULE_ROWS = [
  { type: "mention", label: "Mentioned users" },
  { type: "following", label: "Users you follow" },
  { type: "followers", label: "Your followers" },
];

function countRules(settings) {
  return settings.filter(
    (setting) => setting.type !== "everybody" && setting.type !== "nobody",
  ).length;
}

function checkboxRowTemplate({ label, checked, disabled, testid, onToggle }) {
  return html`
    <label
      class="checkbox-row interaction-settings-row ${disabled
        ? "interaction-settings-row-disabled"
        : ""}"
    >
      <input
        type="checkbox"
        data-testid=${testid}
        .checked=${checked}
        .disabled=${disabled}
        @change=${onToggle}
      />
      ${label}
    </label>
  `;
}

function listRowTemplate({ list, checked, disabled, onToggle }) {
  return html`
    <label
      class="checkbox-row interaction-settings-row interaction-settings-list-row ${disabled
        ? "interaction-settings-row-disabled"
        : ""}"
      data-testid="interaction-settings-list-row"
      data-list-uri=${list.uri}
    >
      <input
        type="checkbox"
        .checked=${checked}
        .disabled=${disabled}
        @change=${onToggle}
      />
      <img
        src=${cdnImageUrl(list.avatar) || "/img/list-avatar-fallback.svg"}
        alt=""
        class="feed-avatar interaction-settings-list-avatar"
      />
      <span class="interaction-settings-list-name">${list.name}</span>
    </label>
  `;
}

// Rules that must survive a save but can't be shown as a normal row: unknown
// rule types and list rules for lists the user doesn't have access to. They
// stay checked-but-opaque and can only be explicitly removed.
function preservedRowTemplate({ setting, hydratedLists, onRemove }) {
  let label;
  if (setting.type === "unknown") {
    label = "An unknown rule (added by another app)";
  } else {
    const { rkey } = parseUri(setting.list);
    const listView = hydratedLists.find(
      (hydratedList) => hydratedList.uri === setting.list,
    );
    label = listView
      ? `${listView.name} members`
      : `A list you don't have access to (${rkey})`;
  }
  return html`
    <div
      class="checkbox-row interaction-settings-row interaction-settings-preserved-row"
      data-testid="interaction-settings-preserved-row"
    >
      <span>${label}</span>
      <button
        type="button"
        class="text-pill-button"
        data-testid="interaction-settings-remove-rule"
        @click=${onRemove}
      >
        Remove
      </button>
    </div>
  `;
}

function listsSectionTemplate({
  settings,
  curateLists,
  listsLoaded,
  listsError,
  atRuleCap,
  isSaving,
  listsOpen,
  onToggleListsOpen,
  onToggleList,
}) {
  const selectedCount = settings.filter(
    (setting) => setting.type === "list",
  ).length;
  return html`
    <details
      class="interaction-settings-lists"
      @toggle=${(event) => onToggleListsOpen(event.target.open)}
    >
      <summary
        class="checkbox-row interaction-settings-row interaction-settings-lists-toggle"
        data-testid="interaction-settings-lists-toggle"
      >
        <span>
          Select from your
          lists${selectedCount > 0 ? ` (${selectedCount} selected)` : ""}
        </span>
        <app-icon
          class="interaction-settings-lists-chevron"
          icon=${listsOpen ? "chevron-up-line" : "chevron-down-line"}
        ></app-icon>
      </summary>
      ${listsError
        ? html`<div class="interaction-settings-lists-message">
            An error occurred while loading your lists.
          </div>`
        : !listsLoaded
          ? html`<div class="interaction-settings-lists-message">
              Loading lists…
            </div>`
          : curateLists.length === 0
            ? html`<div class="interaction-settings-lists-message">
                You don't have any lists yet.
              </div>`
            : curateLists.map((list) => {
                const checked = settings.some(
                  (setting) =>
                    setting.type === "list" && setting.list === list.uri,
                );
                return listRowTemplate({
                  list,
                  checked,
                  disabled: isSaving || (!checked && atRuleCap),
                  onToggle: () => onToggleList(list),
                });
              })}
    </details>
  `;
}

function quotePostsRowTemplate({ quotesEnabled, isSaving, onToggleQuotes }) {
  return html`
    <label class="interaction-settings-quote-row">
      <span class="interaction-settings-quote-label">
        <app-icon icon="quote-line"></app-icon> Allow quote posts
      </span>
      <toggle-switch
        label="Allow quote posts"
        data-testid="interaction-settings-quote-posts"
        ?checked=${quotesEnabled}
        ?disabled=${isSaving}
        @change=${(event) => onToggleQuotes(event.detail.checked)}
      ></toggle-switch>
    </label>
  `;
}

function interactionSettingsFormTemplate({
  settings,
  curateLists,
  listsLoaded,
  listsError,
  hydratedLists,
  quotesEnabled,
  isSaving,
  saveError,
  defaultsRowState,
  saveAsDefault,
  listsOpen,
  onToggleListsOpen,
  onToggleSaveAsDefault,
  onSelectEverybody,
  onSelectNobody,
  onToggleRule,
  onToggleList,
  onToggleQuotes,
  onRemoveSetting,
  onSave,
}) {
  const isEverybody = settings.some((setting) => setting.type === "everybody");
  const isNobody = settings.some((setting) => setting.type === "nobody");
  const atRuleCap = countRules(settings) >= MAX_ALLOW_RULES;
  const curateListUris = new Set(curateLists.map((list) => list.uri));
  const preservedSettings = settings.filter(
    (setting) =>
      setting.type === "unknown" ||
      (setting.type === "list" &&
        listsLoaded &&
        !curateListUris.has(setting.list)),
  );
  return html`
    <div class="interaction-settings-section">
      <h3 class="interaction-settings-section-title">Who can reply</h3>
      <div class="pill-radio-group">
        <label>
          <input
            type="radio"
            name="interaction-settings-reply"
            data-testid="interaction-settings-reply-anyone"
            .checked=${isEverybody}
            .disabled=${isSaving}
            @click=${onSelectEverybody}
          />
          Anyone
        </label>
        <label>
          <input
            type="radio"
            name="interaction-settings-reply"
            data-testid="interaction-settings-reply-nobody"
            .checked=${isNobody}
            .disabled=${isSaving}
            @click=${onSelectNobody}
          />
          Nobody
        </label>
      </div>
      <div class="interaction-settings-rows">
        ${RULE_ROWS.map((row) =>
          checkboxRowTemplate({
            label: row.label,
            checked: settings.some((setting) => setting.type === row.type),
            disabled:
              isSaving ||
              (atRuleCap &&
                !settings.some((setting) => setting.type === row.type)),
            testid: `interaction-settings-${row.type}`,
            onToggle: () => onToggleRule(row.type),
          }),
        )}
        ${listsSectionTemplate({
          settings,
          curateLists,
          listsLoaded,
          listsError,
          atRuleCap,
          isSaving,
          listsOpen,
          onToggleListsOpen,
          onToggleList,
        })}
        ${preservedSettings.map((setting) =>
          preservedRowTemplate({
            setting,
            hydratedLists,
            onRemove: () => onRemoveSetting(setting),
          }),
        )}
      </div>
    </div>
    ${quotePostsRowTemplate({ quotesEnabled, isSaving, onToggleQuotes })}
    ${defaultsRowState
      ? defaultsRowState === "matches"
        ? html`<div
            class="interaction-settings-default-note"
            data-testid="interaction-settings-default-note"
          >
            These are your default settings
          </div>`
        : html`
            <label
              class="interaction-settings-row interaction-settings-save-default-row ${isSaving
                ? "interaction-settings-row-disabled"
                : ""}"
            >
              <input
                type="checkbox"
                data-testid="interaction-settings-save-default"
                .checked=${saveAsDefault}
                .disabled=${isSaving}
                @change=${(event) =>
                  onToggleSaveAsDefault(event.target.checked)}
              />
              Save these options for next time
            </label>
          `
      : null}
    ${saveError
      ? html`<div class="interaction-settings-error">
          Could not save changes: ${saveError}
        </div>`
      : null}
    <button
      class="rounded-button rounded-button-primary interaction-settings-save"
      data-testid="interaction-settings-save"
      .disabled=${isSaving}
      @click=${onSave}
    >
      ${isSaving ? "Saving..." : "Save"}
      ${isSaving ? html`<div class="loading-spinner"></div>` : ""}
    </button>
  `;
}

class PostInteractionSettingsDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    const initialSettings = normalizeThreadgateAllowSettings(
      this.threadgateAllow,
    );
    this._initialAllowJson = JSON.stringify(
      buildThreadgateAllowFromNormalized(initialSettings),
    );
    const initialQuotesEnabled = !hasDisableEmbeddingRule(
      this.postgateEmbeddingRules,
    );
    this._initialQuotesEnabled = initialQuotesEnabled;
    this.state = new ReactiveStore("post-interaction-settings-dialog");
    this.state.$settings = new Signal.State(initialSettings);
    this.state.$quotesEnabled = new Signal.State(initialQuotesEnabled);
    this.state.$listsError = new Signal.State(null);
    this.state.$isSaving = new Signal.State(false);
    this.state.$saveError = new Signal.State(null);
    this.state.$saveAsDefault = new Signal.State(false);
    this.state.$listsOpen = new Signal.State(false);
    this._defaultAllowJson = this.defaultInteractionSettings
      ? JSON.stringify(this.defaultInteractionSettings.threadgateAllowRules)
      : null;
    this._defaultQuotesEnabled = this.defaultInteractionSettings
      ? !hasDisableEmbeddingRule(
          this.defaultInteractionSettings.postgateEmbeddingRules,
        )
      : null;
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._loadLists();
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  async _loadLists() {
    try {
      await this.dataLayer.requests.loadCurrentUserLists();
    } catch (error) {
      console.error(error);
      this.state.$listsError.set(error.message || "Could not load lists");
    }
  }

  _getCurateLists() {
    const currentUser = this.dataLayer.derived.$currentUser.get();
    if (!currentUser) return null;
    const listData = this.dataLayer.derived.$actorLists.get(currentUser.did);
    if (!listData) return null;
    return listData.lists.filter(
      (list) => list.purpose === CURATE_LIST_PURPOSE,
    );
  }

  _getSettings() {
    return untrack(() => this.state.$settings.get());
  }

  _setSettings(settings) {
    this.state.$settings.set(
      settings.length === 0 ? [{ type: "everybody" }] : settings,
    );
  }

  _selectEverybody() {
    this._setSettings([{ type: "everybody" }]);
  }

  _selectNobody() {
    this._setSettings([{ type: "nobody" }]);
  }

  _addRule(rule) {
    const settings = this._getSettings().filter(
      (setting) => setting.type !== "everybody" && setting.type !== "nobody",
    );
    if (settings.length >= MAX_ALLOW_RULES) return;
    this._setSettings([...settings, rule]);
  }

  _toggleRule(type) {
    const settings = this._getSettings();
    if (settings.some((setting) => setting.type === type)) {
      this._setSettings(settings.filter((setting) => setting.type !== type));
    } else {
      this._addRule({ type });
    }
  }

  _toggleList(list) {
    const settings = this._getSettings();
    const existing = settings.find(
      (setting) => setting.type === "list" && setting.list === list.uri,
    );
    if (existing) {
      this._setSettings(settings.filter((setting) => setting !== existing));
    } else {
      this._addRule({ type: "list", list: list.uri });
    }
  }

  _removeSetting(settingToRemove) {
    this._setSettings(
      this._getSettings().filter((setting) => setting !== settingToRemove),
    );
  }

  _save() {
    const threadgateAllow = buildThreadgateAllowFromNormalized(
      this._getSettings(),
    );
    const quotesEnabled = untrack(() => this.state.$quotesEnabled.get());
    const postgateEmbeddingRules = buildPostgateEmbeddingRules(quotesEnabled);
    const threadgateDirty =
      JSON.stringify(threadgateAllow) !== this._initialAllowJson;
    const postgateDirty = quotesEnabled !== this._initialQuotesEnabled;
    const saveAsDefault =
      this._defaultAllowJson !== null &&
      untrack(() => this.state.$saveAsDefault.get()) &&
      (JSON.stringify(threadgateAllow) !== this._defaultAllowJson ||
        quotesEnabled !== this._defaultQuotesEnabled);
    if (!threadgateDirty && !postgateDirty && !saveAsDefault) {
      this.close();
      return;
    }
    this.state.$isSaving.set(true);
    this.state.$saveError.set(null);
    this.dispatchEvent(
      new CustomEvent("save-interaction-settings", {
        detail: {
          threadgateAllow,
          threadgateDirty,
          postgateEmbeddingRules,
          postgateDirty,
          saveAsDefault,
          successCallback: () => {
            this.state.$isSaving.set(false);
            this.close();
          },
          errorCallback: (errorMessage) => {
            this.state.$isSaving.set(false);
            this.state.$saveError.set(errorMessage || "Please try again.");
          },
        },
      }),
    );
  }

  render() {
    const settings = this.state.$settings.get();
    const quotesEnabled = this.state.$quotesEnabled.get();
    const listsError = this.state.$listsError.get();
    const isSaving = this.state.$isSaving.get();
    const saveError = this.state.$saveError.get();
    const saveAsDefault = this.state.$saveAsDefault.get();
    const listsOpen = this.state.$listsOpen.get();
    const curateLists = this._getCurateLists();
    let defaultsRowState = null;
    if (this._defaultAllowJson !== null) {
      const currentAllowJson = JSON.stringify(
        buildThreadgateAllowFromNormalized(settings),
      );
      const matchesDefault =
        currentAllowJson === this._defaultAllowJson &&
        quotesEnabled === this._defaultQuotesEnabled;
      defaultsRowState = matchesDefault ? "matches" : "differs";
    }
    render(
      html`
        <dialog
          class="bottom-sheet post-interaction-settings-dialog ${this.stacked
            ? "bottom-sheet-stacked"
            : ""}"
          data-testid="post-interaction-settings-dialog"
          @click=${(event) => {
            if (event.target === event.currentTarget) {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("dialog-closed"));
          }}
        >
          <div class="post-interaction-settings-dialog-content">
            <button
              class="post-interaction-settings-dialog-close"
              aria-label="Close"
              @click=${() => this.close()}
            >
              <app-icon icon="close-line"></app-icon>
            </button>
            <div
              class="post-interaction-settings-dialog-body sheet-scroll-region"
            >
              <div class="post-interaction-settings-dialog-header">
                <h2 class="post-interaction-settings-dialog-title">
                  Post interaction settings
                </h2>
                <p class="post-interaction-settings-dialog-subtitle">
                  Customize who can interact with this post.
                </p>
              </div>
              ${interactionSettingsFormTemplate({
                settings,
                curateLists: curateLists ?? [],
                listsLoaded: curateLists !== null,
                listsError,
                hydratedLists: this.hydratedLists ?? [],
                quotesEnabled,
                isSaving,
                saveError,
                defaultsRowState,
                saveAsDefault,
                listsOpen,
                onToggleListsOpen: (open) => this.state.$listsOpen.set(open),
                onToggleSaveAsDefault: (checked) =>
                  this.state.$saveAsDefault.set(checked),
                onSelectEverybody: () => this._selectEverybody(),
                onSelectNobody: () => this._selectNobody(),
                onToggleRule: (type) => this._toggleRule(type),
                onToggleList: (list) => this._toggleList(list),
                onToggleQuotes: (checked) =>
                  this.state.$quotesEnabled.set(checked),
                onRemoveSetting: (setting) => this._removeSetting(setting),
                onSave: () => this._save(),
              })}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".post-interaction-settings-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      allowOppositeStretch: true,
      scrollContainer: this.querySelector(
        ".post-interaction-settings-dialog-body",
      ),
      ignoreTouchTarget: (element) =>
        element.closest("button, label, summary") !== null,
    });
  }

  close() {
    return closeWithAnimation(
      this.querySelector(".post-interaction-settings-dialog"),
    );
  }
}

PostInteractionSettingsDialog.register();
