import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { requireAuth } from "/js/auth.js";
import { classnames } from "/js/utils.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import { HASHTAG_FEED_PAGE_SIZE } from "/js/config.js";

class HashtagView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
    },
  }) {
    await requireAuth();

    const hashtag = params.tag;

    const sortOptions = [
      { value: "top", label: "Top" },
      { value: "latest", label: "Latest" },
    ];

    const state = {
      currentSort: "top",
    };

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
      await loadCurrentFeed({ reload: true });
    }

    async function handleTabClick(sortValue) {
      if (sortValue === state.currentSort) {
        scrollAndReloadFeed();
        return;
      }
      // Save scroll state
      feedScrollState.set(state.currentSort, window.scrollY);
      // Switch sort
      state.currentSort = sortValue;
      renderPage();
      // Scroll to saved scroll state
      if (feedScrollState.has(state.currentSort)) {
        window.scrollTo(0, feedScrollState.get(state.currentSort));
      } else {
        window.scrollTo(0, 0);
      }
      // Load feed if not cached
      const feed = dataLayer.selectors.getHashtagFeed(
        hashtag,
        state.currentSort
      );
      if (!feed) {
        await loadCurrentFeed();
      }
    }

    async function renderPage() {
      const numNotifications = notificationService.getNumNotifications();
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const currentUser = dataLayer.selectors.getCurrentUser();
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
            children: html` <main>
              ${textHeaderTemplate({ title: `#${hashtag}` })}
              <div class="hashtag-tab-bar-container">
                <div class="tab-bar">
                  ${sortOptions.map(
                    (sort) =>
                      html`<button
                        class=${classnames("tab-bar-button", {
                          active: state.currentSort === sort.value,
                        })}
                        @click=${() => handleTabClick(sort.value)}
                      >
                        ${sort.label}
                      </button>`
                  )}
                </div>
              </div>
              ${sortOptions.map((sort) => {
                const feed = dataLayer.selectors.getHashtagFeed(
                  hashtag,
                  sort.value
                );
                return html`<div
                  class="feed-container"
                  ?hidden=${state.currentSort !== sort.value}
                >
                  ${postFeedTemplate({
                    feed,
                    currentUser,
                    postInteractionHandler,
                    enableFeedFeedback: false,
                    onLoadMore: () => loadCurrentFeed(),
                  })}
                </div>`;
              })}
            </main>`,
          })}
        </div>`,
        root
      );
    }

    async function loadCurrentFeed({ reload = false } = {}) {
      await dataLayer.requests.loadHashtagFeed(hashtag, state.currentSort, {
        reload,
        limit: HASHTAG_FEED_PAGE_SIZE,
      });
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      // Initial empty state
      renderPage();
      dataLayer.declarations.ensureCurrentUser().then(() => {
        renderPage();
      });
      await loadCurrentFeed();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
      renderPage();
    });

    notificationService.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new HashtagView();
