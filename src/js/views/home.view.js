import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { menuIconTemplate } from "/js/templates/icons/menuIcon.template.js";
import { classnames } from "/js/utils.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { PostSeenObserver } from "/js/postSeenObserver.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { FEED_PAGE_SIZE, DISCOVER_FEED_URI } from "/js/config.js";

class HomeView extends View {
  async render({
    root,
    context: {
      dataLayer,
      api,
      notificationService,
      chatNotificationService,
      postComposerService,
      isAuthenticated,
    },
  }) {
    function createSessionState(namespace) {
      return new Proxy(
        {},
        {
          get: (target, prop) => {
            const value = sessionStorage.getItem(`${namespace}-${prop}`);
            return value ? JSON.parse(value) : null;
          },
          set: (target, prop, value) => {
            sessionStorage.setItem(
              `${namespace}-${prop}`,
              JSON.stringify(value)
            );
            return true;
          },
        }
      );
    }

    const sessionState = isAuthenticated ? createSessionState("home-view") : {};

    function resetToDefaultFeed() {
      sessionState.currentFeedUri = isAuthenticated
        ? "following"
        : DISCOVER_FEED_URI;
    }

    if (!sessionState.currentFeedUri) {
      resetToDefaultFeed();
    }

    function getProxyUrl(feedGenerator) {
      if (feedGenerator.uri === "following") {
        return null;
      }
      return `${feedGenerator.did}#bsky_fg`;
    }

    const postSeenObservers = new Map();

    // Initialize post seen observers for feeds with proxy URLs
    function initializePostSeenObservers(pinnedFeedGenerators) {
      if (!isAuthenticated) {
        return;
      }
      const interactableFeedGenerators = pinnedFeedGenerators.filter(
        (pinnedFeedGenerator) =>
          pinnedFeedGenerator.acceptsInteractions ||
          pinnedFeedGenerator.uri === DISCOVER_FEED_URI
      );
      for (const pinnedFeedGenerator of interactableFeedGenerators) {
        const proxyUrl = getProxyUrl(pinnedFeedGenerator);
        if (proxyUrl) {
          postSeenObservers.set(
            pinnedFeedGenerator.uri,
            new PostSeenObserver(api, proxyUrl)
          );
        }
      }
    }

    async function handleMenuClick() {
      const sidebar = root.querySelector("animated-sidebar");
      sidebar.open();
    }

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      {
        renderFunc: () => renderPage(),
      }
    );

    function isVisible(element) {
      return (
        element.getBoundingClientRect().top < window.innerHeight &&
        element.getBoundingClientRect().bottom > 0
      );
    }

    async function handleShowLess(post, feedContext, feedGenerator) {
      dataLayer.mutations.sendShowLessInteraction(
        post.uri,
        feedContext,
        getProxyUrl(feedGenerator)
      );
      // Render optimistic update
      renderPage();
      // Scroll to last feed feedback message
      // const lastFeedFeedbackMessageElement = [
      //   ...document.querySelectorAll(".feed-feedback-message"),
      // ].pop();
      // if (lastFeedFeedbackMessageElement) {
      //   if (!isVisible(lastFeedFeedbackMessageElement)) {
      //     window.scrollTo(0, lastFeedFeedbackMessageElement.offsetTop);
      //   }
      // }
    }

    const feedScrollState = new Map();

