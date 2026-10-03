import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, SignalMap, ReactiveStore, effect } from "/js/signals.js";
import { classnames, graphemeCount, truncateGraphemes } from "/js/utils.js";
import { cdnImageUrl, getDisplayName } from "/js/dataHelpers.js";
import { profileListTemplate } from "/js/templates/profileList.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { LOGGED_OUT_FEED_URI } from "/js/config.js";
import "/js/components/app-icon.js";

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_PROFILES = 150;
const MAX_FEEDS = 3;
const MIN_PROFILES = 8;
const MAX_SUMMARY_NAME_LENGTH = 28;
const DISCOVER_FEED_URI = LOGGED_OUT_FEED_URI;

function truncateName(name) {
  return truncateGraphemes(name, MAX_SUMMARY_NAME_LENGTH, { suffix: "…" });
}

function joinNames(names, remaining) {
  if (names.length === 1) return `${names[0]} is`;
  if (remaining === 0) return `${names[0]} and ${names[1]} are`;
  return `${names[0]}, ${names[1]}, and ${remaining} ${remaining === 1 ? "other" : "others"} are`;
}

function profilesSummaryText({ profiles, currentUserDid }) {
  if (profiles.length <= 1) {
    return "It's just you right now! Add more people to your starter pack by searching above.";
  }
  const others = profiles.filter((profile) => profile.did !== currentUserDid);
  const names = others
    .slice(0, 2)
    .map((profile) => truncateName(getDisplayName(profile)));
  if (profiles.length === 2) {
    return `You and ${names[0]} are included in your starter pack`;
  }
  return `${joinNames(names, profiles.length - 3)} included in your starter pack`;
}

function feedsSummaryText({ feeds }) {
  const names = feeds.slice(0, 2).map((feed) => truncateName(feed.displayName));
  return `${joinNames(names, Math.max(0, feeds.length - 2))} included in your starter pack`;
}

function canBeAdded(profile) {
  return (
    !profile.associated?.labeler &&
    !profile.viewer?.blocking &&
    !profile.viewer?.blockedBy &&
    !profile.viewer?.blockingByList
  );
}

function wizardHeaderTemplate({ title, onBack, onClose, action }) {
  return html`<div class="search-dialog-header">
    ${onBack
      ? html`<button
          class="starter-pack-wizard-header-button"
          aria-label="Back"
          data-testid="starter-pack-wizard-back"
          @click=${onBack}
        >
          <app-icon icon="chevron-left-line"></app-icon>
        </button>`
      : onClose
        ? html`<button
            class="starter-pack-wizard-header-button"
            aria-label="Close"
            data-testid="starter-pack-wizard-close"
            @click=${onClose}
          >
            <app-icon icon="close-line"></app-icon>
          </button>`
        : html`<span class="starter-pack-wizard-header-spacer"></span>`}
    <h2 class="search-dialog-title">${title}</h2>
    ${action ?? html`<span class="starter-pack-wizard-header-spacer"></span>`}
  </div>`;
}

function searchInputTemplate({
  rawQuery,
  placeholder,
  testId,
  onInput,
  onClear,
}) {
  return html`<div class="search-dialog-input-container">
    <app-icon icon="search-line"></app-icon>
    <input
      type="search"
      class="search-dialog-input"
      data-testid=${testId}
      placeholder=${placeholder}
      maxlength="50"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="none"
      spellcheck="false"
      .value=${rawQuery}
      @input=${(event) => onInput(event.target.value)}
    />
    ${rawQuery.length > 0
      ? html`<button
          class="search-clear-button"
          aria-label="Clear search"
          @click=${onClear}
        >
          <app-icon icon="close-line"></app-icon>
        </button>`
      : ""}
  </div>`;
}

