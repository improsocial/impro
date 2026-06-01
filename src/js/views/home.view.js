import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { linkToProfile } from "/js/navigation.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import "/js/components/tab-bar.js";
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
      pageEffect(root, () => {
        const currentFeedUri = $currentFeedUri.get();
        if (currentFeedUri) {
          localStorage.setItem(
            CURRENT_FEED_URI_STORAGE_KEY,
            JSON.stringify(currentFeedUri),
          );
        }
      });
    }

    function getProxyUrl(feedGenerator) {
      if (!feedGenerator.did) {
        return null;
      }
      return `${feedGenerator.did}#bsky_fg`;
    }

    const postSeenObservers = new Map();

    // Initialize post seen observers for feeds with proxy URLs
    function initializePostSeenObservers(pinnedItems) {
      if (!isAuthenticated) {
        return;
      }
      const interactableItems = pinnedItems.filter(
        (item) => item.acceptsInteractions || item.uri === DISCOVER_FEED_URI,
      );
      for (const item of interactableItems) {
        const proxyUrl = getProxyUrl(item);
        if (proxyUrl) {
          postSeenObservers.set(item.uri, new PostSeenObserver(api, proxyUrl));
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
        window.scrollTo({ top: -1, behavior: "smooth" });
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
      // Scroll to saved position for new feed
      const savedScrollY = feedScrollState.get(feedUri) ?? 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollY);
      });
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
      const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get() ?? [];
      const currentFeedUri = $currentFeedUri.get();
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
                  <tab-bar
                    .tabs=${pinnedItems.map((item) => ({
                      value: item.uri,
                      label: item.displayName,
                    }))}
                    active-tab=${currentFeedUri}
                    @tab-click=${(event) => handleTabClick(event.detail)}
                  ></tab-bar>
                `,
              })}
              <main>
                ${pinnedItems.map((item) => {
                  const acceptsInteractions =
                    item.acceptsInteractions || item.uri === DISCOVER_FEED_URI;
                  const feed = dataLayer.derived.$hydratedFeeds.get(item.uri);
                  const feedRequestStatus =
                    dataLayer.requests.statusStore.$statuses.get(
                      "loadNextFeedPage-" + item.uri,
                    );
                  return html`<div
                    class="feed-container"
                    ?hidden=${currentFeedUri !== item.uri}
                  >
                    ${feedRequestStatus.error
                      ? feedErrorTemplate({ feedGenerator: item })
                      : postFeedTemplate({
                          feed,
                          currentUser,
                          isAuthenticated,
                          feedGenerator: item,
                          hiddenPostUris,
                          postInteractionHandler,
                          onClickShowLess: (post, feedContext) =>
                            handleShowLess(post, feedContext, item),
                          onClickShowMore: (post, feedContext) =>
                            handleShowMore(post, feedContext, item),
                          enableFeedFeedback: acceptsInteractions,
                          onLoadMore: () => loadCurrentFeed(),
                          pluginService,
                          showEndMessage: true,
                        })}
                  </div>`;
                })}
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

    async function preloadHiddenFeeds(pinnedItems) {
      const currentFeedUri = $currentFeedUri.get();
      const itemsToPreload = pinnedItems
        .filter((item) => item.uri !== currentFeedUri)
        .slice(0, 5); // Up to 5 feeds
      for (const item of itemsToPreload) {
        await dataLayer.requests.loadNextFeedPage(item.uri, {
          limit: FEED_PAGE_SIZE + 1,
        });
      }
    }

    root.addEventListener("page-enter", async () => {
      window.scrollTo(0, 0);
      const currentFeedUri = $currentFeedUri.get();
      await dataLayer.declarative.ensurePinnedItems().then((pinnedItems) => {
        if (!pinnedItems.some((item) => item.uri === currentFeedUri)) {
          resetToDefaultFeed();
        }

        preloadHiddenFeeds(pinnedItems);
        initializePostSeenObservers(pinnedItems);
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
