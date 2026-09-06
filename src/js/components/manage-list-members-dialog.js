import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, SignalSet, ReactiveStore, effect } from "/js/signals.js";
import "/js/components/app-icon.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { classnames } from "/js/utils.js";

const MAX_MEMBER_PAGES = 6;

function toggleButtonTemplate({ profile, isMember, isPending, onToggle }) {
  return html`<button
    class=${classnames(
      "rounded-button",
      "manage-list-members-toggle",
      isMember ? "rounded-button-secondary" : "rounded-button-primary",
    )}
    data-testid="manage-list-members-toggle"
    data-teststate=${isMember ? "member" : "not-member"}
    ?disabled=${isPending}
    @click=${() => onToggle(profile)}
  >
    ${isPending
      ? html`<div class="loading-spinner" data-testid="loading-spinner"></div>`
      : isMember
        ? "Remove"
        : "Add"}
  </button>`;
}

function profileListTemplate({ profiles, emptyMessage, rightItemTemplate }) {
  return profileFeedTemplate({
    profiles,
    hasMore: false,
    clickAction: "none",
    compact: true,
    rightItemTemplate,
    emptyMessage,
  });
}

class ManageListMembersDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.dataLayer = this.dataLayer ?? null;
    this.list = this.list ?? null;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("manage-list-members-dialog");
    this.state.$query = new Signal.State("");
    this.state.$pendingDids = new SignalSet();
    this.state.$membersLoaded = new Signal.State(false);
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._loadSuggestions();
    this._loadAllMembers();
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

  async _loadSuggestions() {
    try {
      const currentUser = await this.dataLayer.declarative.ensureCurrentUser();
      await this.dataLayer.declarative.ensureProfileFollows(currentUser.did);
    } catch (error) {
      console.warn("Failed to load suggested profiles", error);
    }
  }

  async _loadAllMembers() {
    const listUri = this.list.uri;
    try {
      await this.dataLayer.requests.loadListMembers(listUri, { reload: true });
      for (let i = 1; i < MAX_MEMBER_PAGES; i++) {
        const data = this.dataLayer.dataStore.$listMembers.get(listUri);
        if (!data?.cursor) break;
        await this.dataLayer.requests.loadListMembers(listUri);
      }
    } catch (error) {
      console.warn("Failed to load list members", error);
    } finally {
      this.state.$membersLoaded.set(true);
    }
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

  async _onToggle(profile) {
    if (this.state.$pendingDids.has(profile.did)) return;
    const memberDidToUri = this._memberDidToUri();
    const membershipUri = memberDidToUri.get(profile.did);
    this.state.$pendingDids.add(profile.did);
    try {
      if (membershipUri) {
        await this.dataLayer.mutations.removeProfileFromList(
          profile,
          this.list,
          membershipUri,
        );
      } else {
        await this.dataLayer.mutations.addProfileToList(profile, this.list);
      }
      this.dispatchEvent(new CustomEvent("members-changed"));
    } catch (error) {
      console.error(error);
    } finally {
      this.state.$pendingDids.delete(profile.did);
    }
  }

  _memberDidToUri() {
    const data = this.dataLayer.dataStore.$listMembers.get(this.list.uri);
    const map = new Map();
    if (!data) return map;
    for (const item of data.items) {
      map.set(item.subject.did, item.uri);
    }
    return map;
  }

  render() {
    const query = this.state.$query.get().trim();
    const currentUserDid = this.dataLayer.derived.$currentUser.get()?.did;
    const searchResults =
      this.dataLayer.derived.$chatRecipientSearchResults.get();
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
    const memberDidToUri = this._memberDidToUri();
    const membersLoaded = this.state.$membersLoaded.get();
    const pendingDids = this.state.$pendingDids;
    const rightItemTemplate = (profile) => {
      if (!membersLoaded) return "";
      return toggleButtonTemplate({
        profile,
        isMember: memberDidToUri.has(profile.did),
        isPending: pendingDids.has(profile.did),
        onToggle: (p) => this._onToggle(p),
      });
    };
    render(
      html`
        <dialog
          class="bottom-sheet bottom-sheet-fullscreen search-dialog manage-list-members-dialog"
          data-testid="manage-list-members-dialog"
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
          <div class="search-dialog-content">
            <div class="search-dialog-header">
              <h2 class="search-dialog-title">Add people to list</h2>
              <button
                class="dialog-close-button"
                aria-label="Close"
                data-testid="manage-list-members-close"
                @click=${() => this.close()}
              >
                <app-icon icon="close-line"></app-icon>
              </button>
            </div>
            <div class="search-dialog-input-container">
              <app-icon icon="search-line"></app-icon>
              <input
                type="search"
                class="search-dialog-input"
                data-testid="manage-list-members-search-input"
                placeholder="Search"
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
                      data-testid="manage-list-members-search-clear"
                      aria-label="Clear search"
                      @click=${() => this._onClearSearch()}
                    >
                      <app-icon icon="close-line"></app-icon>
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
                      data-testid="manage-list-members-error"
                    >
                      We're having network issues, try again
                    </div>`;
                  }
                  return profileListTemplate({
                    profiles: searchResults,
                    emptyMessage: "No results",
                    rightItemTemplate,
                  });
                }
                let suggestedProfiles = null;
                if (profileFollowsStatus?.error) {
                  suggestedProfiles = [];
                } else if (profileFollows) {
                  suggestedProfiles = profileFollows;
                }
                if (!suggestedProfiles?.length) {
                  return profileListTemplate({
                    profiles: suggestedProfiles,
                    emptyMessage: "Search for someone to add",
                  });
                }
                return html`
                  <div
                    class="search-dialog-section-header"
                    data-testid="manage-list-members-suggested-header"
                  >
                    Suggested
                  </div>
                  ${profileListTemplate({
                    profiles: suggestedProfiles,
                    rightItemTemplate,
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
    const dialog = this.querySelector(".manage-list-members-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    this.querySelector(".search-dialog-input")?.focus({
      preventScroll: true,
    });
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      scrollContainer: this.querySelector(".search-dialog-results"),
      ignoreTouchTarget: (element) => element.closest("button, input") !== null,
    });
    resetScrollOnBlur(dialog, this.querySelector(".search-dialog-results"));
  }

  close() {
    return closeWithAnimation(
      this.querySelector(".manage-list-members-dialog"),
    );
  }
}

ManageListMembersDialog.register();