function detailsStepTemplate({
  mode,
  name,
  description,
  namePlaceholder,
  nameTooLong,
  descriptionTooLong,
  onNameInput,
  onDescriptionInput,
  onNext,
  onClose,
}) {
  const nameCount = graphemeCount(name);
  const descriptionCount = graphemeCount(description);
  return {
    header: wizardHeaderTemplate({
      title: mode === "edit" ? "Edit Starter Pack" : "Starter Pack",
      onClose,
    }),
    search: null,
    resultsClass: "starter-pack-wizard-details",
    results: html`
      ${mode === "create"
        ? html`<div class="starter-pack-wizard-hero">
            <h3>Invites, but personal</h3>
            <p>Invite your friends to follow your favorite feeds and people</p>
          </div>`
        : ""}
      <div class="form-dialog-field">
        <label for="starter-pack-name">
          What do you want to call your Starter Pack?
        </label>
        <input
          id="starter-pack-name"
          type="text"
          class="form-dialog-input"
          placeholder=${namePlaceholder}
          .value=${name}
          @input=${(event) => onNameInput(event.target.value)}
          data-testid="starter-pack-name-input"
        />
        <div
          class=${classnames("form-dialog-char-count", {
            overflow: nameTooLong,
          })}
        >
          ${nameCount}/${MAX_NAME_LENGTH}
        </div>
      </div>
      <div class="form-dialog-field">
        <label for="starter-pack-description">Tell us a little more</label>
        <textarea
          id="starter-pack-description"
          class="form-dialog-textarea"
          placeholder="${namePlaceholder} - join me!"
          rows="4"
          .value=${description}
          @input=${(event) => onDescriptionInput(event.target.value)}
          data-testid="starter-pack-description-input"
        ></textarea>
        <div
          class=${classnames("form-dialog-char-count", {
            overflow: descriptionTooLong,
          })}
        >
          ${descriptionCount}/${MAX_DESCRIPTION_LENGTH}
        </div>
      </div>
    `,
    footer: html`<div class="starter-pack-wizard-footer">
      <button
        class="rounded-button rounded-button-primary starter-pack-wizard-next"
        data-testid="starter-pack-wizard-next"
        ?disabled=${nameTooLong || descriptionTooLong}
        @click=${onNext}
      >
        Next
      </button>
    </div>`,
  };
}

function toggleButtonTemplate({ testId, toggleState, onToggle }) {
  const isIncluded = toggleState === "included" || toggleState === "locked";
  const isDisabled =
    toggleState !== "included" && toggleState !== "not-included";
  let label;
  if (toggleState === "opted-out") label = "Opted out";
  else if (isIncluded) label = "Added";
  else label = "Add";
  return html`<button
    class=${classnames(
      "rounded-button starter-pack-wizard-toggle",
      isIncluded ? "rounded-button-secondary" : "rounded-button-primary",
    )}
    data-testid=${testId}
    data-teststate=${toggleState}
    ?disabled=${isDisabled}
    @click=${onToggle}
  >
    ${label}
  </button>`;
}

function profileToggleTemplate({ profile, toggleState, onToggle }) {
  return toggleButtonTemplate({
    testId: "starter-pack-profile-toggle",
    toggleState,
    onToggle: () => onToggle(profile),
  });
}

function profileRowsTemplate({
  profiles,
  emptyMessage,
  rightItemTemplate,
  disabledProfiles = null,
}) {
  return profileListTemplate({
    profiles,
    hasMore: false,
    clickAction: "none",
    compact: true,
    rightItemTemplate,
    emptyMessage,
    disabledProfiles,
  });
}

