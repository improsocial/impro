import { html, render } from "/js/lib/lit-html.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
} from "/js/router.js";
import { BOOKMARKS_PAGE_SIZE } from "/js/config.js";

export default async function bookmarksView({
  root,
  layout,
  context: {
    auth,
    dataLayer,
    isAuthenticated,
    pluginService,
    interactionHandlers,
  },
}) {
  await auth.requireAuth();

  const { postInteractionHandler } = interactionHandlers;

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });

  bindToPage(root, layout, "active-nav-click", () => {
    loadPageData();
  });

  bindPageTitle(root, () => "Saved Posts");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const bookmarks = dataLayer.derived.$hydratedBookmarks.get();

    render(
      html`<div id="bookmarks-view">
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

  function loadPageData() {
    loadBookmarks({ reload: true });
  }
}
