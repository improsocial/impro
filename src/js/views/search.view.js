import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { classnames, debounce } from "/js/utils.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { linkToFeed } from "/js/navigation.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { pageEffect } from "/js/router.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import "/js/components/container-link.js";
import "/js/components/tab-bar.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";

class SearchView extends View {
  async render({
    root,
    layout,
    context: { dataLayer, isAuthenticated, pluginService, interactionHandlers },
  }) {
    const state = new ReactiveStore("searchView");
    state.$activeTab = new Signal.State("profiles");
    state.$searchQuery = new Signal.State("");

    const tabScrollState = new Map();

    async function loadSearchResults() {
      const searchQuery = state.$searchQuery.get();
      const normalizedQuery = searchQuery.trim();

      // Update URL query parameter
      const url = new URL(window.location);
      if (searchQuery) {
        url.searchParams.set("q", searchQuery);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, "", url);

      const requests = [];

      requests.push(
        dataLayer.requests.loadProfileSearch(normalizedQuery, {
          limit: 25,
        }),
      );

      if (isAuthenticated) {
        requests.push(
          dataLayer.requests.loadPostSearchTop(normalizedQuery, {
            limit: 25,
          }),
        );
        requests.push(
          dataLayer.requests.loadPostSearchLatest(normalizedQuery, {
            limit: 25,
          }),
        );
        requests.push(
          dataLayer.requests.loadFeedSearch(normalizedQuery, {
            limit: 15,
          }),
        );
      }

      try {
        await Promise.all(requests);
      } catch (error) {
        console.error("Failed to load search results", error);
      }
    }

    async function loadMoreProfiles() {
      const cursor = dataLayer.derived.$profileSearchCursor.get();
      if (!cursor) return;
      await dataLayer.requests.loadProfileSearch(
        state.$searchQuery.get().trim(),
        {
          limit: 25,
          cursor,
        },
      );
    }

    async function loadMoreTopPosts() {
      const cursor = dataLayer.derived.$postSearchCursorTop.get();
      if (!cursor) return;
      await dataLayer.requests.loadPostSearchTop(
        state.$searchQuery.get().trim(),
        {
          limit: 25,
          cursor,
        },
      );
    }

    async function loadMoreLatestPosts() {
      const cursor = dataLayer.derived.$postSearchCursorLatest.get();
      if (!cursor) return;
      await dataLayer.requests.loadPostSearchLatest(
        state.$searchQuery.get().trim(),
        {
          limit: 25,
          cursor,
        },
      );
    }

    async function loadMoreFeeds() {
      const cursor = dataLayer.derived.$feedSearchCursor.get();
      if (!cursor) return;
      await dataLayer.requests.loadFeedSearch(state.$searchQuery.get().trim(), {
        limit: 15,
        cursor,
      });
    }

    const {
      postInteractionHandler,
      feedInteractionHandler,
      profileInteractionHandler,
    } = interactionHandlers;

    const handleSearchInput = debounce((value) => {
      state.$searchQuery.set(value);
      loadSearchResults();
    });

    function handleClearSearch() {
      handleSearchInput.cancel();
      state.$searchQuery.set("");
      loadSearchResults();
    }

    function handleTabChange(tab) {
      tabScrollState.set(state.$activeTab.get(), window.scrollY);
      state.$activeTab.set(tab);
      if (tabScrollState.has(tab)) {
        window.scrollTo(0, tabScrollState.get(tab));
      } else {
        window.scrollTo(0, 0);
      }
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
        return html`<div
          class="search-status-message"
          data-testid="empty-state"
        >
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
        return html`<div class="search-status-message">
          Searching profiles…
        </div>`;
      }
      if (status.error) {
        return html`<div class="search-status-message error">
          Failed to search profiles
          ${status.error.message ? html`(${status.error.message})` : ""}.
        </div>`;
      }
      if (!profileSearchResults || profileSearchResults.length === 0) {
        return html`<div
          class="search-status-message"
          data-testid="empty-state"
        >
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
        return html`<div
          class="search-status-message"
          data-testid="empty-state"
        >
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
                        src=${feedGenerator.avatar}
                        alt=${feedGenerator.displayName}
                        class="feed-avatar"
                      />`
                    : html`<img
                        src="/img/list-avatar-fallback.svg"
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

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const searchQuery = state.$searchQuery.get();
      const activeTab = state.$activeTab.get();
      const normalizedQuery = searchQuery.trim();
      const showResults = normalizedQuery.length > 0;
      const topPostStatus = dataLayer.requests.statusStore.$statuses.get(
        "loadPostSearchTop-" + normalizedQuery,
      );
      const latestPostStatus = dataLayer.requests.statusStore.$statuses.get(
        "loadPostSearchLatest-" + normalizedQuery,
      );
      const topPostSearchResults =
        dataLayer.derived.$postSearchResultsTop.get();
      const latestPostSearchResults =
        dataLayer.derived.$postSearchResultsLatest.get();
      const topPostSearchHasMore =
        !!dataLayer.derived.$postSearchCursorTop.get();
      const latestPostSearchHasMore =
        !!dataLayer.derived.$postSearchCursorLatest.get();
      const profileStatus = dataLayer.requests.statusStore.$statuses.get(
        "loadProfileSearch-" + normalizedQuery,
      );
      const feedStatus = dataLayer.requests.statusStore.$statuses.get(
        "loadFeedSearch-" + normalizedQuery,
      );
      const profileSearchResults =
        dataLayer.derived.$profileSearchResults.get();
      const feedSearchResults = dataLayer.derived.$feedSearchResults.get();
      const profileSearchHasMore =
        !!dataLayer.derived.$profileSearchCursor.get();
      const feedSearchHasMore = !!dataLayer.derived.$feedSearchCursor.get();
      const preferences = dataLayer.derived.$preferences.get();

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
                  autocapitalize="none"
                  autocomplete="off"
                  autocorrect="off"
                  placeholder=${isAuthenticated
                    ? "Search for users, posts, and feeds"
                    : "Search for users"}
                  .value=${searchQuery}
                  @input=${(event) => handleSearchInput(event.target.value)}
                />
                ${searchQuery.length > 0
                  ? html`
                      <button
                        class="search-clear-button"
                        @click=${() => handleClearSearch()}
                      >
                        ${closeIconTemplate()}
                      </button>
                    `
                  : ""}
                ${showResults && isAuthenticated
                  ? html`
                      <tab-bar
                        .tabs=${[
                          { value: "profiles", label: "Profiles" },
                          { value: "top", label: "Top" },
                          { value: "latest", label: "Latest" },
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
            <div class="search-results-container">
              ${showResults
                ? html`
                    <div class="search-tab-panels">
                      <div
                        class="search-tab-panel"
                        ?hidden=${activeTab !== "top"}
                      >
                        <div
                          class="search-results-panel search-post-results search-post-results-top"
                        >
                          ${postSearchResultsTemplate({
                            status: topPostStatus,
                            postSearchResults: topPostSearchResults,
                            postSearchHasMore: topPostSearchHasMore,
                            onLoadMore: loadMoreTopPosts,
                            currentUser,
                          })}
                        </div>
                      </div>
                      <div
                        class="search-tab-panel"
                        ?hidden=${activeTab !== "latest"}
                      >
                        <div
                          class="search-results-panel search-post-results search-post-results-latest"
                        >
                          ${postSearchResultsTemplate({
                            status: latestPostStatus,
                            postSearchResults: latestPostSearchResults,
                            postSearchHasMore: latestPostSearchHasMore,
                            onLoadMore: loadMoreLatestPosts,
                            currentUser,
                          })}
                        </div>
                      </div>
                      <div
                        class="search-tab-panel"
                        ?hidden=${activeTab !== "profiles"}
                      >
                        <div class="search-results-panel">
                          ${profileSearchResultsTemplate({
                            status: profileStatus,
                            profileSearchResults,
                            profileSearchHasMore,
                            currentUser,
                          })}
                        </div>
                      </div>
                      <div
                        class="search-tab-panel"
                        ?hidden=${activeTab !== "feeds"}
                      >
                        <div class="search-results-panel">
                          ${feedSearchResultsTemplate({
                            status: feedStatus,
                            feedSearchResults,
                            feedSearchHasMore,
                            preferences,
                          })}
                        </div>
                      </div>
                    </div>
                  `
                : html`<div class="search-placeholder">
                    <div class="search-placeholder-icon">
                      ${searchIconTemplate()}
                    </div>
                    <div class="search-placeholder-text">
                      ${isAuthenticated
                        ? "Start typing to search for users, posts, and feeds."
                        : html`Start typing to search for users.<br />Sign in to
                            search for posts.`}
                    </div>
                  </div>`}
            </div>
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      const query = new URLSearchParams(window.location.search);
      if (query.get("q")) {
        state.$searchQuery.set(query.get("q"));
      }
      if (query.get("tab")) {
        const tab = query.get("tab");
        state.$activeTab.set(tab === "posts" ? "top" : tab);
      }
      if (state.$searchQuery.get()) {
        loadSearchResults();
      }
    });

    root.addEventListener("page-restore", (event) => {
      const scrollY = event.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new SearchView();