    async function scrollAndReloadFeed() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      // TODO - add setting to prevent reload?
      await loadCurrentFeed({ reload: true });
    }

    async function handleTabClick(feed) {
      if (feed.uri === sessionState.currentFeedUri) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(sessionState.currentFeedUri, window.scrollY);
      // Switch feed
      sessionState.currentFeedUri = feed.uri;
      renderPage();
      scrollActiveTabIntoView({ behavior: "smooth" });
      // Scroll to saved scroll state
      if (feedScrollState.has(sessionState.currentFeedUri)) {
        window.scrollTo(0, feedScrollState.get(sessionState.currentFeedUri));
      } else {
        window.scrollTo(0, 0);
      }
      if (!dataLayer.hasCachedFeed(sessionState.currentFeedUri)) {
        await loadCurrentFeed();
      }
      // Trigger post seen checks for the new feed
      const postSeenObserver = postSeenObservers.get(
        sessionState.currentFeedUri
      );
      if (postSeenObserver) {
        postSeenObserver.checkAllIntersections();
      }
    }
    async function renderPage() {
      const showLessInteractions =
        dataLayer.selectors.getShowLessInteractions() ?? [];
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item
      );
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const currentUser = dataLayer.selectors.getCurrentUser();
      const feedGenerators =
        dataLayer.selectors.getPinnedFeedGenerators() ?? [];
      render(
        html`<div id="home-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            onClickActiveNavItem: () => {
              scrollAndReloadFeed();
            },
            numNotifications,
            numChatNotifications,
            currentUser,
            activeNavItem: "home",
            showFloatingComposeButton: true,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            children: html` <header>
                <div class="header-row">
                  <button class="menu-button" @click=${() => handleMenuClick()}>
                    ${menuIconTemplate()}
                  </button>
                </div>
                <div class="header-row">
                  <div class="tab-bar-horizontal-scroll-container">
                    <div class="tab-bar">
                      ${feedGenerators.map(
                        (feedGenerator) =>
                          html`<button
                            class=${classnames("tab-bar-button", {
                              active:
                                sessionState.currentFeedUri ===
                                feedGenerator.uri,
                            })}
                            @click=${() => handleTabClick(feedGenerator)}
                          >
                            ${feedGenerator.displayName}
                          </button>`
                      )}
                    </div>
                  </div>
                </div>
              </header>
              <main>
                ${feedGenerators.map((feedGenerator) => {
                  const feed = dataLayer.selectors.getFeed(feedGenerator.uri);
                  return html`<div
                    class="feed-container"
                    ?hidden=${sessionState.currentFeedUri !== feedGenerator.uri}
                  >
                    ${postFeedTemplate({
                      feed,
                      currentUser,
                      feedGenerator,
                      hiddenPostUris,
                      postInteractionHandler,
                      onClickShowLess: (post, feedContext) =>
                        handleShowLess(post, feedContext, feedGenerator),
                      enableFeedFeedback: true,
                      onLoadMore: () => loadCurrentFeed(),
                    })}
                  </div>`;
                })}
              </main>`,
          })}
        </div>`,
        root
      );
      const feedItems = document.querySelectorAll(".feed-item");
      feedItems.forEach((feedItem) => {
        const { feedGeneratorUri, feedContext, postUri } = feedItem.dataset;
        if (feedGeneratorUri) {
          const postSeenObserver = postSeenObservers.get(feedGeneratorUri);
          if (postSeenObserver) {
            postSeenObserver.register(feedItem, postUri, feedContext);
          }
        }
      });
    }

    async function loadCurrentFeed({ reload = false } = {}) {
      await dataLayer.requests.loadNextFeedPage(sessionState.currentFeedUri, {
        reload,
        limit: FEED_PAGE_SIZE + 1,
      });
      renderPage();
    }

    async function preloadHiddenFeeds(pinnedFeedGenerators) {
      const feedsToPreload = pinnedFeedGenerators
        .filter((feed) => feed.uri !== sessionState.currentFeedUri)
        .slice(0, 5); // Up to 5 feeds
      for (const feed of feedsToPreload) {
        await dataLayer.requests.loadNextFeedPage(feed.uri, {
          limit: FEED_PAGE_SIZE + 1,
        });
      }
    }

    function scrollActiveTabIntoView({ behavior = "instant" } = {}) {
      const activeTabButton = document.querySelector(".tab-bar-button.active");
      if (activeTabButton) {
        activeTabButton.scrollIntoView({
          behavior,
          block: "nearest",
          // inline: "center",
        });
      }
    }

    root.addEventListener("page-enter", async () => {
      window.scrollTo(0, 0);

      // Initial empty state
      renderPage();

      await dataLayer.declarations
        .ensurePinnedFeedGenerators()
        .then((pinnedFeedGenerators) => {
          // If the current feed is not in the pinned feed generators, reset to default feed
          if (
            !pinnedFeedGenerators.some(
              (feed) => feed.uri === sessionState.currentFeedUri
            )
          ) {
            resetToDefaultFeed();
          }
          renderPage();
          preloadHiddenFeeds(pinnedFeedGenerators);
          initializePostSeenObservers(pinnedFeedGenerators);
          scrollActiveTabIntoView();
          window.scrollTo(0, 0);
        });

      // Ensure current user before loading feed to prevent flash of unfiltered feed
      if (isAuthenticated) {
        await dataLayer.declarations.ensureCurrentUser();
        renderPage();
      }
      await loadCurrentFeed();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
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

export default new HomeView();
