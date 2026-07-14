import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { enableDragToDismiss, debounce, isTouchDevice } from "/js/utils.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import { getDisplayName, MISSING_HANDLE } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { showToast } from "/js/toasts.js";

const CREATE_CHAT_ERROR_TOASTS = {
  AccountSuspended: "Suspended accounts cannot participate in chat.",
  BlockedActor: "This user has blocked you and cannot be messaged.",
  MessagesDisabled: "This user has disabled chat and cannot be messaged.",
  NotFollowedBySender: "Chat recipient is not followed by the sender.",
  RecipientNotFound: "Unable to find the selected recipient.",
};

function canBeMessaged(profile) {
  const allowIncoming = profile.associated?.chat?.allowIncoming;
  switch (allowIncoming) {
    case "none":
      return false;
    case "all":
      return true;
    case "following":
    case undefined:
      return Boolean(profile.viewer?.followedBy);
    default:
      return false;
  }
}

function createChatErrorToastMessage(error) {
  if (error instanceof TypeError) {
    return "A network error occurred. Please check your internet connection.";
  }
  return (
    CREATE_CHAT_ERROR_TOASTS[error?.data?.error] ??
    "An issue occurred starting the chat, please try again."
  );
}

function partitionRows(profiles, currentUserDid) {
  const seenDids = new Set();
  const deduped = [];
  for (const profile of profiles) {
    if (profile.did === currentUserDid) continue;
    if (seenDids.has(profile.did)) continue;
    seenDids.add(profile.did);
    deduped.push(profile);
  }
  return [
    ...deduped.filter((profile) => canBeMessaged(profile)),
    ...deduped.filter((profile) => !canBeMessaged(profile)),
  ];
}

function skeletonTemplate() {
  return html`${Array.from({ length: 6 }).map(
    () => html`
      <div class="new-chat-result skeleton" data-testid="new-chat-skeleton">
        <div class="new-chat-skeleton-avatar skeleton-animate"></div>
        <div class="new-chat-result-content">
          <div class="new-chat-skeleton-name skeleton-animate"></div>
          <div class="new-chat-skeleton-handle skeleton-animate"></div>
        </div>
      </div>
    `,
  )}`;
}

