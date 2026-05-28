import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { linkToProfile } from "/js/navigation.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { PostSeenObserver } from "/js/postSeenObserver.js";
import { FEED_PAGE_SIZE, DISCOVER_FEED_URI } from "/js/config.js";
import { bindToPage, pageEffect } from "/js/router.js";
import { showToast } from "/js/toasts.js";
import { Signal } from "/js/signals.js";

class HomeView extends View {
  async render({
    root,
    context: {
      dataLayer,
      api,
      notificationService,
      chatNotificationService,
      postComposerService,
      reportService,
      isAuthenticated,
      pluginService,
      interactionHandlers,
    },
  }) {
    const CURRENT_FEED_URI_STORAGE_KEY = "home-view-currentFeedUri";

    const storedFeedUri = isAuthenticated
      ? localStorage.getItem(CURRENT_FEED_URI_STORAGE_KEY)
      : null;

    const $currentFeedUri = new Signal.State(
      storedFeedUri ? JSON.parse(storedFeedUri) : null,
    );

    function resetToDefaultFeed() {
      $currentFeedUri.set(isAuthenticated ? "following" : DISCOVER_FEED_URI);
    }

    if (!$currentFeedUri.get()) {
      resetToDefaultFeed();
    }

    if (isAuthenticated) {
      pageEffect(
        root,
        () => {
          const currentFeedUri = $currentFeedUri.get();
          if (currentFeedUri) {
            localStorage.setItem(
              CURRENT_FEED_URI_STORAGE_KEY,
              JSON.stringify(currentFeedUri),
            );
          }
        },
        "PERSIST_CURRENT_FEED_URI",
      );
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
          pinnedFeedGenerator.uri === DISCOVER_FEED_URI,
      );
      for (const pinnedFeedGenerator of interactableFeedGenerators) {
        const proxyUrl = getProxyUrl(pinnedFeedGenerator);
        if (proxyUrl) {
          postSeenObservers.set(
            pinnedFeedGenerator.uri,
            new PostSeenObserver(api, proxyUrl),
          );
        }
      }
    }

    async function handleMenuClick() {
      const sidebar = root.querySelector("animated-sidebar");
      sidebar.open();
    }

    // When supported, replace with: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoViewIfNeeded
    function scrollIntoViewIfNeeded(element) {
      const isVisible =
        element.getBoundingClientRect().top < window.innerHeight &&
        element.getBoundingClientRect().bottom > 0;
      if (!isVisible) {
        element.scrollIntoView();
      }
    }

    const { postInteractionHandler } = interactionHandlers;

    async function handleShowLess(post, feedContext, feedGenerator) {
      dataLayer.mutations.sendShowLessInteraction(
        post.uri,
        feedContext,
        getProxyUrl(feedGenerator),
      );
      // Scroll to keep the feedback message in view (it might be hidden by the header, but that's okay)
      const feedFeedbackMessageElement = document.querySelector(
        `.feed-feedback-message[data-post-uri="${post.uri}"]`,
      );
      if (feedFeedbackMessageElement) {
        scrollIntoViewIfNeeded(feedFeedbackMessageElement);
      }
    }

    async function handleShowMore(post, feedContext, feedGenerator) {
      dataLayer.mutations.sendShowMoreInteraction(
        post.uri,
        feedContext,
        getProxyUrl(feedGenerator),
      );
      showToast("Feedback sent to feed operator");
    }

    const feedScrollState = new Map();

