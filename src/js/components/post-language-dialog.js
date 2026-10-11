import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";
import { POST_LANGUAGES, POST_LANGUAGE_CODES } from "/js/languages.js";
import { getNameForLanguageCode, unique } from "/js/utils.js";
import "/js/components/app-icon.js";

const MAX_POST_LANGUAGES = 3;
const MAX_RECENT_LANGUAGES = 5;

function normalizeSearchText(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function languageMatchesQuery(language, normalizedQuery) {
  return (
    language.code2 === normalizedQuery ||
    normalizeSearchText(language.label).includes(normalizedQuery) ||
    normalizeSearchText(language.name).includes(normalizedQuery)
  );
}

function languageRowTemplate({ language, checked, disabled, onToggle }) {
  return html`
    <label
      class="checkbox-row post-language-row ${disabled
        ? "post-language-row-disabled"
        : ""}"
      data-testid="post-language-option-${language.code2}"
      data-teststate=${checked ? "checked" : "unchecked"}
    >
      <input
        type="checkbox"
        .checked=${checked}
        .disabled=${disabled}
        @change=${() => onToggle(language.code2)}
      />
      ${language.label}
    </label>
  `;
}

function languageSectionTemplate({
  title,
  testid,
  languages,
  checkedLanguages,
  onToggle,
}) {
  if (languages.length === 0) {
    return null;
  }
  const isAtCap = checkedLanguages.length >= MAX_POST_LANGUAGES;
  return html`
    <section class="post-language-section" data-testid=${testid}>
      <h3 class="post-language-section-title">${title}</h3>
      ${languages.map((language) => {
        const checked = checkedLanguages.includes(language.code2);
        return languageRowTemplate({
          language,
          checked,
          disabled: !checked && isAtCap,
          onToggle,
        });
      })}
    </section>
  `;
}

function postLanguageDialogTemplate({
  query,
  recentLanguages,
  allLanguages,
  checkedLanguages,
  onQueryChange,
  onToggle,
  onDone,
}) {
  const normalizedQuery = normalizeSearchText(query.trim());
  const isVisible = (language) =>
    !normalizedQuery ||
    checkedLanguages.includes(language.code2) ||
    languageMatchesQuery(language, normalizedQuery);
  const visibleRecentLanguages = recentLanguages.filter(isVisible);
  const visibleAllLanguages = allLanguages.filter(isVisible);
  const hasUncheckedMatches = [
    ...visibleRecentLanguages,
    ...visibleAllLanguages,
  ].some((language) => !checkedLanguages.includes(language.code2));
  return html`
    <div class="post-language-dialog-header">
      <h2 class="post-language-dialog-title" id="post-language-dialog-title">
        Choose post languages
      </h2>
      <p class="post-language-dialog-subtitle">
        Select up to ${MAX_POST_LANGUAGES} languages used in this post
      </p>
      <div class="search-dialog-input-container">
        <app-icon icon="search-line"></app-icon>
        <input
          type="search"
          class="search-dialog-input"
          data-testid="post-language-search-input"
          placeholder="Search languages"
          aria-label="Search languages"
          maxlength="50"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
          .value=${query}
          @input=${(event) => onQueryChange(event.target.value)}
        />
        ${query.length > 0
          ? html`<button
              class="search-clear-button"
              data-testid="post-language-search-clear"
              aria-label="Clear language search"
              @click=${() => onQueryChange("")}
            >
              <app-icon icon="close-line"></app-icon>
            </button>`
          : ""}
      </div>
    </div>
    <div
      class="post-language-dialog-list sheet-scroll-region"
      role="group"
      aria-labelledby="post-language-dialog-title"
    >
      ${languageSectionTemplate({
        title: "Recently used",
        testid: "post-language-section-recent",
        languages: visibleRecentLanguages,
        checkedLanguages,
        onToggle,
      })}
      ${languageSectionTemplate({
        title: "All languages",
        testid: "post-language-section-all",
        languages: visibleAllLanguages,
        checkedLanguages,
        onToggle,
      })}
      ${normalizedQuery && !hasUncheckedMatches
        ? html`<div class="search-dialog-message" data-testid="empty-state">
            No languages found
          </div>`
        : null}
    </div>
    <div class="post-language-dialog-footer">
      <button
        class="rounded-button rounded-button-primary post-language-done-button"
        data-testid="post-language-done-button"
        @click=${onDone}
      >
        Done
      </button>
    </div>
  `;
}

class PostLanguageDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    const languagesByCode = new Map(
      POST_LANGUAGES.map((language) => [
        language.code2,
        { ...language, label: getNameForLanguageCode(language.code2) },
      ]),
    );
    // Fixed for the dialog's lifetime so rows don't move while toggling
    const recentCodes = unique([
      ...this.currentLanguages,
      ...this.postLanguageHistory.flat(),
    ])
      .filter((code) => POST_LANGUAGE_CODES.has(code))
      .slice(0, MAX_RECENT_LANGUAGES);
    this._recentLanguages = recentCodes.map((code) =>
      languagesByCode.get(code),
    );
    this._allLanguages = [...languagesByCode.values()]
      .filter((language) => !recentCodes.includes(language.code2))
      .sort((a, b) => a.label.localeCompare(b.label));
    this.state = new ReactiveStore("post-language-dialog");
    this.state.$checkedLanguages = new Signal.State(
      this.currentLanguages.filter((code) => POST_LANGUAGE_CODES.has(code)),
    );
    this.state.$query = new Signal.State("");
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  _toggleLanguage(code) {
    const checkedLanguages = untrack(() => this.state.$checkedLanguages.get());
    if (checkedLanguages.includes(code)) {
      this.state.$checkedLanguages.set(
        checkedLanguages.filter((checkedCode) => checkedCode !== code),
      );
    } else if (checkedLanguages.length < MAX_POST_LANGUAGES) {
      this.state.$checkedLanguages.set([...checkedLanguages, code]);
    }
  }

  _done() {
    this.dispatchEvent(
      new CustomEvent("select-languages", {
        detail: {
          languages: untrack(() => this.state.$checkedLanguages.get()),
        },
      }),
    );
    this.close();
  }

  render() {
    const checkedLanguages = this.state.$checkedLanguages.get();
    const query = this.state.$query.get();
    render(
      html`
        <dialog
          class="bottom-sheet bottom-sheet-stacked post-language-dialog"
          data-testid="post-language-dialog"
          autofocus
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
          <div class="post-language-dialog-content">
            ${postLanguageDialogTemplate({
              query,
              recentLanguages: this._recentLanguages,
              allLanguages: this._allLanguages,
              checkedLanguages,
              onQueryChange: (value) => this.state.$query.set(value),
              onToggle: (code) => this._toggleLanguage(code),
              onDone: () => this._done(),
            })}
          </div>
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".post-language-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      allowOppositeStretch: true,
      scrollContainer: this.querySelector(".post-language-dialog-list"),
      ignoreTouchTarget: (element) =>
        element.closest("button, label, input") !== null,
    });
  }

  close() {
    return closeWithAnimation(this.querySelector(".post-language-dialog"));
  }
}

PostLanguageDialog.register();
