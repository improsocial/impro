import { html, render } from "/js/lib/lit-html.js";
import { classnames, wait } from "/js/utils.js";
import { View } from "./view.js";
import { profileCardTemplate } from "/js/templates/profileCard.template.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { ApiError } from "/js/api.js";
import { getFacetsFromText } from "/js/facetHelpers.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { ProfileInteractionHandler } from "/js/profileInteractionHandler.js";
import { AUTHOR_FEED_PAGE_SIZE } from "/js/config.js";

class ProfileView extends View {
  async render({
    root,
    params,
    context: {
      identityResolver,
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      isAuthenticated,
    },
  }) {
    const authorFeeds = [
      {
        feedType: "posts",
        name: "Posts",
      },
      {
        feedType: "replies",
        name: "Replies",
      },
      {
        feedType: "media",
        name: "Media",
      },
      {
        feedType: "likes",
        name: "Likes",
      },
    ];

    const state = {
      currentFeedType: authorFeeds[0].feedType,
      richTextProfileDescription: null,
    };

    const { handleOrDid } = params;
    let profileDid = null;
    if (handleOrDid.startsWith("did:")) {
      profileDid = handleOrDid;
    } else {
      profileDid = await identityResolver.resolveHandle(handleOrDid);
    }

    const profileInteractionHandler = new ProfileInteractionHandler(dataLayer, {
      renderFunc: () => renderPage(),
    });

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      {
        renderFunc: () => renderPage(),
      }
    );

    const feedScrollState = new Map();

