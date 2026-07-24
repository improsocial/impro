import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import {
  closeWithAnimation,
  enableDragToDismiss,
  resetScrollOnBlur,
} from "/js/dialogHelpers.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
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

function notMessageableRightItem(profile) {
  if (canBeMessaged(profile)) return null;
  return html`<div
    class="new-chat-not-messageable-hint"
    data-testid="not-messageable-hint"
  >
    Can't be messaged
  </div>`;
}

function profileListTemplate({ profiles, onSelect, emptyMessage = null }) {
  return profileFeedTemplate({
    profiles,
    hasMore: false,
    skeletonCount: 6,
    compact: true,
    clickAction: onSelect,
    rightItemTemplate: notMessageableRightItem,
    disabledProfiles: (profiles ?? [])
      .filter((profile) => !canBeMessaged(profile))
      .map((profile) => profile.did),
    emptyMessage,
  });
}

class NewChatDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.dataLayer = this.dataLayer ?? null;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("new-chat-dialog");
    this.state.$query = new Signal.State("");
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
      this.dataLayer.requests.loadChatRecipientSearch("");
    } else {
      this.dataLayer.requests.loadChatRecipientSearch(query, { limit: 12 });
    }
    const results = this.querySelector(".search-dialog-results");
    if (results) results.scrollTop = 0;
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
    const currentUserDid = this.dataLayer.derived.$currentUser.get()?.did;
    const results = this.dataLayer.derived.$chatRecipientSearchResults.get();
    const searchStatus = this.dataLayer.requests.statusStore.$statuses.get(
      "loadChatRecipientSearch",
    );
    const profileFollows = currentUserDid
      ? this.dataLayer.derived.$profileFollows.get(currentUserDid)?.follows
      : null;
    const profileFollowsStatus = currentUserDid
      ? this.dataLayer.requests.statusStore.$statuses.get(
          `loadProfileFollows-${currentUserDid}`,
        )
      : null;
    render(
      html`
        <dialog
          class="bottom-sheet bottom-sheet-fullscreen search-dialog new-chat-dialog"
          data-testid="new-chat-dialog"
          autofocus
          @click=${(event) => {
            if (event.target.tagName === "DIALOG") {
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
          <div class="search-dialog-content">
            <div class="search-dialog-header">
              <h2 class="search-dialog-title">Start a new chat</h2>
              <button
                class="search-dialog-close"
                aria-label="Close"
                data-testid="new-chat-dialog-close"
                @click=${() => this.close()}
              >
                ${closeIconTemplate()}
              </button>
            </div>
            <div class="search-dialog-input-container">
              ${searchIconTemplate()}
              <input
                type="search"
                class="search-dialog-input"
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
            <div class="search-dialog-results">
              ${(() => {
                if (query) {
                  if (searchStatus?.error) {
                    return html`<div
                      class="search-dialog-message"
                      data-testid="new-chat-error"
                    >
                      We're having network issues, try again
                    </div>`;
                  }
                  return profileListTemplate({
                    profiles: results
                      ? partitionRows(results, currentUserDid)
                      : null,
                    onSelect: (profile) => this._onSelect(profile),
                    emptyMessage: "No results",
                  });
                }
                let suggestedProfiles = null;
                if (profileFollowsStatus?.error) {
                  suggestedProfiles = [];
                } else if (profileFollows) {
                  suggestedProfiles = partitionRows(
                    profileFollows.filter((profile) => canBeMessaged(profile)),
                    currentUserDid,
                  );
                }
                if (!suggestedProfiles?.length) {
                  return profileListTemplate({
                    profiles: suggestedProfiles,
                    emptyMessage: "Search for someone to message",
                  });
                }
                return html`
                  <div
                    class="search-dialog-section-header"
                    data-testid="new-chat-suggested-header"
                  >
                    Suggested
                  </div>
                  ${profileListTemplate({
                    profiles: suggestedProfiles,
                    onSelect: (profile) => this._onSelect(profile),
                  })}
                `;
              })()}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".new-chat-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    this.querySelector(".search-dialog-input")?.focus({
      preventScroll: true,
    });
    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      scrollContainer: this.querySelector(".search-dialog-results"),
      ignoreTouchTarget: (element) => element.closest("button, input") !== null,
    });
    resetScrollOnBlur(dialog, this.querySelector(".search-dialog-results"));
  }

  close() {
    return closeWithAnimation(this.querySelector(".new-chat-dialog"));
  }
}

NewChatDialog.register();
