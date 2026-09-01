import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";
import { classnames } from "/js/utils.js";
import { gifProxyUrl } from "/js/embedHelpers.js";
import "/js/components/app-icon.js";
import "/js/components/infinite-scroll-container.js";

const SEARCH_DEBOUNCE_MS = 300;

const GIF_CATEGORIES = [
  {
    id: "recents",
    searchTerm: null,
    label: "Recent GIFs",
    icon: "clock-line",
  },
  {
    id: "trending",
    searchTerm: null,
    label: "Trending GIFs",
    icon: "pulse-line",
  },
  { id: "love", searchTerm: "love", label: "Love GIFs", icon: "heart-line" },
  {
    id: "happy",
    searchTerm: "happy",
    label: "Happy GIFs",
    icon: "emoji-smile-line",
  },
  { id: "sad", searchTerm: "cry", label: "Sad GIFs", icon: "emoji-sad-line" },
  {
    id: "party",
    searchTerm: "congratulations",
    label: "Party GIFs",
    icon: "celebrate-line",
  },
  { id: "yes", searchTerm: "yes", label: "Yes GIFs", icon: "thumbs-up-line" },
];

function getCategory(categoryId) {
  return GIF_CATEGORIES.find((category) => category.id === categoryId);
}

function gifPickerHeaderTemplate({ query, onInput, onClear, onCloseDialog }) {
  return html`<div class="gif-picker-header" data-testid="gif-picker-header">
    <div class="search-dialog-input-container gif-picker-input-container">
      <app-icon icon="search-line"></app-icon>
      <input
        type="search"
        class="search-dialog-input gif-picker-search"
        data-testid="gif-picker-search"
        placeholder="Search KLIPY"
        aria-label="Search GIFs"
        maxlength="50"
        enterkeyhint="search"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="none"
        spellcheck="false"
        .value=${query}
        @input=${(event) => onInput(event.target.value)}
        @keydown=${(event) => event.stopPropagation()}
      />
      ${query.length > 0
        ? html`<button
            class="search-clear-button"
            data-testid="gif-picker-clear"
            aria-label="Clear GIF search"
            @click=${() => onClear()}
          >
            <app-icon icon="close-line"></app-icon>
          </button>`
        : ""}
    </div>
    <button
      class="search-dialog-close gif-picker-close"
      aria-label="Close"
      data-testid="gif-picker-close"
      @click=${() => onCloseDialog()}
    >
      <app-icon icon="close-line"></app-icon>
    </button>
  </div>`;
}

function gifCategoryPillsTemplate({ activeCategory, hasRecents, onSelect }) {
  const categories = GIF_CATEGORIES.filter(
    (category) => category.id !== "recents" || hasRecents,
  );
  return html`<div class="gif-picker-pills" data-testid="gif-picker-pills">
    ${categories.map(
      (category) =>
        html`<button
          class=${classnames("gif-picker-pill", {
            "is-active": category.id === activeCategory,
          })}
          data-testid="gif-category-pill"
          data-testcategory=${category.id}
          data-teststate=${category.id === activeCategory
            ? "selected"
            : "unselected"}
          aria-label=${category.label}
          aria-current=${category.id === activeCategory ? "true" : "false"}
          @click=${() => onSelect(category.id)}
        >
          <app-icon icon=${category.icon}></app-icon>
        </button>`,
    )}
  </div>`;
}

function gifTileTemplate({ gif, onSelect }) {
  const tinygif = gif.media_formats.tinygif;
  const [width, height] = tinygif.dims ?? [];
  const aspectRatio = width > 0 && height > 0 ? width / height : 1;
  return html`<button
    class="gif-picker-tile"
    data-testid="gif-picker-tile"
    style="aspect-ratio: ${aspectRatio}"
    aria-label='Select GIF "${gif.title}"'
    @click=${() => onSelect(gif)}
  >
    <img src=${gifProxyUrl(tinygif.url)} alt=${gif.title} loading="lazy" />
  </button>`;
}

function gifTilesTemplate({ gifs, onSelect }) {
  return html`<div class="gif-picker-grid" data-testid="gif-picker-grid">
    ${gifs.map((gif) => gifTileTemplate({ gif, onSelect }))}
  </div>`;
}

