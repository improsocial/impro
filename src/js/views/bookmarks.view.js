import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { pageEffect } from "/js/router.js";
import { BOOKMARKS_PAGE_SIZE } from "/js/config.js";

class BookmarksView extends View {
  async render({
    root,
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

    const { postInteractionHandler } = interactionHandlers;

    async function scrollAndReloadBookmarks() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
      await loadBookmarks({ reload: true });
    }

    pageEffect(root, () => {
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const currentUser = dataLayer.derived.$currentUser.get();
      const bookmarks = dataLayer.derived.$hydratedBookmarks.get();

      render(
        html`<div id="bookmarks-view">
          ${mainLayoutTemplate({
            onClickActiveNavItem: () => {
              scrollAndReloadBookmarks();
            },
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            numNotifications,
            numChatNotifications,
            currentUser,
            activeNavItem: "bookmarks",
            pluginService,
            children: html`
              ${headerTemplate({ title: "Saved Posts" })}
              <main>
                ${postFeedTemplate({
                  feed: bookmarks,
                  currentUser,
                  isAuthenticated,
                  onLoadMore: () => loadBookmarks(),
                  postInteractionHandler,
                  emptyMessage: "No saved posts yet!",
                  pluginService,
                })}
              </main>
            `,
          })}
        </div>`,
        root,
      );
    });

    async function loadBookmarks({ reload = false } = {}) {
      await dataLayer.requests.loadBookmarks({
        reload,
        limit: BOOKMARKS_PAGE_SIZE + 1,
      });
    }

    root.addEventListener("page-enter", async () => {
      window.scrollTo(0, 0);
      dataLayer.declarative.ensureCurrentUser();
      await loadBookmarks();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new BookmarksView();
