import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { bindToPage } from "/js/router.js";
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
    bindToPage(root, interactionHandlers, "requestRender", () => renderPage());

    async function scrollAndReloadBookmarks() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      await loadBookmarks({ reload: true });
    }

    function renderPage() {
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const currentUser = dataLayer.selectors.getCurrentUser();
      const bookmarks = dataLayer.selectors.getBookmarks();

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
    }

    async function loadBookmarks({ reload = false } = {}) {
      await dataLayer.requests.loadBookmarks({
        reload,
        limit: BOOKMARKS_PAGE_SIZE + 1,
      });
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      window.scrollTo(0, 0);

      // Initial empty state
      renderPage();

      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });

      await loadBookmarks();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
      renderPage();
    });

    bindToPage(root, notificationService, "update", () => renderPage());

    bindToPage(root, chatNotificationService, "update", () => renderPage());
  }
}

export default new BookmarksView();
