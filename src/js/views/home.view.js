import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { linkToProfile } from "/js/navigation.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { hashtagIconTemplate } from "/js/templates/icons/hashtagIcon.template.js";
import { floatingComposeButtonTemplate } from "/js/templates/floatingComposeButton.template.js";
import "/js/components/tab-bar.js";
import { PostSeenObserver } from "/js/postSeenObserver.js";
import {
  FEED_PAGE_SIZE,
  FOLLOWING_FEED_URI,
  LOGGED_OUT_FEED_URI,
} from "/js/config.js";
import { bindToPage, pageEffect } from "/js/router.js";
import { showToast } from "/js/toasts.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { WelcomeModal } from "/js/modals/welcome.modal.js";

class HomeView extends View {
  async render({
    root,
    layout,
    context: {
      dataLayer,
      api,
      postComposerService,
      isAuthenticated,
      pluginService,
      interactionHandlers,
    },
  }) {
    const CURRENT_FEED_URI_STORAGE_KEY = "home-view-currentFeedUri";
    const WELCOME_MODAL_SEEN_STORAGE_KEY = "welcome-modal-seen";

    const storedFeedUri = isAuthenticated
      ? localStorage.getItem(CURRENT_FEED_URI_STORAGE_KEY)
      : null;

    const state = new ReactiveStore("homeView");
    state.$currentFeedUri = new Signal.State(
      storedFeedUri ? JSON.parse(storedFeedUri) : null,
    );
    state.$isReloadingFeed = new Signal.State(false);

    function resetToDefaultFeed() {
      state.$currentFeedUri.set(
        isAuthenticated ? FOLLOWING_FEED_URI : LOGGED_OUT_FEED_URI,
      );
    }

    if (!state.$currentFeedUri.get()) {
      resetToDefaultFeed();
    }

    if (
      !isAuthenticated &&
      !pluginService.isPreviewMode &&
      !sessionStorage.getItem(WELCOME_MODAL_SEEN_STORAGE_KEY)
    ) {
      sessionStorage.setItem(WELCOME_MODAL_SEEN_STORAGE_KEY, "true");
      WelcomeModal.open();
    }

    if (isAuthenticated) {
      pageEffect(root, () => {
        const currentFeedUri = state.$currentFeedUri.get();
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
        (item) => item.acceptsInteractions || item.uri === LOGGED_OUT_FEED_URI,
      );
      for (const observer of postSeenObservers.values()) {
        observer.disconnect();
      }
      postSeenObservers.clear();
      for (const item of interactableItems) {
        const proxyUrl = getProxyUrl(item);
        if (proxyUrl) {
          postSeenObservers.set(item.uri, new PostSeenObserver(api, proxyUrl));
        }
      }
    }

    async function handleMenuClick() {
      layout.openSidebar();
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
      state.$isReloadingFeed.set(true);
      try {
        await loadCurrentFeed({ reload: true });
      } finally {
        state.$isReloadingFeed.set(false);
      }
    }

    async function handleTabClick(feedUri) {
      let currentFeedUri = state.$currentFeedUri.get();
      if (feedUri === currentFeedUri) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(currentFeedUri, window.scrollY);
      // Switch feed
      state.$currentFeedUri.set(feedUri);
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
                ><br />`
            : ""}
          <button @click=${() => window.location.reload()}>Try again</button>
        </div>
      </div>`;
    }

    bindToPage(root, layout, "active-nav-click", (event) => {
      event.preventDefault();
      scrollAndReloadFeed();
    });

    pageEffect(root, () => {
      const showLessInteractions =
        dataLayer.derived.$showLessInteractions.get() ?? [];
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item,
      );
      const currentUser = dataLayer.derived.$currentUser.get();
      const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get() ?? [];
      const currentFeedUri = state.$currentFeedUri.get();
      const currentFeedRequestStatus =
        dataLayer.requests.statusStore.$statuses.get(
          "loadNextFeedPage-" + currentFeedUri,
        );
      const isLoading =
        currentFeedRequestStatus.loading &&
        state.$isReloadingFeed.get() &&
        !!dataLayer.derived.$hydratedFeeds.get(currentFeedUri);
      render(
        html`<div id="home-view">
          ${headerTemplate({
            showLoadingSpinner: isLoading,
            leftButton: "menu",
            onClickMenuButton: () => handleMenuClick(),
            rightItemTemplate: () => html`
              <a
                class="header-icon-button feeds-button"
                href="/feeds"
                aria-label="Feeds"
                data-testid="feeds-button"
              >
                ${hashtagIconTemplate()}
              </a>
            `,
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
                item.acceptsInteractions || item.uri === LOGGED_OUT_FEED_URI;
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
          </main>
          ${currentUser
            ? floatingComposeButtonTemplate({
                onClick: () => postComposerService.composePost({ currentUser }),
              })
            : ""}
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

    function getFeedRequestDescriptor(uri) {
      const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get() ?? [];
      const item = pinnedItems.find((i) => i.uri === uri);
      return item ? { type: item.type, uri } : { type: "feed", uri };
    }

    async function loadCurrentFeed({ reload = false } = {}) {
      const currentFeedUri = state.$currentFeedUri.get();
      await dataLayer.requests.loadNextFeedPage(
        getFeedRequestDescriptor(currentFeedUri),
        { reload, limit: FEED_PAGE_SIZE + 1 },
      );
    }

    async function preloadHiddenFeeds(pinnedItems) {
      const currentFeedUri = state.$currentFeedUri.get();
      const itemsToPreload = pinnedItems
        .filter((item) => item.uri !== currentFeedUri)
        .slice(0, 3); // Up to 3 feeds
      for (const item of itemsToPreload) {
        await dataLayer.requests.loadNextFeedPage(item, {
          limit: FEED_PAGE_SIZE + 1,
        });
      }
    }

    root.addEventListener("page-enter", async () => {
      window.scrollTo(0, 0);
      const currentFeedUri = state.$currentFeedUri.get();
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
      const page = document.querySelector(".page-visible");
      page.style.opacity = "0";
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          page.style.opacity = "1";
        });
      });
      for (const observer of postSeenObservers.values()) {
        observer.connect();
      }
    });

    root.addEventListener("page-exit", () => {
      for (const observer of postSeenObservers.values()) {
        observer.disconnect();
      }
    });
  }
}

export default new HomeView();
