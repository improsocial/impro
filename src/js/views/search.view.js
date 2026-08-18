import { html, keyed, render } from "/js/lib/lit-html.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { classnames } from "/js/utils.js";
import {
  cdnImageUrl,
  getDisplayName,
  MISSING_HANDLE,
} from "/js/dataHelpers.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import {
  linkToFeed,
  linkToProfile,
  linkToProfileByDid,
} from "/js/navigation.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { bindToPage, pageEffect, bindPageTitle } from "/js/router.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import "/js/components/container-link.js";
import "/js/components/tab-bar.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";

export default async function searchView({
  root,
  layout,
  context: { dataLayer, isAuthenticated, pluginService, interactionHandlers },
}) {
  function getUrlQuery() {
    return (new URLSearchParams(window.location.search).get("q") ?? "").trim();
  }

  const initialQuery = getUrlQuery();
  const state = new ReactiveStore("searchView");
  state.$activeTab = new Signal.State("top");
  state.$inputValue = new Signal.State(initialQuery);
  state.$committedQuery = new Signal.State(initialQuery);
  state.$showTypeahead = new Signal.State(false);
  state.$recentProfilesLoading = new Signal.State(true);

  const tabScrollState = new Map();
  const loadedTabs = new Set();

  const TAB_LOADERS = {
    profiles: (query) =>
      dataLayer.requests.loadProfileSearch(query, { limit: 25 }),
    top: (query) => dataLayer.requests.loadPostSearchTop(query, { limit: 25 }),
    latest: (query) =>
      dataLayer.requests.loadPostSearchLatest(query, { limit: 25 }),
    feeds: (query) => dataLayer.requests.loadFeedSearch(query, { limit: 15 }),
  };

  const TAB_STATUS_PREFIXES = {
    profiles: "loadProfileSearch-",
    top: "loadPostSearchTop-",
    latest: "loadPostSearchLatest-",
    feeds: "loadFeedSearch-",
  };

  function loadTabIfNeeded(tab) {
    const query = state.$committedQuery.get();
    if (!query) return;
    if (!isAuthenticated) {
      tab = "profiles";
    }
    if (loadedTabs.has(tab)) return;
    loadedTabs.add(tab);
    TAB_LOADERS[tab](query)
      .then(() => {
        if (
          dataLayer.requests.statusStore.getError(
            TAB_STATUS_PREFIXES[tab] + query,
          )
        ) {
          loadedTabs.delete(tab);
        }
      })
      .catch((error) => {
        loadedTabs.delete(tab);
        console.error("Failed to load search results", error);
      });
  }

  function loadTypeahead(query) {
    dataLayer.requests
      .loadSearchTypeahead(query, { limit: 8 })
      .catch((error) => console.warn("Typeahead search failed", error));
  }

  function resetSearchState() {
    state.$inputValue.set("");
    state.$showTypeahead.set(false);
    state.$committedQuery.set("");
    loadedTabs.clear();
    tabScrollState.clear();
    const url = new URL(window.location);
    url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
    dataLayer.requests.loadSearchTypeahead("");
    dataLayer.requests.loadProfileSearch("");
    if (isAuthenticated) {
      dataLayer.requests.loadPostSearchTop("");
      dataLayer.requests.loadPostSearchLatest("");
      dataLayer.requests.loadFeedSearch("");
    }
  }

  function handleInput(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      resetSearchState();
      state.$inputValue.set(value);
      return;
    }
    state.$inputValue.set(value);
    state.$showTypeahead.set(true);
    loadTypeahead(trimmed);
  }

  function commitSearch() {
    const query = state.$inputValue.get().trim();
    if (!query) return;
    if (isAuthenticated) {
      dataLayer.mutations.addRecentSearch(query).catch(console.warn);
    }
    state.$showTypeahead.set(false);
    const queryChanged = query !== state.$committedQuery.get();
    state.$committedQuery.set(query);
    const url = new URL(window.location);
    url.searchParams.set("q", query);
    window.history.replaceState({}, "", url);
    if (queryChanged) {
      loadedTabs.clear();
      tabScrollState.clear();
    }
    loadTabIfNeeded(state.$activeTab.get());
    root.querySelector(".search-input")?.blur();
  }

  function handleClearSearch() {
    resetSearchState();
    root.querySelector(".search-input")?.focus();
  }

  function handleRecentSearchSelect(q) {
    state.$inputValue.set(q);
    state.$showTypeahead.set(false);
    commitSearch();
  }

  function handleRecentSearchRemove(q) {
    dataLayer.mutations.removeRecentSearch(q).catch(console.warn);
  }

  function handleRecentProfileRecord(did) {
    if (!isAuthenticated) return;
    dataLayer.mutations.addRecentSearchProfile(did).catch(console.warn);
  }

  function handleRecentProfileRemove(did) {
    dataLayer.mutations.removeRecentSearchProfile(did).catch(console.warn);
  }

  function isRecentProfileVisible(profile) {
    if (!profile) return false;
    if (profile.viewer?.blocking || profile.viewer?.blockedBy) return false;
    if (profile.handle === MISSING_HANDLE) return false;
    if ((profile.labels ?? []).some((label) => label.val === "!takendown")) {
      return false;
    }
    return true;
  }

  async function hydrateAndPruneRecentProfiles() {
    try {
      if (!isAuthenticated) return;
      const entries = dataLayer.derived.$recentSearchProfiles.get() ?? [];
      if (entries.length === 0) return;
      const dids = entries.map((entry) => entry.did);
      try {
        await dataLayer.declarative.ensureProfiles(dids);
      } catch (error) {
        console.warn("Failed to load recent search profiles", error);
        return;
      }
      const hydrated = dataLayer.derived.$recentSearchProfiles.get() ?? [];
      const fetchedDids = new Set(dids);
      const prunedDids = hydrated
        .filter(
          (entry) =>
            fetchedDids.has(entry.did) &&
            !isRecentProfileVisible(entry.profile),
        )
        .map((entry) => entry.did);
      if (prunedDids.length > 0) {
        dataLayer.mutations
          .removeRecentSearchProfiles(prunedDids)
          .catch(console.warn);
      }
    } finally {
      state.$recentProfilesLoading.set(false);
    }
  }

  function loadPageData() {
    const query = new URLSearchParams(window.location.search);
    if (query.get("tab")) {
      const tab = query.get("tab");
      state.$activeTab.set(tab === "posts" ? "top" : tab);
    }
    const q = getUrlQuery();
    if (q) {
      state.$inputValue.set(q);
      state.$showTypeahead.set(false);
      state.$committedQuery.set(q);
      loadedTabs.clear();
      tabScrollState.clear();
      loadTabIfNeeded(state.$activeTab.get());
    }
    hydrateAndPruneRecentProfiles();
  }

  function handleTabChange(tab) {
    if (tab === state.$activeTab.get()) {
      if (window.scrollY > 0) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
      return;
    }
    tabScrollState.set(state.$activeTab.get(), window.scrollY);
    state.$activeTab.set(tab);
    loadTabIfNeeded(tab);
    requestAnimationFrame(() => {
      window.scrollTo(0, tabScrollState.get(tab) ?? 0);
    });
  }

  async function loadMoreProfiles() {
    const cursor = dataLayer.derived.$profileSearchCursor.get();
    if (!cursor) return;
    await dataLayer.requests.loadProfileSearch(state.$committedQuery.get(), {
      limit: 25,
      cursor,
    });
  }

  async function loadMoreTopPosts() {
    const cursor = dataLayer.derived.$postSearchCursorTop.get();
    if (!cursor) return;
    await dataLayer.requests.loadPostSearchTop(state.$committedQuery.get(), {
      limit: 25,
      cursor,
    });
  }

  async function loadMoreLatestPosts() {
    const cursor = dataLayer.derived.$postSearchCursorLatest.get();
    if (!cursor) return;
    await dataLayer.requests.loadPostSearchLatest(state.$committedQuery.get(), {
      limit: 25,
      cursor,
    });
  }

  async function loadMoreFeeds() {
    const cursor = dataLayer.derived.$feedSearchCursor.get();
    if (!cursor) return;
    await dataLayer.requests.loadFeedSearch(state.$committedQuery.get(), {
      limit: 15,
      cursor,
    });
  }

  const {
    postInteractionHandler,
    feedInteractionHandler,
    profileInteractionHandler,
  } = interactionHandlers;

  function typeaheadTemplate({ query, profiles, onCommit }) {
    return html`<div class="search-typeahead">
      <button
        class="search-typeahead-row search-typeahead-search-row"
        data-testid="search-typeahead-search-row"
        @click=${() => onCommit()}
      >
        <div class="search-typeahead-icon">${searchIconTemplate()}</div>
        <div class="search-typeahead-text">${query}</div>
      </button>
      ${profiles === null
        ? html`<div class="search-typeahead-loading">
            <div class="loading-spinner"></div>
          </div>`
        : profiles.map(
            (profile) => html`
              <container-link
                class="search-typeahead-row clickable"
                data-testid="search-typeahead-result"
                href=${linkToProfile(profile)}
                @click=${() => handleRecentProfileRecord(profile.did)}
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

  function recentSearchRowTemplate(q) {
    return html`<div class="search-recent-row" data-testid="search-recent-row">
      <button
        type="button"
        class="search-typeahead-row search-recent-row-button"
        data-testid="search-recent-row-button"
        @click=${() => handleRecentSearchSelect(q)}
      >
        <div class="search-typeahead-icon">${searchIconTemplate()}</div>
        <div class="search-typeahead-text">${q}</div>
      </button>
      <button
        type="button"
        class="icon-button search-recent-remove-button"
        data-testid="search-recent-remove-button"
        aria-label="Remove ${q}"
        @mousedown=${(event) => event.preventDefault()}
        @click=${(event) => {
          event.stopPropagation();
          handleRecentSearchRemove(q);
        }}
      >
        ${closeIconTemplate()}
      </button>
    </div>`;
  }

  function recentProfileTileTemplate(profile) {
    return html`<container-link
      class="search-recent-profile clickable"
      data-testid="search-recent-profile"
      href=${linkToProfileByDid(profile.did)}
      @click=${() => handleRecentProfileRecord(profile.did)}
    >
      ${avatarTemplate({ author: profile, clickAction: "none" })}
      <div class="search-recent-profile-name">${getDisplayName(profile)}</div>
      <button
        type="button"
        class="embed-preview-close-button search-recent-profile-remove"
        data-testid="search-recent-profile-remove"
        aria-label="Remove ${getDisplayName(profile)}"
        @click=${(event) => {
          event.stopPropagation();
          handleRecentProfileRemove(profile.did);
        }}
      >
        ${closeIconTemplate()}
      </button>
    </container-link>`;
  }

  function recentProfileSkeletonTemplate() {
    return html`<div
      class="search-recent-profile search-recent-profile-skeleton"
      data-testid="search-recent-profile-skeleton"
    >
      <div
        class="skeleton-avatar skeleton-animate search-recent-profile-skeleton-avatar"
      ></div>
      <div class="search-recent-profile-name">
        &#8203;<span
          class="skeleton-line-shorter skeleton-animate search-recent-profile-skeleton-name-line"
        ></span>
      </div>
    </div>`;
  }

  function recentSearchesTemplate({ terms, profileItems }) {
    return html`<div class="search-landing" data-testid="search-recent">
      <div class="search-recent-heading">Recent searches</div>
      ${profileItems.length > 0
        ? html`<div class="search-recent-profiles">
            ${profileItems.map((item) =>
              keyed(
                item.did,
                item.profile
                  ? recentProfileTileTemplate(item.profile)
                  : recentProfileSkeletonTemplate(),
              ),
            )}
          </div>`
        : ""}
      ${terms.map((entry) => recentSearchRowTemplate(entry.q))}
    </div>`;
  }

  function postSearchResultsTemplate({
    status,
    postSearchResults,
    postSearchHasMore,
    onLoadMore,
    currentUser,
  }) {
    if (!postSearchResults && status.loading) {
      return html`<div class="search-status-message">Searching posts…</div>`;
    }
    if (status.error) {
      return html`<div class="search-status-message error">
        Failed to search posts
        ${status.error.message ? html`(${status.error.message})` : ""}.
      </div>`;
    }
    if (!postSearchResults || postSearchResults.length === 0) {
      return html`<div class="search-status-message" data-testid="empty-state">
        No posts found.
      </div>`;
    }
    return html`<infinite-scroll-container
      lookahead="2500px"
      @load-more=${async (event) => {
        if (postSearchHasMore) {
          await onLoadMore();
          event.detail.resume();
        }
      }}
      ?disabled=${!postSearchHasMore}
    >
      <div>
        ${postSearchResults.map(
          (post) =>
            html`<div class="feed-item" data-post-uri="${post.uri}">
              ${smallPostTemplate({
                post,
                currentUser,
                isAuthenticated,
                showReplyToLabel: !!post.record?.reply,
                replyToAuthor: post.record?.reply?.parentAuthor ?? null,
                isUserPost: currentUser?.did === post.author?.did,
                postInteractionHandler,
                pluginService,
              })}
            </div>`,
        )}
        ${postSearchHasMore
          ? html`<div class="feed-loading-indicator">
              <div class="loading-spinner"></div>
            </div>`
          : ""}
      </div>
    </infinite-scroll-container>`;
  }

  function profileSearchResultsTemplate({
    status,
    profileSearchResults,
    profileSearchHasMore,
    currentUser,
  }) {
    if (!profileSearchResults && status.loading) {
      return html`<div class="search-status-message">Searching profiles…</div>`;
    }
    if (status.error) {
      return html`<div class="search-status-message error">
        Failed to search profiles
        ${status.error.message ? html`(${status.error.message})` : ""}.
      </div>`;
    }
    if (!profileSearchResults || profileSearchResults.length === 0) {
      return html`<div class="search-status-message" data-testid="empty-state">
        No profiles found.
      </div>`;
    }
    return profileFeedTemplate({
      profiles: profileSearchResults,
      hasMore: profileSearchHasMore,
      onLoadMore: loadMoreProfiles,
      isAuthenticated,
      currentUserDid: currentUser?.did ?? null,
      profileInteractionHandler,
      pluginService,
    });
  }

  function feedSearchResultsTemplate({
    status,
    feedSearchResults,
    feedSearchHasMore,
    preferences,
  }) {
    if (!feedSearchResults && status.loading) {
      return html`<div class="search-status-message">Searching feeds…</div>`;
    }
    if (status.error) {
      return html`<div class="search-status-message error">
        Failed to search feeds
        ${status.error.message ? html`(${status.error.message})` : ""}.
      </div>`;
    }
    if (!feedSearchResults || feedSearchResults.length === 0) {
      return html`<div class="search-status-message" data-testid="empty-state">
        No feeds found.
      </div>`;
    }
    return html`<infinite-scroll-container
      lookahead="2500px"
      @load-more=${async (event) => {
        if (feedSearchHasMore) {
          await loadMoreFeeds();
          event.detail.resume();
        }
      }}
      ?disabled=${!feedSearchHasMore}
    >
      <div class="feeds-list">
        ${feedSearchResults.map((feedGenerator) => {
          const isPinned = preferences.isFeedPinned(feedGenerator.uri);
          return html`
            <container-link
              class="feeds-list-item clickable"
              href=${linkToFeed(feedGenerator)}
            >
              <div class="feeds-list-item-avatar">
                ${feedGenerator.avatar
                  ? html`<img
                      src=${cdnImageUrl(feedGenerator.avatar)}
                      alt=${feedGenerator.displayName}
                      class="feed-avatar"
                    />`
                  : html`<img
                      src="/img/feed-avatar-fallback.svg"
                      alt=${feedGenerator.displayName}
                      class="feed-avatar"
                    />`}
              </div>
              <div class="feeds-list-item-content">
                <div class="feeds-list-item-title">
                  ${feedGenerator.displayName}
                </div>
                ${feedGenerator.creator
                  ? html`<div class="feeds-list-item-creator">
                      by @${feedGenerator.creator.handle}
                    </div>`
                  : ""}
                ${feedGenerator.description
                  ? // prettier-ignore
                    html`<div class="feeds-list-item-description">${feedGenerator.description}</div>`
                  : ""}
              </div>
              <div class="feeds-list-item-actions">
                <button
                  class=${classnames("rounded-button pin-feed-button", {
                    "rounded-button-primary": !isPinned,
                    pinned: isPinned,
                  })}
                  @click=${(e) => {
                    e.stopPropagation();
                    feedInteractionHandler.handlePinFeed(
                      feedGenerator.uri,
                      !isPinned,
                    );
                  }}
                >
                  ${isPinned ? "" : pinIconTemplate({ filled: false })}
                  ${isPinned ? "Unpin feed" : "Pin feed"}
                </button>
              </div>
            </container-link>
          `;
        })}
        ${feedSearchHasMore
          ? html`<div class="feed-loading-indicator">
              <div class="loading-spinner"></div>
            </div>`
          : ""}
      </div>
    </infinite-scroll-container>`;
  }

  function getActivePanelTemplate(activeTab, committedQuery, currentUser) {
    const status = dataLayer.requests.statusStore.$statuses.get(
      TAB_STATUS_PREFIXES[activeTab] + committedQuery,
    );
    switch (activeTab) {
      case "top":
        return html`<div
          class="search-results-panel search-post-results search-post-results-top"
        >
          ${postSearchResultsTemplate({
            status,
            postSearchResults: dataLayer.derived.$postSearchResultsTop.get(),
            postSearchHasMore: !!dataLayer.derived.$postSearchCursorTop.get(),
            onLoadMore: loadMoreTopPosts,
            currentUser,
          })}
        </div>`;
      case "latest":
        return html`<div
          class="search-results-panel search-post-results search-post-results-latest"
        >
          ${postSearchResultsTemplate({
            status,
            postSearchResults: dataLayer.derived.$postSearchResultsLatest.get(),
            postSearchHasMore:
              !!dataLayer.derived.$postSearchCursorLatest.get(),
            onLoadMore: loadMoreLatestPosts,
            currentUser,
          })}
        </div>`;
      case "feeds":
        return html`<div class="search-results-panel">
          ${feedSearchResultsTemplate({
            status,
            feedSearchResults: dataLayer.derived.$feedSearchResults.get(),
            feedSearchHasMore: !!dataLayer.derived.$feedSearchCursor.get(),
            preferences: dataLayer.derived.$preferences.get(),
          })}
        </div>`;
      default:
        return html`<div class="search-results-panel">
          ${profileSearchResultsTemplate({
            status,
            profileSearchResults: dataLayer.derived.$profileSearchResults.get(),
            profileSearchHasMore:
              !!dataLayer.derived.$profileSearchCursor.get(),
            currentUser,
          })}
        </div>`;
    }
  }

  loadPageData();

  bindToPage(root, layout, "active-nav-click", () => {
    loadPageData();
  });

  bindPageTitle(root, () => "Search");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const inputValue = state.$inputValue.get();
    const showTypeahead = state.$showTypeahead.get();
    const committedQuery = state.$committedQuery.get();
    const activeTab = state.$activeTab.get();
    const trimmedInput = inputValue.trim();
    const mode = !trimmedInput
      ? "placeholder"
      : showTypeahead
        ? "typeahead"
        : "results";

    let bodyTemplate;
    if (mode === "typeahead") {
      bodyTemplate = typeaheadTemplate({
        query: trimmedInput,
        profiles: dataLayer.derived.$searchTypeaheadResults.get(),
        onCommit: commitSearch,
      });
    } else if (mode === "results") {
      bodyTemplate = html`<div class="search-tab-panels">
        <div class="search-tab-panel">
          ${getActivePanelTemplate(
            isAuthenticated ? activeTab : "profiles",
            committedQuery,
            currentUser,
          )}
        </div>
      </div>`;
    } else {
      const recentTerms = isAuthenticated
        ? dataLayer.derived.$recentSearchTerms.get()
        : [];
      const recentProfilesLoading = state.$recentProfilesLoading.get();
      const recentProfileItems = (
        (isAuthenticated
          ? dataLayer.derived.$recentSearchProfiles.get()
          : null) ?? []
      )
        .map((entry) => ({
          did: entry.did,
          profile: isRecentProfileVisible(entry.profile) ? entry.profile : null,
          pending: !entry.profile && recentProfilesLoading,
        }))
        .filter((item) => item.profile || item.pending);
      if (recentTerms.length > 0 || recentProfileItems.length > 0) {
        bodyTemplate = recentSearchesTemplate({
          terms: recentTerms,
          profileItems: recentProfileItems,
        });
      } else {
        bodyTemplate = html`<div class="search-placeholder">
          <div class="search-placeholder-icon">${searchIconTemplate()}</div>
          <div class="search-placeholder-text">
            ${isAuthenticated
              ? "Start typing to search for users, posts, and feeds."
              : html`Start typing to search for users.<br />Sign in to search
                  for posts.`}
          </div>
        </div>`;
      }
    }

    render(
      html`<div id="search-view">
        ${headerTemplate({
          title: "Search",
          leftButton: "menu",
          onClickMenuButton: () => layout.openSidebar(),
          bottomItemTemplate: () => html`
            <div class="search-input-container">
              ${searchIconTemplate()}
              <input
                class="search-input"
                type="search"
                name="search"
                aria-label="Search"
                autocapitalize="none"
                autocomplete="off"
                autocorrect="off"
                enterkeyhint="search"
                spellcheck="false"
                placeholder=${isAuthenticated
                  ? "Search for users, posts, and feeds"
                  : "Search for users"}
                .value=${inputValue}
                @input=${(event) => {
                  // Prevent events from being picked up by password manager extensions
                  event.stopPropagation();
                  handleInput(event.target.value);
                }}
                @keydown=${(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitSearch();
                  }
                }}
              />
              ${inputValue.length > 0
                ? html`
                    <button
                      class="search-clear-button"
                      @click=${() => handleClearSearch()}
                    >
                      ${closeIconTemplate()}
                    </button>
                  `
                : ""}
              ${mode === "results" && isAuthenticated
                ? html`
                    <tab-bar
                      .tabs=${[
                        { value: "top", label: "Top" },
                        { value: "latest", label: "Latest" },
                        { value: "profiles", label: "People" },
                        { value: "feeds", label: "Feeds" },
                      ]}
                      active-tab=${activeTab}
                      full-width
                      @tab-click=${(event) => handleTabChange(event.detail)}
                    ></tab-bar>
                  `
                : ""}
            </div>
          `,
        })}
        <main>
          <div class="search-results-container">${bodyTemplate}</div>
        </main>
      </div>`,
      root,
    );
  });
}
