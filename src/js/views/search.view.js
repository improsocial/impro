import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { classnames, debounce } from "/js/utils.js";
import { Signal } from "/js/signals.js";
import { linkToFeed } from "/js/navigation.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { pageEffect } from "/js/router.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";

class SearchView extends View {
  async render({
    root,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      reportService,
      isAuthenticated,
      pluginService,
      interactionHandlers,
    },
  }) {
    const $activeTab = new Signal.State("profiles");
    const $searchQuery = new Signal.State("");

    const tabScrollState = new Map();

    async function loadSearchResults() {
      const searchQuery = $searchQuery.get();
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
          dataLayer.requests.loadPostSearch(normalizedQuery, {
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
      await dataLayer.requests.loadProfileSearch($searchQuery.get().trim(), {
        limit: 25,
        cursor,
      });
    }

    async function loadMorePosts() {
      const cursor = dataLayer.derived.$postSearchCursor.get();
      if (!cursor) return;
      await dataLayer.requests.loadPostSearch($searchQuery.get().trim(), {
        limit: 25,
        cursor,
      });
    }

    async function loadMoreFeeds() {
      const cursor = dataLayer.derived.$feedSearchCursor.get();
      if (!cursor) return;
      await dataLayer.requests.loadFeedSearch($searchQuery.get().trim(), {
        limit: 15,
        cursor,
      });
    }

    const { postInteractionHandler, feedInteractionHandler } =
      interactionHandlers;

    const handleSearchInput = debounce((value) => {
      $searchQuery.set(value);
      loadSearchResults();
    });

    function handleClearSearch() {
      $searchQuery.set("");
      loadSearchResults();
    }

    function handleTabChange(tab) {
      tabScrollState.set($activeTab.get(), window.scrollY);
      $activeTab.set(tab);
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
            await loadMorePosts();
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
              <div
                class="feeds-list-item clickable"
                @click=${() => window.router.go(linkToFeed(feedGenerator))}
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
              </div>
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
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const searchQuery = $searchQuery.get();
      const activeTab = $activeTab.get();
      const normalizedQuery = searchQuery.trim();
      const showResults = normalizedQuery.length > 0;
      const postStatus = dataLayer.requests.statusStore.$statuses
        .get(`loadPostSearch-${normalizedQuery}-top`)
        .get();
      const profileStatus = dataLayer.requests.statusStore.$statuses
        .get("loadProfileSearch-" + normalizedQuery)
        .get();
      const feedStatus = dataLayer.requests.statusStore.$statuses
        .get("loadFeedSearch-" + normalizedQuery)
        .get();
      const postSearchResults = dataLayer.derived.$postSearchResults.get();
      const profileSearchResults =
        dataLayer.derived.$profileSearchResults.get();
      const feedSearchResults = dataLayer.derived.$feedSearchResults.get();
      const postSearchHasMore = !!dataLayer.derived.$postSearchCursor.get();
      const profileSearchHasMore =
        !!dataLayer.derived.$profileSearchCursor.get();
      const feedSearchHasMore = !!dataLayer.derived.$feedSearchCursor.get();
      const preferences = dataLayer.derived.$preferences.get();

      render(
        html`<div id="search-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            activeNavItem: "search",
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html`
              ${headerTemplate({
                title: "Search",
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
                            <span>×</span>
                          </button>
                        `
                      : ""}
                    ${showResults
                      ? tabBarTemplate({
                          tabs: [
                            { value: "profiles", label: "Profiles" },
                            ...(isAuthenticated
                              ? [
                                  { value: "posts", label: "Posts" },
                                  { value: "feeds", label: "Feeds" },
                                ]
                              : []),
                          ],
                          activeTab,
                          onTabClick: handleTabChange,
                        })
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
                            ?hidden=${activeTab !== "posts"}
                          >
                            <div
                              class="search-results-panel search-post-results"
                            >
                              ${postSearchResultsTemplate({
                                status: postStatus,
                                postSearchResults,
                                postSearchHasMore,
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
                            : html`Start typing to search for users.<br />Sign
                                in to search for posts.`}
                        </div>
                      </div>`}
                </div>
              </main>
            `,
          })}
        </div>`,
        root,
      );
    });

    root.addEventListener("page-enter", async () => {
      const query = new URLSearchParams(window.location.search);
      if (query.get("q")) {
        $searchQuery.set(query.get("q"));
      }
      if (query.get("tab")) {
        $activeTab.set(query.get("tab"));
      }
      if ($searchQuery.get()) {
        loadSearchResults();
      }
      if (isAuthenticated) {
        dataLayer.declarative.ensureCurrentUser();
      }
    });

    root.addEventListener("page-restore", (event) => {
      const scrollY = event.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new SearchView();
