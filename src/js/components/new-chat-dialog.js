import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import "/js/components/app-icon.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { classnames, graphemeCount } from "/js/utils.js";
import { showToast } from "/js/toasts.js";
import { alertModal } from "/js/modals/alert.modal.js";

const MAX_GROUP_NAME_GRAPHEME_LENGTH = 50;

const CREATE_CHAT_ERROR_TOASTS = {
  AccountSuspended: "Suspended accounts cannot participate in chat.",
  BlockedActor: "This user has blocked you and cannot be messaged.",
  MessagesDisabled: "This user has disabled chat and cannot be messaged.",
  NotFollowedBySender: "Chat recipient is not followed by the sender.",
  RecipientNotFound: "Unable to find the selected recipient.",
};

const CREATE_GROUP_ERROR_TOASTS = {
  AccountSuspended: "Suspended accounts cannot participate in a group chat.",
  BlockedActor:
    "One of the selected recipients has blocked you and cannot be messaged.",
  BlockedSubject: "You have blocked one of the selected recipients.",
  NewAccountCannotCreateGroup: "You cannot create a group chat yet.",
  NotFollowedBySender: "You don't follow one of the selected recipients.",
  RecipientNotFound: "Unable to find a selected recipient.",
  UserForbidsGroups:
    "One of the selected recipients does not allow group chats.",
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

function canBeAddedToGroup(profile) {
  const allowGroupInvites = profile.associated?.chat?.allowGroupInvites;
  switch (allowGroupInvites) {
    case "none":
      return false;
    case "all":
      return true;
    case "following":
      return Boolean(profile.viewer?.followedBy);
    case undefined:
      return canBeMessaged(profile);
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

function createGroupErrorToastMessage(error) {
  if (error instanceof TypeError) {
    return "A network error occurred. Please check your internet connection.";
  }
  return (
    CREATE_GROUP_ERROR_TOASTS[error?.data?.error] ??
    "An issue occurred starting the group chat, please try again."
  );
}

function partitionRows(profiles, currentUserDid, canJoin = canBeMessaged) {
  const seenDids = new Set();
  const deduped = [];
  for (const profile of profiles) {
    if (profile.did === currentUserDid) continue;
    if (seenDids.has(profile.did)) continue;
    seenDids.add(profile.did);
    deduped.push(profile);
  }
  return [
    ...deduped.filter((profile) => canJoin(profile)),
    ...deduped.filter((profile) => !canJoin(profile)),
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

function notAddableRightItem() {
  return html`<div
    class="new-chat-not-messageable-hint"
    data-testid="not-addable-hint"
  >
    Can't be added
  </div>`;
}

function memberToggleTemplate({ isSelected }) {
  return html`<div
    class=${classnames("new-group-member-toggle", {
      "is-selected": isSelected,
    })}
    data-testid="new-group-member-toggle"
    data-teststate=${isSelected ? "selected" : "unselected"}
  >
    ${isSelected ? html`<app-icon icon="check"></app-icon>` : ""}
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

function groupMemberListTemplate({
  profiles,
  selectedDids,
  atCap,
  onToggle,
  emptyMessage = null,
}) {
  const disabledDids = (profiles ?? [])
    .filter(
      (profile) =>
        !canBeAddedToGroup(profile) ||
        (atCap && !selectedDids.includes(profile.did)),
    )
    .map((profile) => profile.did);
  return profileFeedTemplate({
    profiles,
    hasMore: false,
    skeletonCount: 6,
    compact: true,
    clickAction: onToggle,
    rightItemTemplate: (actor) =>
      canBeAddedToGroup(actor)
        ? memberToggleTemplate({
            isSelected: selectedDids.includes(actor.did),
          })
        : notAddableRightItem(),
    disabledProfiles: disabledDids,
    emptyMessage,
  });
}

function newGroupEntryTemplate({ canCreateGroups, onClick }) {
  return html`<button
    class=${classnames("new-group-entry-button", {
      "is-disabled": !canCreateGroups,
    })}
    data-testid="new-chat-new-group-button"
    @click=${onClick}
  >
    <app-icon icon="users-line"></app-icon>
    <span class="new-group-entry-label">New group chat</span>
    <app-icon icon="chevron-right-line"></app-icon>
  </button>`;
}

function memberChipsTemplate({ profiles, onRemove }) {
  if (!profiles.length) return "";
  return html`<div class="new-group-chips" data-testid="new-group-chips">
    ${profiles.map(
      (profile) =>
        html`<div
          class="new-group-member-chip"
          data-testid="new-group-member-chip"
        >
          ${avatarTemplate({ author: profile, clickAction: "none" })}
          <span class="new-group-chip-name">${getDisplayName(profile)}</span>
          <button
            class="new-group-chip-remove"
            data-testid="new-group-member-chip-remove"
            aria-label="Remove ${getDisplayName(profile)} from group chat"
            @click=${() => onRemove(profile)}
          >
            <app-icon icon="close-line"></app-icon>
          </button>
        </div>`,
    )}
  </div>`;
}

function dialogHeaderTemplate({ title, onBack = null, action = "" }) {
  return html`<div class="search-dialog-header">
    ${onBack
      ? html`<button
          class="search-dialog-close new-group-back-button"
          aria-label="Back"
          data-testid="new-group-back-button"
          @click=${onBack}
        >
          <app-icon icon="chevron-left-line"></app-icon>
        </button>`
      : ""}
    <h2 class="search-dialog-title">${title}</h2>
    ${action}
  </div>`;
}

function searchInputTemplate({ rawQuery, onInput, onClear }) {
  return html`<div class="search-dialog-input-container">
    <app-icon icon="search-line"></app-icon>
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
      .value=${rawQuery}
      @input=${(event) => onInput(event.target.value)}
    />
    ${rawQuery.length > 0
      ? html`
          <button
            class="search-clear-button"
            data-testid="new-chat-search-clear"
            aria-label="Clear search"
            @click=${onClear}
          >
            <app-icon icon="close-line"></app-icon>
          </button>
        `
      : ""}
  </div>`;
}

function searchErrorTemplate() {
  return html`<div class="search-dialog-message" data-testid="new-chat-error">
    We're having network issues, try again
  </div>`;
}

function chatStepResultsTemplate({
  query,
  currentUserDid,
  results,
  searchStatus,
  profileFollows,
  profileFollowsStatus,
  groupChatsEnabled,
  canCreateGroups,
  onSelect,
  onNewGroupClick,
}) {
  if (query) {
    if (searchStatus?.error) {
      return searchErrorTemplate();
    }
    return profileListTemplate({
      profiles: results ? partitionRows(results, currentUserDid) : null,
      onSelect,
      emptyMessage: "No results",
    });
  }
  const groupEntry = groupChatsEnabled
    ? newGroupEntryTemplate({
        canCreateGroups,
        onClick: onNewGroupClick,
      })
    : "";
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
    return html`${groupEntry}
    ${profileListTemplate({
      profiles: suggestedProfiles,
      emptyMessage: "Search for someone to message",
    })}`;
  }
  return html`
    ${groupEntry}
    <div
      class="search-dialog-section-header"
      data-testid="new-chat-suggested-header"
    >
      Suggested
    </div>
    ${profileListTemplate({
      profiles: suggestedProfiles,
      onSelect,
    })}
  `;
}

function chatStepTemplate({
  rawQuery,
  query,
  currentUserDid,
  results,
  searchStatus,
  profileFollows,
  profileFollowsStatus,
  groupChatsEnabled,
  canCreateGroups,
  onSearchInput,
  onClearSearch,
  onSelect,
  onNewGroupClick,
  onClose,
}) {
  return html`
    ${dialogHeaderTemplate({
      title: "Start a new chat",
      action: html`<button
        class="search-dialog-close"
        aria-label="Close"
        data-testid="new-chat-dialog-close"
        @click=${onClose}
      >
        <app-icon icon="close-line"></app-icon>
      </button>`,
    })}
    ${searchInputTemplate({
      rawQuery,
      onInput: onSearchInput,
      onClear: onClearSearch,
    })}
    <div class="search-dialog-results">
      ${chatStepResultsTemplate({
        query,
        currentUserDid,
        results,
        searchStatus,
        profileFollows,
        profileFollowsStatus,
        groupChatsEnabled,
        canCreateGroups,
        onSelect,
        onNewGroupClick,
      })}
    </div>
  `;
}

function memberSelectStepResultsTemplate({
  query,
  currentUserDid,
  results,
  searchStatus,
  profileFollows,
  profileFollowsStatus,
  selectedDids,
  atCap,
  onToggle,
}) {
  if (query) {
    if (searchStatus?.error) {
      return searchErrorTemplate();
    }
    return groupMemberListTemplate({
      profiles: results
        ? partitionRows(results, currentUserDid, canBeAddedToGroup)
        : null,
      selectedDids,
      atCap,
      onToggle,
      emptyMessage: "No results",
    });
  }
  let suggestedProfiles = null;
  if (profileFollowsStatus?.error) {
    suggestedProfiles = [];
  } else if (profileFollows) {
    suggestedProfiles = partitionRows(
      profileFollows.filter((profile) => canBeAddedToGroup(profile)),
      currentUserDid,
      canBeAddedToGroup,
    );
  }
  if (!suggestedProfiles?.length) {
    return groupMemberListTemplate({
      profiles: suggestedProfiles,
      selectedDids,
      atCap,
      onToggle,
      emptyMessage: "Search for people to add",
    });
  }
  return html`
    <div
      class="search-dialog-section-header"
      data-testid="new-chat-suggested-header"
    >
      Suggested
    </div>
    ${groupMemberListTemplate({
      profiles: suggestedProfiles,
      selectedDids,
      atCap,
      onToggle,
    })}
  `;
}

function memberSelectStepTemplate({
  rawQuery,
  query,
  currentUserDid,
  results,
  searchStatus,
  profileFollows,
  profileFollowsStatus,
  selectedDids,
  selectedProfiles,
  atCap,
  onSearchInput,
  onClearSearch,
  onToggle,
  onRemove,
  onBack,
  onNext,
}) {
  return html`
    ${dialogHeaderTemplate({
      title: "New group chat",
      onBack,
      action:
        selectedDids.length > 0
          ? html`<button
              class="search-dialog-header-action"
              data-testid="new-group-next-button"
              @click=${onNext}
            >
              Next
            </button>`
          : "",
    })}
    ${searchInputTemplate({
      rawQuery,
      onInput: onSearchInput,
      onClear: onClearSearch,
    })}
    ${memberChipsTemplate({ profiles: selectedProfiles, onRemove })}
    <div class="search-dialog-results">
      ${memberSelectStepResultsTemplate({
        query,
        currentUserDid,
        results,
        searchStatus,
        profileFollows,
        profileFollowsStatus,
        selectedDids,
        atCap,
        onToggle,
      })}
    </div>
  `;
}

function groupNameStepTemplate({
  groupName,
  selectedProfiles,
  creating,
  canCreate,
  onBack,
  onNameInput,
  onSubmit,
}) {
  const nameCount = graphemeCount(groupName);
  return html`
    ${dialogHeaderTemplate({
      title: "Group name",
      onBack,
      action: html`<button
        class=${classnames("search-dialog-header-action", {
          saving: creating,
        })}
        data-testid="new-group-create-button"
        .disabled=${!canCreate}
        @click=${onSubmit}
      >
        <span>Create</span>
        ${creating ? html`<div class="loading-spinner"></div>` : ""}
      </button>`,
    })}
    <div class="search-dialog-results">
      <div class="new-group-name-section">
        <input
          type="text"
          class="search-dialog-input new-group-name-input"
          data-testid="new-group-name-input"
          placeholder="Group name"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          .value=${groupName}
          @input=${(event) => onNameInput(event.target.value)}
          @keydown=${(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div
          class=${classnames("form-dialog-char-count", {
            overflow: nameCount > MAX_GROUP_NAME_GRAPHEME_LENGTH,
          })}
        >
          ${nameCount}/${MAX_GROUP_NAME_GRAPHEME_LENGTH}
        </div>
      </div>
      <div
        class="search-dialog-section-header"
        data-testid="new-group-members-header"
      >
        New group chat with:
      </div>
      ${profileFeedTemplate({
        profiles: selectedProfiles,
        hasMore: false,
        compact: true,
        clickAction: "none",
        rightItemTemplate: (actor) =>
          canBeAddedToGroup(actor) ? null : notAddableRightItem(),
      })}
    </div>
  `;
}

class NewChatDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.dataLayer = this.dataLayer ?? null;
    this.groupChatsEnabled = this.groupChatsEnabled ?? true;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("new-chat-dialog");
    this.state.$query = new Signal.State("");
    this.state.$step = new Signal.State(1);
    this._selectedDids = [];
    this._selectedProfiles = new Map();
    this._groupName = "";
    this._creating = false;
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._loadSuggestions();
    this._loadChatActorStatus();
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

  _loadChatActorStatus() {
    this.dataLayer.requests.loadChatActorStatus().catch((error) => {
      console.warn("Failed to load chat actor status", error);
    });
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

  _onNewGroupClick() {
    const status = this.dataLayer.derived.$chatActorStatus.get();
    if (status?.canCreateGroups === false) {
      alertModal(
        "Your account must be at least 7 days old to create a new group chat.",
        { title: "Your account is too new" },
      );
      return;
    }
    this.state.$step.set(2);
  }

  _goBack() {
    const step = this.state.$step.get();
    if (step === 3) {
      this._groupName = "";
      this.state.$step.set(2);
    } else if (step === 2) {
      this._selectedDids = [];
      this._selectedProfiles.clear();
      this._groupName = "";
      this.state.$step.set(1);
      if (this.state.$query.get()) {
        this._onSearchInput("");
      }
    }
  }

  _maxSelectableMembers() {
    const limit =
      this.dataLayer.derived.$chatActorStatus.get()?.groupMemberLimit;
    return limit ? limit - 1 : Infinity;
  }

  _toggleMember(profile) {
    if (this._selectedDids.includes(profile.did)) {
      this._removeMember(profile);
      return;
    }
    if (this._selectedDids.length >= this._maxSelectableMembers()) return;
    this._selectedDids = [...this._selectedDids, profile.did];
    this._selectedProfiles.set(profile.did, profile);
    if (this.state.$query.get()) {
      this._onSearchInput("");
    }
    this.render();
    const chips = this.querySelector(".new-group-chips");
    if (chips) chips.scrollLeft = chips.scrollWidth;
  }

  _removeMember(profile) {
    this._selectedDids = this._selectedDids.filter(
      (did) => did !== profile.did,
    );
    this._selectedProfiles.delete(profile.did);
    this.render();
  }

  _onNext() {
    if (this._selectedDids.length === 0) return;
    this.state.$step.set(3);
  }

  get _canCreate() {
    const name = this._groupName.trim();
    return (
      !this._creating &&
      name.length > 0 &&
      graphemeCount(name) <= MAX_GROUP_NAME_GRAPHEME_LENGTH
    );
  }

  async _onCreateGroup() {
    if (!this._canCreate) return;
    const name = this._groupName.trim();
    this._creating = true;
    this.render();
    try {
      const convo = await this.dataLayer.mutations.createGroupChat(
        name,
        this._selectedDids,
      );
      this._creating = false;
      this.close();
      window.router.go(`/messages/${convo.id}`);
    } catch (error) {
      this._creating = false;
      this.render();
      console.warn("Failed to create group chat", error);
      showToast(createGroupErrorToastMessage(error), { style: "error" });
    }
  }

  _renderStepTemplate(
    step,
    {
      rawQuery,
      query,
      currentUserDid,
      results,
      searchStatus,
      profileFollows,
      profileFollowsStatus,
      canCreateGroups,
      atCap,
      selectedProfiles,
    },
  ) {
    if (step === 1) {
      return chatStepTemplate({
        rawQuery,
        query,
        currentUserDid,
        results,
        searchStatus,
        profileFollows,
        profileFollowsStatus,
        groupChatsEnabled: this.groupChatsEnabled,
        canCreateGroups,
        onSearchInput: (value) => this._onSearchInput(value),
        onClearSearch: () => this._onClearSearch(),
        onSelect: (profile) => this._onSelect(profile),
        onNewGroupClick: () => this._onNewGroupClick(),
        onClose: () => this.close(),
      });
    }
    if (step === 2) {
      return memberSelectStepTemplate({
        rawQuery,
        query,
        currentUserDid,
        results,
        searchStatus,
        profileFollows,
        profileFollowsStatus,
        selectedDids: this._selectedDids,
        selectedProfiles,
        atCap,
        onSearchInput: (value) => this._onSearchInput(value),
        onClearSearch: () => this._onClearSearch(),
        onToggle: (profile) => this._toggleMember(profile),
        onRemove: (profile) => this._removeMember(profile),
        onBack: () => this._goBack(),
        onNext: () => this._onNext(),
      });
    }
    return groupNameStepTemplate({
      groupName: this._groupName,
      selectedProfiles,
      creating: this._creating,
      canCreate: this._canCreate,
      onBack: () => this._goBack(),
      onNameInput: (value) => {
        this._groupName = value;
        this.render();
      },
      onSubmit: () => this._onCreateGroup(),
    });
  }

  render() {
    const step = this.state.$step.get();
    const rawQuery = this.state.$query.get();
    const query = rawQuery.trim();
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
    const chatActorStatus = this.dataLayer.derived.$chatActorStatus.get();
    const canCreateGroups = chatActorStatus?.canCreateGroups ?? true;
    const atCap = this._selectedDids.length >= this._maxSelectableMembers();
    const selectedProfiles = this._selectedDids
      .map((did) => this._selectedProfiles.get(did))
      .filter(Boolean);
    render(
      html`
        <dialog
          class="bottom-sheet bottom-sheet-fullscreen search-dialog new-chat-dialog"
          data-testid="new-chat-dialog"
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
            ${this._renderStepTemplate(step, {
              rawQuery,
              query,
              currentUserDid,
              results,
              searchStatus,
              profileFollows,
              profileFollowsStatus,
              canCreateGroups,
              atCap,
              selectedProfiles,
            })}
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
      onDismiss: () => this.close(),
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