function resultRowTemplate({ profile, onSelect }) {
  const isMessageable = canBeMessaged(profile);
  const hasHandle = profile.handle && profile.handle !== MISSING_HANDLE;
  return html`
    <button
      class="new-chat-result ${isMessageable ? "" : "is-not-messageable"}"
      data-testid="new-chat-result"
      data-teststate=${isMessageable ? "messageable" : "not-messageable"}
      ?disabled=${!isMessageable}
      @click=${() => onSelect(profile)}
    >
      ${avatarTemplate({ author: profile, clickAction: "none" })}
      <div class="new-chat-result-content">
        <div class="new-chat-result-name">${getDisplayName(profile)}</div>
        <div class="new-chat-result-handle">
          ${hasHandle
            ? isMessageable
              ? `@${profile.handle}`
              : `@${profile.handle} can't be messaged`
            : ""}
        </div>
      </div>
    </button>
  `;
}

function searchResultsTemplate({ status, rows, onSelect }) {
  if (status.error) {
    return html`<div class="new-chat-message-row" data-testid="new-chat-error">
      We're having network issues, try again
    </div>`;
  }
  if (!rows || (rows.length === 0 && status.loading)) {
    return skeletonTemplate();
  }
  if (rows.length === 0) {
    return html`<div class="new-chat-message-row" data-testid="empty-state">
      No results
    </div>`;
  }
  return rows.map((profile) => resultRowTemplate({ profile, onSelect }));
}

function suggestionsTemplate({ status, rows, onSelect }) {
  if (!rows && !status?.error) {
    return skeletonTemplate();
  }
  if (!rows || rows.length === 0) {
    return html`<div
      class="new-chat-message-row"
      data-testid="new-chat-empty-prompt"
    >
      Search for someone to message
    </div>`;
  }
  return html`
    <div
      class="new-chat-section-header"
      data-testid="new-chat-suggested-header"
    >
      Suggested
    </div>
    ${rows.map((profile) => resultRowTemplate({ profile, onSelect }))}
  `;
}

class NewChatDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.dataLayer = this.dataLayer ?? null;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = new ScrollLock(this);
    this.state = new ReactiveStore("new-chat-dialog");
    this.state.$query = new Signal.State("");
    this._debouncedSearch = debounce((query) => {
      this.dataLayer.requests.loadChatRecipientSearch(query, { limit: 12 });
    });
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._loadSuggestions();
    this.initialized = true;
  }

  async _loadSuggestions() {
    try {
      const currentUser = await this.dataLayer.declarative.ensureCurrentUser();
      await this.dataLayer.declarative.ensureProfileFollows(currentUser.did);
    } catch (error) {
      console.warn("Failed to load suggested chat recipients", error);
    }
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

  _onSearchInput(value) {
    this.state.$query.set(value);
    const query = value.trim();
    if (!query) {
      this._debouncedSearch.cancel();
      this.dataLayer.requests.loadChatRecipientSearch("");
    } else {
      this._debouncedSearch(query);
    }
  }

  _onClearSearch() {
    this._onSearchInput("");
  }

  async _onSelect(profile) {
    this.close();
    try {
      const convo = await this.dataLayer.declarative.ensureConvoForProfile(
        profile.did,
      );
      window.router.go(`/messages/${convo.id}`);
    } catch (error) {
      console.warn("Failed to start chat", error);
      showToast(createChatErrorToastMessage(error), { style: "error" });
    }
  }

  render() {
    const query = this.state.$query.get().trim();
    const onSelect = (profile) => this._onSelect(profile);
    const currentUserDid = this.dataLayer.derived.$currentUser.get()?.did;
    const results = this.dataLayer.derived.$chatRecipientSearchResults.get();
    const searchStatus = this.dataLayer.requests.statusStore.$statuses.get(
      "loadChatRecipientSearch",
    );
    const follows = currentUserDid
      ? this.dataLayer.derived.$profileFollows.get(currentUserDid)?.follows
      : null;
    const followsStatus = currentUserDid
      ? this.dataLayer.requests.statusStore.$statuses.get(
          `loadProfileFollows-${currentUserDid}`,
        )
      : null;
    render(
      html`
        <dialog
          class="bottom-sheet new-chat-dialog"
          data-testid="new-chat-dialog"
          @click=${(event) => {
            if (event.target.tagName === "DIALOG") {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
        >
          <div class="new-chat-dialog-content">
            <div class="new-chat-dialog-header">
              <h2 class="new-chat-dialog-title">Start a new chat</h2>
              <button
                class="new-chat-dialog-close"
                aria-label="Close"
                data-testid="new-chat-dialog-close"
                @click=${() => this.close()}
              >
                ${closeIconTemplate()}
              </button>
            </div>
            <div class="new-chat-search-container">
              ${searchIconTemplate()}
              <input
                type="search"
                class="new-chat-search-input"
                data-testid="new-chat-search-input"
                placeholder="Search for people"
                maxlength="50"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                .value=${this.state.$query.get()}
                @input=${(event) => this._onSearchInput(event.target.value)}
              />
              ${this.state.$query.get().length > 0
                ? html`
                    <button
                      class="search-clear-button"
                      data-testid="new-chat-search-clear"
                      aria-label="Clear search"
                      @click=${() => this._onClearSearch()}
                    >
                      ${closeIconTemplate()}
                    </button>
                  `
                : ""}
            </div>
            <div class="new-chat-results">
              ${query
                ? searchResultsTemplate({
                    status: searchStatus,
                    rows: results
                      ? partitionRows(results, currentUserDid)
                      : null,
                    onSelect,
                  })
                : suggestionsTemplate({
                    status: followsStatus,
                    rows: follows
                      ? partitionRows(
                          follows.filter((profile) => canBeMessaged(profile)),
                          currentUserDid,
                        )
                      : null,
                    onSelect,
                  })}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.scrollLock.lock();
    const dialog = this.querySelector(".new-chat-dialog");
    dialog.showModal();
    if (!isTouchDevice()) {
      this.querySelector(".new-chat-search-input")?.focus();
    }
    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      scrollContainer: this.querySelector(".new-chat-results"),
      ignoreTouchTarget: (element) => element.closest("button, input") !== null,
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".new-chat-dialog");
    if (dialog?.open) {
      dialog.close();
    }
    this.dispatchEvent(new CustomEvent("dialog-closed"));
  }
}

NewChatDialog.register();