function wizardFooterTemplate({
  count,
  max,
  showCount,
  avatars,
  overlapAvatars,
  summary,
  hint,
  buttonLabel,
  buttonDisabled,
  saving,
  onNext,
}) {
  return html`<div
    class="starter-pack-wizard-footer"
    data-testid="starter-pack-wizard-footer"
  >
    ${showCount
      ? html`<div
          class="starter-pack-wizard-count"
          data-testid="starter-pack-wizard-count"
        >
          ${count}/${max}
        </div>`
      : ""}
    <div class="starter-pack-wizard-footer-row">
      <div
        class=${classnames("starter-pack-wizard-avatars", {
          "is-overlapping": overlapAvatars,
        })}
      >
        ${avatars}
      </div>
      <div class="starter-pack-wizard-summary">
        ${summary}
        ${hint
          ? html`<div
              class="starter-pack-wizard-hint"
              data-testid="starter-pack-wizard-hint"
            >
              ${hint}
            </div>`
          : ""}
      </div>
    </div>
    <button
      class=${classnames(
        "rounded-button rounded-button-primary starter-pack-wizard-next",
        { saving },
      )}
      data-testid="starter-pack-wizard-next"
      ?disabled=${buttonDisabled}
      @click=${onNext}
    >
      <span>${buttonLabel}</span>
      ${saving ? html`<div class="loading-spinner"></div>` : ""}
    </button>
  </div>`;
}

function profilesStepTemplate({
  rawQuery,
  query,
  currentUserDid,
  searchResults,
  searchError,
  suggestedProfiles,
  profiles,
  optedOutDids,
  atCap,
  saving,
  onSearchInput,
  onClearSearch,
  onToggle,
  onBack,
  onOpenReview,
  onNext,
}) {
  const includedDids = new Set(profiles.map((profile) => profile.did));
  const rightItemTemplate = (profile) => {
    let toggleState;
    if (profile.did === currentUserDid) toggleState = "locked";
    else if (optedOutDids.has(profile.did)) toggleState = "opted-out";
    else if (includedDids.has(profile.did)) toggleState = "included";
    else toggleState = "not-included";
    return profileToggleTemplate({ profile, toggleState, onToggle });
  };
  const disabledProfiles = atCap
    ? (query ? searchResults : suggestedProfiles)
        ?.filter((profile) => !includedDids.has(profile.did))
        .map((profile) => profile.did)
    : null;
  let results;
  if (query) {
    results = searchError
      ? html`<div class="search-dialog-message">
          We're having network issues, try again
        </div>`
      : profileRowsTemplate({
          profiles: searchResults,
          emptyMessage: "Nobody was found. Try searching for someone else.",
          rightItemTemplate,
          disabledProfiles,
        });
  } else if (suggestedProfiles?.length) {
    results = html`<div class="search-dialog-section-header">Suggested</div>
      ${profileRowsTemplate({
        profiles: suggestedProfiles,
        rightItemTemplate,
        disabledProfiles,
      })}`;
  } else {
    results = profileRowsTemplate({
      profiles: suggestedProfiles,
      emptyMessage: "Search for people to add",
      rightItemTemplate,
    });
  }
  const missing = MIN_PROFILES - profiles.length;
  return {
    header: wizardHeaderTemplate({
      title: "Choose People",
      onBack,
      action:
        profiles.length > 1
          ? html`<button
              class="search-dialog-header-action"
              data-testid="starter-pack-wizard-edit-selection"
              @click=${onOpenReview}
            >
              Edit
            </button>`
          : null,
    }),
    search: searchInputTemplate({
      rawQuery,
      placeholder: "Search for people",
      testId: "starter-pack-profile-search",
      onInput: onSearchInput,
      onClear: onClearSearch,
    }),
    resultsClass: null,
    results,
    footer: wizardFooterTemplate({
      count: profiles.length,
      max: MAX_PROFILES,
      showCount: profiles.length > MIN_PROFILES,
      avatars: profiles.slice(0, 6).map(
        (profile) =>
          html`<div class="starter-pack-wizard-avatar">
            ${avatarTemplate({
              author: profile,
              clickAction: "none",
              showLiveBadge: false,
            })}
          </div>`,
      ),
      overlapAvatars: true,
      summary: profilesSummaryText({ profiles, currentUserDid }),
      hint:
        missing > 0
          ? `Add ${missing} more ${missing === 1 ? "person" : "people"} to continue`
          : null,
      buttonLabel: "Next",
      buttonDisabled: missing > 0 || saving,
      saving: false,
      onNext,
    }),
  };
}