    async function scrollAndReloadFeed() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      // TODO - add setting to prevent reload?
      await loadCurrentFeed({ reload: true });
    }

    async function handleTabClick(feedUri) {
      let currentFeedUri = $currentFeedUri.get();
      if (feedUri === currentFeedUri) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(currentFeedUri, window.scrollY);
      // Switch feed
      $currentFeedUri.set(feedUri);
      scrollActiveTabIntoView({ behavior: "smooth" });
      // Scroll to saved scroll state
      if (feedScrollState.has(feedUri)) {
        window.scrollTo(0, feedScrollState.get(feedUri));
      } else {
        window.scrollTo(0, 0);
      }
      if (!dataLayer.hasCachedFeed(feedUri)) {
        await loadCurrentFeed();
      }
      // Trigger post seen checks for the new feed
      const postSeenObserver = postSeenObservers.get(feedUri);
      if (postSeenObserver) {
        postSeenObserver.checkAllIntersections();
      }
    }

    function feedErrorTemplate({ feedGenerator }) {
      return html`<div class="error-state">
        <div>
          An issue occurred when contacting the feed server.<br />
          Please let the feed owner know about this issue.<br />
          ${feedGenerator.creator
            ? html`<a href=${linkToProfile(feedGenerator.creator)}
                >View profile</a
              >`
            : ""}
        </div>
      </div>`;
    }

    pageEffect(root, () => {
      const showLessInteractions =
        dataLayer.derived.$showLessInteractions.get() ?? [];
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item,
      );
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const currentUser = dataLayer.derived.$currentUser.get();
      const feedGenerators =
        dataLayer.derived.$hydratedPinnedFeedGenerators.get() ?? [];
      const currentFeedUri = $currentFeedUri.get();
      const feedGenerator =
        feedGenerators.find((fg) => fg.uri === currentFeedUri) ?? null;
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
            pluginService,
            children: html` ${headerTemplate({
                leftButton: "menu",
                onClickMenuButton: () => handleMenuClick(),
                bottomItemTemplate: () => html`
                  <div class="tab-bar-horizontal-scroll-container">
                    ${tabBarTemplate({
                      tabs: feedGenerators.map((fg) => ({
                        value: fg.uri,
                        label: fg.displayName,
                      })),
                      activeTab: currentFeedUri,
                      onTabClick: handleTabClick,
                    })}
                  </div>
                `,
              })}
              <main>
                ${(() => {
                  if (!feedGenerator) {
                    return null;
                  }
                  const acceptsInteractions =
                    feedGenerator.acceptsInteractions ||
                    feedGenerator.uri === DISCOVER_FEED_URI;
                  const feed = dataLayer.derived.$hydratedFeeds
                    .get(feedGenerator.uri)
                    .get();
                  const feedRequestStatus =
                    dataLayer.requests.statusStore.$statuses
                      .get("loadNextFeedPage-" + feedGenerator.uri)
                      .get();
                  return html`<div
                    class="feed-container"
                    ?hidden=${currentFeedUri !== feedGenerator.uri}
                  >
                    ${feedRequestStatus.error
                      ? feedErrorTemplate({ feedGenerator })
                      : postFeedTemplate({
                          feed,
                          currentUser,
                          isAuthenticated,
                          feedGenerator,
                          hiddenPostUris,
                          postInteractionHandler,
                          onClickShowLess: (post, feedContext) =>
                            handleShowLess(post, feedContext, feedGenerator),
                          onClickShowMore: (post, feedContext) =>
                            handleShowMore(post, feedContext, feedGenerator),
                          enableFeedFeedback: acceptsInteractions,
                          onLoadMore: () => loadCurrentFeed(),
                          pluginService,
                          showEndMessage: true,
                        })}
                  </div>`;
                })()}
              </main>`,
          })}
        </div>`,
        root,
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
    });

    async function loadCurrentFeed({ reload = false } = {}) {
      const currentFeedUri = $currentFeedUri.get();
      await dataLayer.requests.loadNextFeedPage(currentFeedUri, {
        reload,
        limit: FEED_PAGE_SIZE + 1,
      });
    }

    async function preloadHiddenFeeds(pinnedFeedGenerators) {
      const currentFeedUri = $currentFeedUri.get();
      const feedsToPreload = pinnedFeedGenerators
        .filter((feed) => feed.uri !== currentFeedUri)
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
      const currentFeedUri = $currentFeedUri.get();
      await dataLayer.declarative
        .ensurePinnedFeedGenerators()
        .then((pinnedFeedGenerators) => {
          // If the current feed is not in the pinned feed generators, reset to default feed
          if (
            !pinnedFeedGenerators.some((feed) => feed.uri === currentFeedUri)
          ) {
            resetToDefaultFeed();
          }

          preloadHiddenFeeds(pinnedFeedGenerators);
          initializePostSeenObservers(pinnedFeedGenerators);
          scrollActiveTabIntoView();
          window.scrollTo(0, 0);
        });

      // Ensure current user before loading feed to prevent flash of unfiltered feed
      let currentUser = null;
      if (isAuthenticated) {
        currentUser = await dataLayer.declarative.ensureCurrentUser();
      }

      // If /intent/compose, open the post composer and redirect to root
      const url = new URL(window.location);
      if (url.pathname === "/intent/compose" && currentUser) {
        postComposerService.composePost({ currentUser });
        window.history.replaceState(null, "", "/");
      }

      await loadCurrentFeed();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new HomeView();
