import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { Signal, effect } from "/js/signals.js";
import "/js/components/app-icon.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { linkToProfile } from "/js/navigation.js";
import "/js/components/container-link.js";

const TYPEAHEAD_LIMIT = 8;

function typeaheadTemplate({ query, profiles, onCommit, onSelectProfile }) {
  return html`<div
    class="search-typeahead sidebar-search-typeahead"
    data-testid="sidebar-search-typeahead"
    @mousedown=${(event) => event.preventDefault()}
  >
    <button
      type="button"
      class="search-typeahead-row sidebar-search-typeahead-row"
      data-testid="sidebar-search-typeahead-search-row"
      @click=${onCommit}
    >
      <div class="search-typeahead-icon">
        <app-icon icon="search-line"></app-icon>
      </div>
      <div class="search-typeahead-text">${query}</div>
    </button>
    ${profiles === null
      ? html`<div class="search-typeahead-loading">
          <div class="loading-spinner"></div>
        </div>`
      : profiles.map(
          (profile) => html`
            <container-link
              class="search-typeahead-row sidebar-search-typeahead-row clickable"
              data-testid="sidebar-search-typeahead-result"
              href=${linkToProfile(profile)}
              @click=${() => onSelectProfile(profile.did)}
            >
              ${avatarTemplate({ author: profile, clickAction: "none" })}
              <div class="search-typeahead-text">
                <div class="search-typeahead-name">
                  ${getDisplayName(profile)}
                </div>
                <div class="search-typeahead-handle">@${profile.handle}</div>
              </div>
            </container-link>
          `,
        )}
  </div>`;
}

function sidebarSearchTemplate({
  inputValue,
  showTypeahead,
  profiles,
  onInput,
  onKeydown,
  onFocus,
  onBlur,
  onClear,
  onCommit,
  onSelectProfile,
}) {
  return html`<div class="sidebar-search">
    <div class="sidebar-search-input-container">
      <app-icon icon="search-line"></app-icon>
      <input
        class="sidebar-search-input"
        data-testid="sidebar-search-input"
        type="search"
        name="sidebar-search"
        aria-label="Search"
        autocapitalize="none"
        autocomplete="off"
        autocorrect="off"
        enterkeyhint="search"
        spellcheck="false"
        placeholder="Search"
        .value=${inputValue}
        @input=${(event) => {
          // Prevent events from being picked up by password manager extensions
          event.stopPropagation();
          onInput(event.target.value);
        }}
        @keydown=${onKeydown}
        @focus=${onFocus}
        @blur=${onBlur}
      />
      ${inputValue.length > 0
        ? html`<button
            type="button"
            class="search-clear-button sidebar-search-clear-button"
            data-testid="sidebar-search-clear-button"
            aria-label="Clear search"
            @click=${onClear}
          >
            ${closeIconTemplate()}
          </button>`
        : ""}
    </div>
    ${showTypeahead
      ? typeaheadTemplate({
          query: inputValue.trim(),
          profiles,
          onCommit,
          onSelectProfile,
        })
      : ""}
  </div>`;
}

class SidebarSearch extends Component {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.dataLayer) {
      throw new Error("sidebar-search requires a dataLayer property");
    }
    this.$inputValue = new Signal.State("");
    this.$showTypeahead = new Signal.State(false);
    this._disposers = [effect(() => this.render())];
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
    this.initialized = false;
  }

  render() {
    const inputValue = this.$inputValue.get();
    const showTypeahead = this.$showTypeahead.get();
    const profiles = showTypeahead
      ? this.dataLayer.derived.$sidebarSearchTypeaheadResults.get()
      : null;
    render(
      sidebarSearchTemplate({
        inputValue,
        showTypeahead,
        profiles,
        onInput: (value) => this.handleInput(value),
        onKeydown: (event) => this.handleKeydown(event),
        onFocus: () => this.handleFocus(),
        onBlur: () => this.$showTypeahead.set(false),
        onClear: () => this.handleClear(),
        onCommit: () => this.commitSearch(),
        onSelectProfile: (did) => this.handleSelectProfile(did),
      }),
      this,
    );
  }

  loadTypeahead(query) {
    this.dataLayer.requests
      .loadSidebarSearchTypeahead(query, { limit: TYPEAHEAD_LIMIT })
      .catch((error) => console.warn("Typeahead search failed", error));
  }

  handleInput(value) {
    this.$inputValue.set(value);
    const trimmed = value.trim();
    if (!trimmed) {
      this.$showTypeahead.set(false);
      this.loadTypeahead("");
      return;
    }
    this.$showTypeahead.set(true);
    this.loadTypeahead(trimmed);
  }

  handleFocus() {
    if (this.$inputValue.get().trim()) {
      this.$showTypeahead.set(true);
    }
  }

  handleKeydown(event) {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      this.commitSearch();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.handleClear();
    }
  }

  reset() {
    this.$inputValue.set("");
    this.$showTypeahead.set(false);
    this.loadTypeahead("");
  }

  handleClear() {
    this.reset();
    this.querySelector(".sidebar-search-input")?.focus();
  }

  handleSelectProfile(did) {
    if (this.isAuthenticated) {
      this.dataLayer.mutations.addRecentSearchProfile(did).catch(console.warn);
    }
    this.reset();
    this.querySelector(".sidebar-search-input")?.blur();
  }

  commitSearch() {
    const query = this.$inputValue.get().trim();
    if (!query) return;
    if (this.isAuthenticated) {
      this.dataLayer.mutations.addRecentSearch(query).catch(console.warn);
    }
    this.reset();
    this.querySelector(".sidebar-search-input")?.blur();
    const params = new URLSearchParams();
    params.set("q", query);
    window.router.go(`/search?${params.toString()}`);
  }
}

SidebarSearch.register();