function feedRowTemplate({ feed, currentUserDid, toggleState, onToggle }) {
  return html`<div
    class="feeds-list-item starter-pack-wizard-feed-row"
    data-testid="starter-pack-feed-row"
  >
    <div class="feeds-list-item-avatar">
      <img
        src=${feed.avatar
          ? cdnImageUrl(feed.avatar)
          : "/img/feed-avatar-fallback.svg"}
        alt=${feed.displayName}
        class="feed-avatar"
      />
    </div>
    <div class="feeds-list-item-content">
      <div class="feeds-list-item-title">${feed.displayName}</div>
      ${feed.creator
        ? html`<div class="feeds-list-item-creator">
            Feed by
            ${feed.creator.did === currentUserDid
              ? "you"
              : `@${feed.creator.handle}`}
          </div>`
        : ""}
    </div>
    ${toggleButtonTemplate({
      testId: "starter-pack-feed-toggle",
      toggleState,
      onToggle: () => onToggle(feed),
    })}
  </div>`;
}

function feedsStepTemplate({
  rawQuery,
  query,
  currentUserDid,
  searchResults,
  searchError,
  suggestedFeeds,
  feeds,
  saving,
  onSearchInput,
  onClearSearch,
  onToggle,
  onBack,
  onOpenReview,
  onNext,
}) {
  const includedUris = new Set(feeds.map((feed) => feed.uri));
  const atCap = feeds.length >= MAX_FEEDS;
  const rowsTemplate = (list) =>
    list.map((feed) => {
      let toggleState;
      if (feed.uri === DISCOVER_FEED_URI) toggleState = "locked";
      else if (includedUris.has(feed.uri)) toggleState = "included";
      else if (atCap) toggleState = "capped";
      else toggleState = "not-included";
      return feedRowTemplate({ feed, currentUserDid, toggleState, onToggle });
    });
  let results;
  if (query) {
    if (searchError) {
      results = html`<div class="search-dialog-message">
        We're having network issues, try again
      </div>`;
    } else if (!searchResults) {
      results = html`<div class="feed-loading-indicator">
        <div class="loading-spinner"></div>
      </div>`;
    } else if (searchResults.length === 0) {
      results = html`<div class="feed-end-message" data-testid="empty-state">
        No feeds found. Try searching for something else.
      </div>`;
    } else {
      results = html`<div class="feeds-list">
        ${rowsTemplate(searchResults)}
      </div>`;
    }
  } else if (!suggestedFeeds) {
    results = html`<div class="feed-loading-indicator">
      <div class="loading-spinner"></div>
    </div>`;
  } else {
    results = html`<div class="feeds-list">
      ${rowsTemplate(suggestedFeeds)}
    </div>`;
  }
  const summary =
    feeds.length === 0
      ? html`<strong>Add some feeds to your Starter Pack!</strong>
          <div>Search for feeds that you want to suggest to others.</div>`
      : feedsSummaryText({ feeds });
  return {
    header: wizardHeaderTemplate({
      title: "Choose Feeds",
      onBack,
      action:
        feeds.length > 0
          ? html`<button
              class="search-dialog-header-action"
              data-testid="starter-pack-wizard-edit-selection"
              @click=${onOpenReview}
            >
              Edit
            </button>`
          : null,
    }),
    search: searchInputTemplate({
      rawQuery,
      placeholder: "Search for feeds",
      testId: "starter-pack-feed-search",
      onInput: onSearchInput,
      onClear: onClearSearch,
    }),
    resultsClass: null,
    results,
    footer: wizardFooterTemplate({
      count: feeds.length,
      max: MAX_FEEDS,
      showCount: feeds.length > 0,
      avatars: feeds.map(
        (feed) =>
          html`<div class="starter-pack-wizard-avatar">
            <img
              class="feed-avatar"
              src=${feed.avatar
                ? cdnImageUrl(feed.avatar)
                : "/img/feed-avatar-fallback.svg"}
              alt=${feed.displayName}
            />
          </div>`,
      ),
      overlapAvatars: false,
      summary,
      hint: null,
      buttonLabel: feeds.length === 0 ? "Skip" : "Finish",
      buttonDisabled: saving,
      saving,
      onNext,
    }),
  };
}