function gifGridTemplate({
  gifs,
  cursor,
  loading,
  error,
  onSelect,
  onLoadMore,
  onRetry,
}) {
  const paginationDisabled = !cursor || loading || !!error;
  return html`<infinite-scroll-container
    lookahead="1200px"
    ?disabled=${paginationDisabled}
    @load-more=${(event) => onLoadMore(event.detail.resume)}
  >
    ${gifTilesTemplate({ gifs, onSelect })}
    ${error && gifs.length > 0
      ? html`<div
          class="gif-picker-footer-message"
          data-testid="gif-picker-load-more-error"
        >
          <span>Couldn't load more GIFs.</span>
          <button class="text-pill-button" @click=${() => onRetry()}>
            Retry
          </button>
        </div>`
      : ""}
    ${loading && gifs.length > 0
      ? html`<div
          class="gif-picker-footer-message"
          data-testid="gif-picker-loading-more"
        >
          <div class="loading-spinner"></div>
        </div>`
      : ""}
  </infinite-scroll-container>`;
}

function gifPickerEmptyTemplate({ message }) {
  return html`<div class="gif-picker-placeholder" data-testid="empty-state">
    ${message}
  </div>`;
}

// Recents come from preferences, so this body has no loading, error, or
// pagination states
function gifRecentsBodyTemplate({ recentGifs, onSelect }) {
  if (recentGifs.length === 0) {
    return gifPickerEmptyTemplate({
      message: "No recent GIFs yet. Pick one to see it here.",
    });
  }
  return gifTilesTemplate({ gifs: recentGifs, onSelect });
}

function gifResultsBodyTemplate({
  gifResults,
  cursor,
  loading,
  error,
  typedQuery,
  onSelect,
  onLoadMore,
  onRetry,
}) {
  const gifs = gifResults ?? [];
  if (loading && gifs.length === 0) {
    return html`<div
      class="gif-picker-placeholder"
      data-testid="gif-picker-loading"
    >
      <div class="loading-spinner"></div>
    </div>`;
  }
  if (error && gifs.length === 0) {
    return html`<div
      class="gif-picker-placeholder"
      data-testid="gif-picker-error"
    >
      <div class="gif-picker-placeholder-title">Couldn't load GIFs</div>
      <div class="gif-picker-placeholder-body">
        There was a problem loading GIFs. Check your connection and try again.
      </div>
      <button
        class="rounded-button rounded-button-primary"
        data-testid="gif-picker-retry"
        @click=${() => onRetry()}
      >
        Retry
      </button>
    </div>`;
  }
  if (gifResults !== null && gifs.length === 0) {
    return gifPickerEmptyTemplate({
      message: typedQuery
        ? html`No GIFs found for "${typedQuery}".`
        : "No GIFs to show right now. Try again in a moment.",
    });
  }
  return gifGridTemplate({
    gifs,
    cursor,
    loading,
    error,
    onSelect,
    onLoadMore,
    onRetry,
  });
}

class GifPickerDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.dataLayer = this.dataLayer ?? null;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._debounceTimer = null;
    this._lastLoadedQuery = null;
    this._scrollResetInstalled = false;
    this.state = new ReactiveStore("gif-picker-dialog");
    // The value in the query text input
    this.state.$query = new Signal.State("");
    // The query the grid is actually showing
    this.state.$debouncedQuery = new Signal.State("");
    this.state.$activeCategory = new Signal.State("trending");
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this.initialized = true;
  }

  disconnectedCallback() {
    this._clearDebounce();
    this._disposeEffect?.();
    this._disposeEffect = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  _clearDebounce() {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  // User search (debounced query) has precedence over implicit search (active category)
  _getEffectiveState() {
    const debouncedQuery = untrack(() => this.state.$debouncedQuery.get());
    const activeCategory = untrack(() => this.state.$activeCategory.get());
    if (debouncedQuery) {
      return { isRecentsMode: false, effectiveQuery: debouncedQuery };
    }
    if (activeCategory === "recents") {
      return { isRecentsMode: true, effectiveQuery: null };
    }
    return {
      isRecentsMode: false,
      effectiveQuery: getCategory(activeCategory)?.searchTerm ?? "",
    };
  }

  _loadForCurrentState() {
    const { isRecentsMode, effectiveQuery } = this._getEffectiveState();
    if (isRecentsMode) {
      this._lastLoadedQuery = null;
      return;
    }
    if (effectiveQuery === this._lastLoadedQuery) return;
    this._lastLoadedQuery = effectiveQuery;
    this._resetScroll();
    this.dataLayer.requests.loadGifs(effectiveQuery).catch((error) => {
      console.warn("Failed to load GIFs", error);
    });
  }

  _resetScroll() {
    const body = this.querySelector(".gif-picker-body");
    if (body) body.scrollTop = 0;
  }

  _onSearchInput(value) {
    this.state.$query.set(value);
    this._clearDebounce();
    const trimmed = value.trim();
    if (!trimmed) {
      // Backspace-to-empty restores the active pill immediately, like the clear button
      this.state.$debouncedQuery.set("");
      this._loadForCurrentState();
      return;
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.state.$debouncedQuery.set(trimmed);
      this._loadForCurrentState();
    }, SEARCH_DEBOUNCE_MS);
  }

  _onClearSearch() {
    this._clearDebounce();
    this.state.$query.set("");
    this.state.$debouncedQuery.set("");
    this._loadForCurrentState();
    this.querySelector(".gif-picker-search")?.focus({ preventScroll: true });
  }

  _onSelectCategory(categoryId) {
    this.state.$activeCategory.set(categoryId);
    this._resetScroll();
    this._loadForCurrentState();
  }

  _onRetry() {
    this._lastLoadedQuery = null;
    this._loadForCurrentState();
  }

  _onLoadMore(resume) {
    const { isRecentsMode, effectiveQuery } = this._getEffectiveState();
    const cursor = untrack(() => this.dataLayer.derived.$gifCursor.get());
    const status = untrack(() =>
      this.dataLayer.requests.statusStore.$statuses.get(
        `loadGifs-${effectiveQuery}`,
      ),
    );
    if (isRecentsMode || !cursor || status?.loading || status?.error) {
      resume();
      return;
    }
    this.dataLayer.requests
      .loadGifs(effectiveQuery, { cursor })
      .catch((error) => {
        console.warn("Failed to load more GIFs", error);
      })
      .finally(() => resume());
  }

  async _onSelectGif(gif) {
    // Write recents first; never block selection on it (it fails when e.g.
    // preferences haven't loaded)
    this.dataLayer.mutations.addRecentGif(gif).catch((error) => {
      console.warn("Failed to save recent GIF", error);
    });
    await this.close();
    this.dispatchEvent(new CustomEvent("gif-selected", { detail: { gif } }));
  }

  render() {
    const query = this.state.$query.get();
    const debouncedQuery = this.state.$debouncedQuery.get();
    const activeCategory = this.state.$activeCategory.get();
    const recentGifs = this.dataLayer?.derived.$recentGifs.get() ?? [];
    const gifResults = this.dataLayer?.derived.$gifResults.get() ?? null;
    const gifCursor = this.dataLayer?.derived.$gifCursor.get() ?? null;
    const isRecentsMode = !debouncedQuery && activeCategory === "recents";
    const effectiveQuery = debouncedQuery
      ? debouncedQuery
      : (getCategory(activeCategory)?.searchTerm ?? "");
    const status = this.dataLayer?.requests.statusStore.$statuses.get(
      `loadGifs-${effectiveQuery}`,
    );

    render(
      html`
        <dialog
          class="bottom-sheet bottom-sheet-stacked bottom-sheet-fullscreen gif-picker-dialog"
          data-testid="gif-picker-dialog"
          aria-label="GIF picker"
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
          <div class="gif-picker-content">
            ${gifPickerHeaderTemplate({
              query,
              onInput: (value) => this._onSearchInput(value),
              onClear: () => this._onClearSearch(),
              onCloseDialog: () => this.close(),
            })}
            ${query.length === 0
              ? gifCategoryPillsTemplate({
                  activeCategory,
                  hasRecents: recentGifs.length > 0,
                  onSelect: (categoryId) => this._onSelectCategory(categoryId),
                })
              : ""}
            <div class="gif-picker-body sheet-scroll-region">
              ${isRecentsMode
                ? gifRecentsBodyTemplate({
                    recentGifs,
                    onSelect: (gif) => this._onSelectGif(gif),
                  })
                : gifResultsBodyTemplate({
                    gifResults,
                    cursor: gifCursor,
                    loading: status?.loading ?? false,
                    error: status?.error ?? null,
                    typedQuery: debouncedQuery,
                    onSelect: (gif) => this._onSelectGif(gif),
                    onLoadMore: (resume) => this._onLoadMore(resume),
                    onRetry: () => this._onRetry(),
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
    const dialog = this.querySelector(".gif-picker-dialog");
    if (dialog?.open) return;
    this._clearDebounce();
    this.state.$query.set("");
    this.state.$debouncedQuery.set("");
    this.state.$activeCategory.set("trending");
    this._lastLoadedQuery = null;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      scrollContainer: this.querySelector(".gif-picker-body"),
      ignoreTouchTarget: (element) => element.closest("button, input") !== null,
    });
    if (!this._scrollResetInstalled) {
      // The dialog stays mounted across opens, so only install this once
      resetScrollOnBlur(dialog, this.querySelector(".gif-picker-body"));
      this._scrollResetInstalled = true;
    }
    this._loadForCurrentState();
  }

  close() {
    this._clearDebounce();
    return closeWithAnimation(this.querySelector(".gif-picker-dialog"));
  }
}

GifPickerDialog.register();
