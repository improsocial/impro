import { html, render } from "/js/lib/lit-html.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { searchIconTemplate } from "/js/templates/icons/searchIcon.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { classnames, debounce } from "/js/utils.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { linkToProfile } from "/js/navigation.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";

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
          limit: 10,
        }),
      );

      if (isAuthenticated) {
        requests.push(
          dataLayer.requests.loadPostSearch(normalizedQuery, {
            limit: 25,
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

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      reportService,
      {
        renderFunc: () => renderPage(),
      },
    );

    const handleSearchInput = debounce((value) => {
      state.searchQuery = value;
      loadSearchResults();
    });

    function handleClearSearch() {
      state.searchQuery = "";
      loadSearchResults();
    }

    function handleTabChange(tab) {
      state.activeTab = tab;
      renderPage();
    }

    function profileResultTemplate({ profile }) {
      const displayName = getDisplayName(profile);
      return html`<div
        @click=${() => window.router.go(linkToProfile(profile.handle))}
        class="profile-list-item"
      >
        ${avatarTemplate({ author: profile })}
        <div class="profile-list-item-body">
          <a
            class="profile-list-item-name"
            href="${linkToProfile(profile.handle)}"
          >
            <span class="profile-list-item-display-name">
              ${displayName || profile.handle}
            </span>
          </a>
          <div class="profile-list-item-handle">@${profile.handle}</div>
        </div>
      </div>`;
    }

    function postSearchResultsTemplate({
      status,
      postSearchResults,
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
      return html` <div
        class=${classnames("loading-area", { loading: status.loading })}
      >
        ${postSearchResults.map(
          (post) =>
            html`<div class="feed-item" data-post-uri="${post.uri}">
              ${smallPostTemplate({
                post,
                replyToAuthor: post.record?.reply?.parentAuthor ?? null,
                isUserPost: currentUser?.did === post.author?.did,
                postInteractionHandler,
              })}
            </div>`,
        )}
      </div>`;
    }

    function profileSearchResultsTemplate({ status, profileSearchResults }) {
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
      return html`<div
        class=${classnames("profile-list loading-area", {
          loading: status.loading,
        })}
      >
        ${profileSearchResults.map((profile) =>
          profileResultTemplate({ profile }),
        )}
      </div>`;
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
      const postSearchResults = dataLayer.selectors.getPostSearchResults();
      const profileSearchResults =
        dataLayer.selectors.getProfileSearchResults();

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
                    placeholder=${isAuthenticated
                      ? "Search for users and posts"
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
                    ? html`
                        <div class="tab-bar">
                          <button
                            class=${classnames("tab-bar-button", {
                              active: state.activeTab === "profiles",
                            })}
                            @click=${() => handleTabChange("profiles")}
                          >
                            Profiles
                          </button>
                          ${isAuthenticated
                            ? html`
                                <button
                                  class=${classnames("tab-bar-button", {
                                    active: state.activeTab === "posts",
                                  })}
                                  @click=${() => handleTabChange("posts")}
                                >
                                  Posts
                                </button>
                              `
                            : ""}
                        </div>
                      `
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
                            ? "Start typing to search for users and posts."
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

    root.addEventListener("page-restore", () => {
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