function reviewTemplate({
  step,
  currentUserDid,
  profiles,
  feeds,
  onRemoveProfile,
  onRemoveFeed,
  onClose,
}) {
  const isProfiles = step === "profiles";
  const removeButton = ({ onClick, label }) =>
    html`<button
      class="rounded-button rounded-button-secondary starter-pack-review-remove"
      data-testid="starter-pack-review-remove"
      aria-label=${label}
      @click=${onClick}
    >
      Remove
    </button>`;
  return {
    header: wizardHeaderTemplate({
      title: isProfiles ? "Edit People" : "Edit Feeds",
      action: html`<button
        class="starter-pack-wizard-header-button"
        aria-label="Done"
        data-testid="starter-pack-wizard-review-close"
        @click=${onClose}
      >
        <app-icon icon="close-line"></app-icon>
      </button>`,
    }),
    search: null,
    resultsClass: null,
    results: html`<div data-testid="starter-pack-wizard-review">
      ${isProfiles
        ? profileRowsTemplate({
            profiles,
            rightItemTemplate: (profile) =>
              profile.did === currentUserDid
                ? null
                : removeButton({
                    onClick: () => onRemoveProfile(profile),
                    label: `Remove ${getDisplayName(profile)}`,
                  }),
          })
        : html`<div class="feeds-list">
            ${feeds.map(
              (feed) =>
                html`<div
                  class="feeds-list-item starter-pack-wizard-feed-row"
                  data-testid="starter-pack-feed-row"
                >
                  <div class="feeds-list-item-avatar">
                    <img
                      src=${feed.avatar
                        ? cdnImageUrl(feed.avatar)
                        : "/img/feed-avatar-fallback.svg"}
                      alt=${feed.displayName}
                      class="feed-avatar"
                    />
                  </div>
                  <div class="feeds-list-item-content">
                    <div class="feeds-list-item-title">${feed.displayName}</div>
                  </div>
                  ${removeButton({
                    onClick: () => onRemoveFeed(feed),
                    label: `Remove ${feed.displayName}`,
                  })}
                </div>`,
            )}
          </div>`}
    </div>`,
    footer: null,
  };
}

class StarterPackWizardDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.dataLayer = this.dataLayer ?? null;
    this.starterPack = this.starterPack ?? null;
    this.members = this.members ?? [];
    this.optedOutDids = this.optedOutDids ?? [];
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._mode = this.starterPack ? "edit" : "create";
    this._isOpen = false;
    this._feedSuggestionsRequested = false;
    this.state = new ReactiveStore("starter-pack-wizard-dialog");
    this.state.$step = new Signal.State("details");
    this.state.$name = new Signal.State("");
    this.state.$description = new Signal.State("");
    this.state.$profiles = new SignalMap();
    this.state.$feeds = new SignalMap();
    this.state.$profileQuery = new Signal.State("");
    this.state.$feedQuery = new Signal.State("");
    this.state.$saving = new Signal.State(false);
    this.state.$reviewOpen = new Signal.State(false);
    this._seedState();
    this._originalSnapshot = this._snapshot();
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._loadProfileSuggestions();
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  _seedState() {
    const currentUser = this.dataLayer.derived.$currentUser.get();
    if (currentUser) {
      this.state.$profiles.set(currentUser.did, currentUser);
    }
    if (this._mode !== "edit") return;
    const { record } = this.starterPack;
    this.state.$name.set(record.name ?? "");
    this.state.$description.set(record.description ?? "");
    const optedOut = new Set(this.optedOutDids);
    for (const profile of this.members) {
      if (optedOut.has(profile.did)) continue;
      if (this.state.$profiles.has(profile.did)) continue;
      this.state.$profiles.set(profile.did, profile);
    }
    for (const feed of this.starterPack.feeds ?? []) {
      if (feed.uri === DISCOVER_FEED_URI) continue;
      if (this.state.$feeds.size >= MAX_FEEDS) break;
      this.state.$feeds.set(feed.uri, feed);
    }
  }

  _snapshot() {
    return JSON.stringify({
      name: this.state.$name.get(),
      description: this.state.$description.get(),
      profiles: [...this.state.$profiles.keys()],
      feeds: [...this.state.$feeds.keys()],
    });
  }

  get _isDirty() {
    return this._snapshot() !== this._originalSnapshot;
  }

  async _loadProfileSuggestions() {
    try {
      const currentUser = await this.dataLayer.declarative.ensureCurrentUser();
      await this.dataLayer.declarative.ensureProfileFollows(currentUser.did);
    } catch (error) {
      console.warn("Failed to load suggested profiles", error);
    }
  }

  _loadFeedSuggestions() {
    if (this._feedSuggestionsRequested) return;
    this._feedSuggestionsRequested = true;
    this.dataLayer.declarative.ensurePinnedItems().catch((error) => {
      console.warn("Failed to load pinned feeds", error);
    });
    this.dataLayer.requests.loadPopularFeeds().catch((error) => {
      console.warn("Failed to load popular feeds", error);
    });
  }

  _onProfileSearchInput(value) {
    this.state.$profileQuery.set(value);
    const query = value.trim();
    if (!query) {
      this.dataLayer.requests.loadChatRecipientSearch("");
    } else {
      this.dataLayer.requests.loadChatRecipientSearch(query, { limit: 12 });
    }
    this._resetResultsScroll();
  }

  _onFeedSearchInput(value) {
    this.state.$feedQuery.set(value);
    this.dataLayer.requests.loadFeedSearch(value.trim()).catch((error) => {
      console.warn("Failed to search feeds", error);
    });
    this._resetResultsScroll();
  }

  _resetResultsScroll() {
    const results = this.querySelector(".search-dialog-results");
    if (results) results.scrollTop = 0;
  }

  _toggleProfile(profile) {
    const currentUser = this.dataLayer.derived.$currentUser.get();
    if (profile.did === currentUser?.did) return;
    if (this.state.$profiles.has(profile.did)) {
      this.state.$profiles.delete(profile.did);
      return;
    }
    if (this.state.$profiles.size >= MAX_PROFILES) {
      showToast(`You may only add up to ${MAX_PROFILES} profiles`, {
        style: "error",
      });
      return;
    }
    this.state.$profiles.set(profile.did, profile);
  }

  _toggleFeed(feed) {
    if (feed.uri === DISCOVER_FEED_URI) return;
    if (this.state.$feeds.has(feed.uri)) {
      this.state.$feeds.delete(feed.uri);
      return;
    }
    if (this.state.$feeds.size >= MAX_FEEDS) {
      showToast(`You may only add up to ${MAX_FEEDS} feeds`, {
        style: "error",
      });
      return;
    }
    this.state.$feeds.set(feed.uri, feed);
  }

  _setStep(step) {
    if (this.state.$profileQuery.get()) this._onProfileSearchInput("");
    if (this.state.$feedQuery.get()) this._onFeedSearchInput("");
    this.state.$reviewOpen.set(false);
    this.state.$step.set(step);
    if (step === "feeds") this._loadFeedSuggestions();
  }

  _next() {
    const step = this.state.$step.get();
    if (step === "details") {
      if (
        graphemeCount(this.state.$name.get()) > MAX_NAME_LENGTH ||
        graphemeCount(this.state.$description.get()) > MAX_DESCRIPTION_LENGTH
      ) {
        return;
      }
      this._setStep("profiles");
    } else if (step === "profiles") {
      if (this.state.$profiles.size < MIN_PROFILES) return;
      this._setStep("feeds");
    } else {
      this._submit();
    }
  }

  _back() {
    const step = this.state.$step.get();
    if (step === "feeds") this._setStep("profiles");
    else if (step === "profiles") this._setStep("details");
  }

  _submit() {
    if (this.state.$saving.get()) return;
    this.state.$saving.set(true);
    const data = {
      name: this.state.$name.get(),
      description: this.state.$description.get(),
      profiles: [...this.state.$profiles.values()],
      feeds: [...this.state.$feeds.values()],
    };
    const successCallback = () => {
      this._originalSnapshot = this._snapshot();
      this.state.$saving.set(false);
      this.close();
    };
    const errorCallback = (error) => {
      console.error("Failed to save starter pack:", error);
      showToast(
        this._mode === "edit"
          ? "Failed to save Starter Pack"
          : "Failed to create Starter Pack",
        { style: "error" },
      );
      this.state.$saving.set(false);
    };
    this.dispatchEvent(
      new CustomEvent(
        this._mode === "edit" ? "starter-pack-update" : "starter-pack-create",
        { detail: { data, successCallback, errorCallback } },
      ),
    );
  }

  render() {
    const step = this.state.$step.get();
    const rawProfileQuery = this.state.$profileQuery.get();
    const rawFeedQuery = this.state.$feedQuery.get();
    const name = this.state.$name.get();
    const description = this.state.$description.get();
    const profiles = [...this.state.$profiles.values()];
    const feeds = [...this.state.$feeds.values()];
    const saving = this.state.$saving.get();
    const reviewOpen = this.state.$reviewOpen.get();
    const currentUser = this.dataLayer.derived.$currentUser.get();
    const currentUserDid = currentUser?.did ?? null;
    const optedOutDids = new Set(this.optedOutDids);

    const profileSearchResults =
      this.dataLayer.derived.$chatRecipientSearchResults.get();
    const profileSearchStatus =
      this.dataLayer.requests.statusStore.$statuses.get(
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
    const feedSearchResults = this.dataLayer.derived.$feedSearchResults.get();
    const feedSearchStatus =
      this.dataLayer.requests.statusStore.$statuses.get("loadFeedSearch");
    const pinnedItems = this.dataLayer.derived.$hydratedPinnedItems.get();
    const popularFeeds = this.dataLayer.derived.$popularFeeds.get();
    const popularFeedsStatus =
      this.dataLayer.requests.statusStore.$statuses.get("loadPopularFeeds");

    let suggestedProfiles = null;
    if (profileFollowsStatus?.error) {
      suggestedProfiles = [];
    } else if (profileFollows) {
      suggestedProfiles = profileFollows.filter(canBeAdded);
    }

    let suggestedFeeds = null;
    if (pinnedItems || popularFeeds || popularFeedsStatus?.error) {
      const seen = new Set([DISCOVER_FEED_URI]);
      suggestedFeeds = [];
      for (const item of pinnedItems ?? []) {
        if (item.type !== "feed" || seen.has(item.uri)) continue;
        seen.add(item.uri);
        suggestedFeeds.push(item.data);
      }
      for (const feed of popularFeeds ?? []) {
        if (seen.has(feed.uri)) continue;
        seen.add(feed.uri);
        suggestedFeeds.push(feed);
      }
    }

    const namePlaceholder = `${currentUser ? getDisplayName(currentUser) : "My"}'s Starter Pack`;

    let content;
    if (reviewOpen) {
      content = reviewTemplate({
        step,
        currentUserDid,
        profiles,
        feeds,
        onRemoveProfile: (profile) => this._toggleProfile(profile),
        onRemoveFeed: (feed) => this._toggleFeed(feed),
        onClose: () => this.state.$reviewOpen.set(false),
      });
    } else if (step === "details") {
      content = detailsStepTemplate({
        mode: this._mode,
        name,
        description,
        namePlaceholder,
        nameTooLong: graphemeCount(name) > MAX_NAME_LENGTH,
        descriptionTooLong: graphemeCount(description) > MAX_DESCRIPTION_LENGTH,
        onNameInput: (value) => this.state.$name.set(value),
        onDescriptionInput: (value) => this.state.$description.set(value),
        onNext: () => this._next(),
        onClose: async () => {
          if (await this.confirmClose()) this.close();
        },
      });
    } else if (step === "profiles") {
      content = profilesStepTemplate({
        rawQuery: rawProfileQuery,
        query: rawProfileQuery.trim(),
        currentUserDid,
        searchResults: profileSearchResults
          ? profileSearchResults.filter(canBeAdded)
          : null,
        searchError: !!profileSearchStatus?.error,
        suggestedProfiles,
        profiles,
        optedOutDids,
        atCap: profiles.length >= MAX_PROFILES,
        saving,
        onSearchInput: (value) => this._onProfileSearchInput(value),
        onClearSearch: () => this._onProfileSearchInput(""),
        onToggle: (profile) => this._toggleProfile(profile),
        onBack: () => this._back(),
        onOpenReview: () => this.state.$reviewOpen.set(true),
        onNext: () => this._next(),
      });
    } else {
      content = feedsStepTemplate({
        rawQuery: rawFeedQuery,
        query: rawFeedQuery.trim(),
        currentUserDid,
        searchResults: feedSearchResults,
        searchError: !!feedSearchStatus?.error,
        suggestedFeeds,
        feeds,
        saving,
        onSearchInput: (value) => this._onFeedSearchInput(value),
        onClearSearch: () => this._onFeedSearchInput(""),
        onToggle: (feed) => this._toggleFeed(feed),
        onBack: () => this._back(),
        onOpenReview: () => this.state.$reviewOpen.set(true),
        onNext: () => this._next(),
      });
    }

    render(
      html`<dialog
        autofocus
        class="bottom-sheet bottom-sheet-fullscreen no-handle search-dialog starter-pack-wizard-dialog"
        data-testid="starter-pack-wizard"
        data-teststate=${reviewOpen ? "review" : step}
        @click=${async (event) => {
          if (event.target !== event.currentTarget) return;
          if (await this.confirmClose()) this.close();
        }}
        @cancel=${async (event) => {
          event.preventDefault();
          if (await this.confirmClose()) this.close();
        }}
        @close=${() => {
          this.scrollLock?.release();
          this.scrollLock = null;
          this.dispatchEvent(new CustomEvent("dialog-closed"));
        }}
      >
        <div class="search-dialog-content">
          ${content.header} ${content.search}
          <div
            class=${classnames("search-dialog-results", content.resultsClass)}
          >
            ${content.results}
          </div>
          ${content.footer}
        </div>
      </dialog>`,
      this,
    );

    if (this._isOpen) {
      const dialog = this.querySelector(".starter-pack-wizard-dialog");
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    }
  }

  open() {
    this._isOpen = true;
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".starter-pack-wizard-dialog");
    if (!dialog || dialog.open) return;
    dialog.showModal();
    this.querySelector("#starter-pack-name")?.focus({ preventScroll: true });
    enableDragToDismiss(dialog, {
      confirmDismiss: () => this.confirmClose(),
      onDismiss: () => this.close(),
      scrollContainer: () => this.querySelector(".search-dialog-results"),
      dragHandle: () => this.querySelector(".search-dialog-header"),
      ignoreTouchTarget: (element) =>
        element.closest("button, input, textarea") !== null,
      disableWhenKeyboardOpen: true,
    });
    resetScrollOnBlur(dialog, () =>
      this.querySelector(".search-dialog-results"),
    );
  }

  async confirmClose() {
    if (this.state.$saving.get()) return false;
    if (!this._isDirty) return true;
    return confirmModal(
      this._mode === "edit"
        ? "Are you sure you want to discard your changes?"
        : "Are you sure you want to discard this starter pack?",
      {
        title:
          this._mode === "edit" ? "Discard changes?" : "Discard starter pack?",
        confirmButtonStyle: "danger",
        confirmButtonText: "Discard",
      },
    );
  }

  close() {
    this._isOpen = false;
    return closeWithAnimation(
      this.querySelector(".starter-pack-wizard-dialog"),
    );
  }
}

StarterPackWizardDialog.register();
