import { html, render } from "/js/lib/lit-html.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { classnames, debounce } from "/js/utils.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { linkToProfile, linkToFeed } from "/js/navigation.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { FeedInteractionHandler } from "/js/feedInteractionHandler.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";

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
    },
  }) {
    const state = {
      activeTab: "profiles",
      searchQuery: "",
    };

    const tabScrollState = new Map();

    async function loadSearchResults() {
      const normalizedQuery = state.searchQuery.trim();

      // Update URL query parameter
      const url = new URL(window.location);
      if (normalizedQuery) {
        url.searchParams.set("q", normalizedQuery);
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

      renderPage();

      try {
        await Promise.all(requests);
      } catch (error) {
        console.error("Failed to load search results", error);
      } finally {
        renderPage();
      }
    }

    async function loadMoreProfiles() {
      const cursor = dataLayer.selectors.getProfileSearchCursor();
      if (!cursor) return;
      await dataLayer.requests.loadProfileSearch(state.searchQuery.trim(), {
        limit: 25,
        cursor,
      });
      renderPage();
    }

    async function loadMorePosts() {
      const cursor = dataLayer.selectors.getPostSearchCursor();
      if (!cursor) return;
      await dataLayer.requests.loadPostSearch(state.searchQuery.trim(), {
        limit: 25,
        cursor,
      });
      renderPage();
    }

    async function loadMoreFeeds() {
      const cursor = dataLayer.selectors.getFeedSearchCursor();
      if (!cursor) return;
      await dataLayer.requests.loadFeedSearch(state.searchQuery.trim(), {
        limit: 15,
        cursor,
      });
      renderPage();
    }

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      reportService,
      {
        renderFunc: () => renderPage(),
      },
    );

    const feedInteractionHandler = new FeedInteractionHandler(dataLayer, {
      renderFunc: () => renderPage(),
    });

    const handleSearchInput = debounce((value) => {
      state.searchQuery = value;
      loadSearchResults();
    });

    function handleClearSearch() {
      state.searchQuery = "";
      loadSearchResults();
    }

    function handleTabChange(tab) {
      tabScrollState.set(state.activeTab, window.scrollY);
      state.activeTab = tab;
      renderPage();
      if (tabScrollState.has(tab)) {
        window.scrollTo(0, tabScrollState.get(tab));
      } else {
        window.scrollTo(0, 0);
      }
    }

    function profileResultTemplate({ profile }) {
      const displayName = getDisplayName(profile);
      return html`<div
        @click=${() => window.router.go(linkToProfile(profile.handle))}
        class="profile-list-item"
      >
        ${avatarTemplate({ author: profile })}
        <div class="profile-list-item-body">
          <div class="profile-list-item-name">
            <span class="profile-list-item-display-name">
              ${displayName || profile.handle}${verificationBadgeTemplate({
                profile,
              })}${automatedAccountBadgeTemplate({ profile })}
            </span>
          </div>
          <div class="profile-list-item-handle">@${profile.handle}</div>
        </div>
      </div>`;
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
        return html`<div class="search-status-message">No posts found.</div>`;
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
        <div class=${classnames("loading-area", { loading: status.loading })}>
          ${postSearchResults.map(
            (post) =>
              html`<div class="feed-item" data-post-uri="${post.uri}">
                ${smallPostTemplate({
                  post,
                  showReplyToLabel: !!post.record?.reply,
                  replyToAuthor: post.record?.reply?.parentAuthor ?? null,
                  isUserPost: currentUser?.did === post.author?.did,
                  postInteractionHandler,
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
        return html`<div class="search-status-message">
          No profiles found.
        </div>`;
      }
      return html`<infinite-scroll-container
        lookahead="2500px"
        @load-more=${async (event) => {
          if (profileSearchHasMore) {
            await loadMoreProfiles();
            event.detail.resume();
          }
        }}
        ?disabled=${!profileSearchHasMore}
      >
        <div
          class=${classnames("profile-list loading-area", {
            loading: status.loading,
          })}
        >
          ${profileSearchResults.map((profile) =>
            profileResultTemplate({ profile }),
          )}
          ${profileSearchHasMore
            ? html`<div class="feed-loading-indicator">
                <div class="loading-spinner"></div>
              </div>`
            : ""}
        </div>
      </infinite-scroll-container>`;
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
        return html`<div class="search-status-message">No feeds found.</div>`;
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
        <div
          class=${classnames("feeds-list loading-area", {
            loading: status.loading,
          })}
        >
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

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const normalizedQuery = state.searchQuery.trim();
      const showResults = normalizedQuery.length > 0;
      const postStatus = dataLayer.requests.getStatus("loadPostSearch");
      const profileStatus = dataLayer.requests.getStatus("loadProfileSearch");
      const feedStatus = dataLayer.requests.getStatus("loadFeedSearch");
      const postSearchResults = dataLayer.selectors.getPostSearchResults();
      const profileSearchResults =
        dataLayer.selectors.getProfileSearchResults();
      const feedSearchResults = dataLayer.selectors.getFeedSearchResults();
      const postSearchHasMore = !!dataLayer.selectors.getPostSearchCursor();
      const profileSearchHasMore =
        !!dataLayer.selectors.getProfileSearchCursor();
      const feedSearchHasMore = !!dataLayer.selectors.getFeedSearchCursor();
      const preferences = dataLayer.selectors.getPreferences();

      render(
        html`<div id="search-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "search",
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html`
              <main>
                ${textHeaderTemplate({ title: "Search" })}
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
                    .value=${state.searchQuery}
                    @input=${(event) => handleSearchInput(event.target.value)}
                  />
                  ${state.searchQuery.length > 0
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
                        activeTab: state.activeTab,
                        onTabClick: handleTabChange,
                      })
                    : ""}
                </div>
                <div class="search-results-container">
                  ${showResults
                    ? html`
                        <div class="search-tab-panels">
                          <div
                            class="search-tab-panel"
                            ?hidden=${state.activeTab !== "posts"}
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
                            ?hidden=${state.activeTab !== "profiles"}
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
                            ?hidden=${state.activeTab !== "feeds"}
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
    }

    root.addEventListener("page-enter", async () => {
      const query = new URLSearchParams(window.location.search);
      if (query.get("q")) {
        state.searchQuery = query.get("q");
      }
      if (query.get("tab")) {
        state.activeTab = query.get("tab");
      }
      if (state.searchQuery) {
        loadSearchResults();
      }
      renderPage();
      if (isAuthenticated) {
        dataLayer.declarative.ensureCurrentUser().then(() => {
          renderPage();
        });
      }
    });

    root.addEventListener("page-restore", (event) => {
      const scrollY = event.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
      renderPage();
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new SearchView();
