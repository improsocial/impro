import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { HASHTAG_FEED_PAGE_SIZE } from "/js/config.js";
import { pageEffect } from "/js/router.js";
import { Signal } from "/js/signals.js";

class HashtagView extends View {
  async render({
    root,
    params,
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
    await auth.requireAuth();

    const hashtag = params.tag;

    const sortOptions = [
      { value: "top", label: "Top" },
      { value: "latest", label: "Latest" },
    ];

    const $currentSort = new Signal.State("top");

    const { postInteractionHandler } = interactionHandlers;

    const feedScrollState = new Map();

    async function scrollAndReloadFeed() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
      await loadCurrentFeed({ reload: true });
    }

    async function handleTabClick(sortValue) {
      const currentSort = $currentSort.get();
      if (sortValue === currentSort) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(currentSort, window.scrollY);
      // Switch sort
      $currentSort.set(sortValue);
      // Scroll to saved scroll state
      if (feedScrollState.has(sortValue)) {
        window.scrollTo(0, feedScrollState.get(sortValue));
      } else {
        window.scrollTo(0, 0);
      }
      // Load feed if not cached
      const hashtagKey = `${hashtag}-${sortValue}`;
      const feed = dataLayer.derived.$hydratedHashtagFeeds.get(hashtagKey);
      if (!feed) {
        await loadCurrentFeed();
      }
    }

    pageEffect(root, () => {
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const currentUser = dataLayer.derived.$currentUser.get();
      const currentSort = $currentSort.get();
      render(
        html`<div id="hashtag-view">
          ${mainLayoutTemplate({
            onClickActiveNavItem: () => {
              scrollAndReloadFeed();
            },
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            numNotifications,
            numChatNotifications,
            currentUser,
            activeNavItem: null,
            pluginService,
            children: html` <main>
              ${headerTemplate({
                title: `#${hashtag}`,
                bottomItemTemplate: () =>
                  tabBarTemplate({
                    tabs: sortOptions,
                    activeTab: currentSort,
                    onTabClick: handleTabClick,
                    fullWidth: true,
                  }),
              })}
              ${sortOptions.map((sort) => {
                const feed = dataLayer.derived.$hydratedHashtagFeeds.get(
                  `${hashtag}-${sort.value}`,
                );
                return html`<div
                  class="feed-container"
                  ?hidden=${currentSort !== sort.value}
                >
                  ${postFeedTemplate({
                    feed,
                    currentUser,
                    isAuthenticated,
                    postInteractionHandler,
                    enableFeedFeedback: false,
                    onLoadMore: () => loadCurrentFeed(),
                    pluginService,
                  })}
                </div>`;
              })}
            </main>`,
          })}
        </div>`,
        root,
      );
    });

    async function loadCurrentFeed({ reload = false } = {}) {
      await dataLayer.requests.loadHashtagFeed(hashtag, $currentSort.get(), {
        reload,
        limit: HASHTAG_FEED_PAGE_SIZE,
      });
    }

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await loadCurrentFeed();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new HashtagView();
