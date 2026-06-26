import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import "/js/components/tab-bar.js";
import { HASHTAG_FEED_PAGE_SIZE } from "/js/config.js";
import { pageEffect } from "/js/router.js";
import { Signal, ReactiveStore } from "/js/signals.js";

class HashtagView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      isAuthenticated,
      pluginService,
      interactionHandlers,
      mainLayout,
      groupChatLinkService,
    },
  }) {
    await auth.requireAuth();

    const hashtag = params.tag;

    const sortOptions = [
      { value: "top", label: "Top" },
      { value: "latest", label: "Latest" },
    ];

    const state = new ReactiveStore("hashtagView");
    state.$currentSort = new Signal.State("top");

    const { postInteractionHandler } = interactionHandlers;

    const feedScrollState = new Map();

    async function scrollAndReloadFeed() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
      await loadCurrentFeed({ reload: true });
    }

    async function handleTabClick(sortValue) {
      const currentSort = state.$currentSort.get();
      if (sortValue === currentSort) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(currentSort, window.scrollY);
      // Switch sort
      state.$currentSort.set(sortValue);
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
      const currentUser = dataLayer.derived.$currentUser.get();
      const currentSort = state.$currentSort.get();
      render(
        html`<div id="hashtag-view">
          ${mainLayout({
            onClickActiveNavItem: () => {
              scrollAndReloadFeed();
            },
            activeNavItem: null,
            children: html` <main>
              ${headerTemplate({
                title: `#${hashtag}`,
                bottomItemTemplate: () => html`
                  <tab-bar
                    .tabs=${sortOptions}
                    active-tab=${currentSort}
                    full-width
                    @tab-click=${(event) => handleTabClick(event.detail)}
                  ></tab-bar>
                `,
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
                    groupChatLinkService,
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
      await dataLayer.requests.loadHashtagFeed(
        hashtag,
        state.$currentSort.get(),
        {
          reload,
          limit: HASHTAG_FEED_PAGE_SIZE,
        },
      );
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