    async function scrollAndReloadFeed() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      // TODO - add setting to prevent reload?
      await loadAuthorFeed({ reload: true });
    }

    async function handleTabClick(feed) {
      if (feed.feedType === state.currentFeedType) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(state.currentFeedType, window.scrollY);
      // Switch feed
      state.currentFeedType = feed.feedType;
      renderPage();
      // Scroll to saved scroll state
      if (feedScrollState.has(state.currentFeedType)) {
        window.scrollTo(0, feedScrollState.get(state.currentFeedType));
      } else {
        window.scrollTo(0, 0);
      }
      if (!dataLayer.hasCachedAuthorFeed(profileDid, state.currentFeedType)) {
        await loadAuthorFeed();
      }
    }

    function profileErrorTemplate({ error }) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.data.message === "Error: actor must be a valid did or a handle"
      ) {
        return html`<div class="error-state">
          <div>Error: Invalid handle</div>
          <button @click=${() => window.location.reload()}>Try again</button>
        </div>`;
      }
      console.error(error);
      return html`<div class="error-state">
        <div>There was an error loading the profile.</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function profileTemplate({ profile, currentUser = null }) {
      try {
        const isBlocked = !!profile.viewer?.blocking;
        const profileChatStatus = dataLayer.selectors.getProfileChatStatus(
          profile.did
        );
        return html`
          <div class="profile-container">
            ${profileCardTemplate({
              profile,
              richTextProfileDescription: state.richTextProfileDescription,
              isAuthenticated,
              isCurrentUser: currentUser?.did === profile.did,
              profileChatStatus,
              onClickChat: async (profile) => {
                if (!profileChatStatus || !profileChatStatus.canChat) {
                  // This should never happen
                  return;
                }
                if (profileChatStatus.convo) {
                  window.router.go(`/messages/${profileChatStatus.convo.id}`);
                } else {
                  const convo =
                    await dataLayer.declarative.ensureConvoForProfile(
                      profile.did
                    );
                  window.router.go(`/messages/${convo.id}`);
                }
              },
              onClickFollow: (profile, doFollow) =>
                profileInteractionHandler.handleFollow(profile, doFollow),
              onClickMute: (profile, doMute) =>
                profileInteractionHandler.handleMute(profile, doMute),
              onClickBlock: async (profile, doBlock) => {
                await profileInteractionHandler.handleBlock(profile, doBlock);
                if (!doBlock) {
                  // wait for the app view to process that the block has been lifted, then reload the feed
                  // We could do some fancier logic here but this is a good enough solution for now.
                  await wait(2000);
                  loadAuthorFeed();
                  preloadHiddenFeeds();
                }
              },
            })}
            ${isBlocked
              ? html`<div class="feed">
                  <div class="feed-end-message">Posts hidden</div>
                </div>`
              : html`
                  <div class="profile-tab-bar">
                    <div class="tab-bar">
                      ${authorFeeds.map(
                        (feedInfo) =>
                          html`<button
                            class=${classnames("tab-bar-button", {
                              active:
                                state.currentFeedType === feedInfo.feedType,
                            })}
                            @click=${() => handleTabClick(feedInfo)}
                          >
                            ${feedInfo.name}
                          </button>`
                      )}
                    </div>
                  </div>
                  ${authorFeeds.map((feedInfo) => {
                    const authorFeed = dataLayer.selectors.getAuthorFeed(
                      profileDid,
                      feedInfo.feedType
                    );
                    return html`<div
                      class="feed-container"
                      ?hidden=${state.currentFeedType !== feedInfo.feedType}
                    >
                      ${postFeedTemplate({
                        feed: authorFeed,
                        currentUser,
                        postInteractionHandler,
                        onLoadMore: () => loadAuthorFeed(),
                      })}
                    </div>`;
                  })}
                `}
          </div>
        `;
      } catch (error) {
        console.error("error", error);
        return profileErrorTemplate({ error });
      }
    }

    function profileSkeletonTemplate() {
      return html`<div class="profile-container"></div>`;
    }

    function renderPage() {
      const profile = dataLayer.selectors.getProfile(profileDid);
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const profileRequestStatus = dataLayer.requests.getStatus("loadProfile");
      render(
        html`<div id="profile-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: currentUser?.did === profile?.did ? "profile" : null,
            onClickActiveNavItem: () => {
              scrollAndReloadFeed();
            },
            showFloatingComposeButton: true,
            onClickComposeButton: async () => {
              await postComposerService.composePost({ currentUser });
              // Render the page again to show the new post
              renderPage();
            },
            children: html`
              <main style="position: relative;">
                <button
                  class="floating-back-button"
                  @click=${() => router.back()}
                >
                  ←
                </button>
                ${(() => {
                  if (profileRequestStatus.error) {
                    return profileErrorTemplate({
                      error: profileRequestStatus.error,
                    });
                  } else if (profile) {
                    return profileTemplate({ profile, currentUser });
                  } else {
                    return profileSkeletonTemplate();
                  }
                })()}
              </main>
            `,
          })}
        </div>`,
        root
      );
    }

    async function loadAuthorFeed({ reload = false } = {}) {
      await dataLayer.requests.loadNextAuthorFeedPage(
        profileDid,
        state.currentFeedType,
        {
          reload,
          limit: AUTHOR_FEED_PAGE_SIZE + 1,
        }
      );
      renderPage();
    }

    async function preloadHiddenFeeds() {
      const feedsToPreload = authorFeeds.filter(
        (feed) =>
          feed.feedType !== state.currentFeedType && feed.feedType !== "likes"
      );
      for (const feed of feedsToPreload) {
        await dataLayer.requests.loadNextAuthorFeedPage(
          profileDid,
          feed.feedType,
          {
            limit: AUTHOR_FEED_PAGE_SIZE + 1,
          }
        );
      }
    }

    // This is async because it needs to resolve mentions
    async function loadProfileDescription(profile) {
      if (!profile.description) {
        return null;
      }
      const facets = await getFacetsFromText(
        profile.description,
        identityResolver
      );
      return { text: profile.description, facets };
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      if (isAuthenticated) {
        await dataLayer.declarative.ensureCurrentUser();
      }
      const profile = await dataLayer.declarative.ensureProfile(profileDid);
      state.richTextProfileDescription = await loadProfileDescription(profile);
      renderPage();
      if (!profile.viewer?.blocking) {
        loadAuthorFeed();
        preloadHiddenFeeds();
      }
      // Load chat status
      if (
        isAuthenticated &&
        profile.did !== dataLayer.selectors.getCurrentUser()?.did
      ) {
        dataLayer.requests.loadProfileChatStatus(profile.did).then(() => {
          renderPage();
        });
      }
    });

    root.addEventListener("page-restore", (e) => {
      const { isBack, scrollY } = e.detail;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
      }
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

export default new ProfileView();
