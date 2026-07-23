import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { listFeedTemplate } from "/js/templates/listFeed.template.js";
import { bindToPage, pageEffect } from "/js/router.js";

class ListsView extends View {
  async render({ root, layout, context: { dataLayer } }) {
    await auth.requireAuth();

    async function scrollAndReloadLists() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: -1, behavior: "smooth" });
      }
      await loadLists({ reload: true });
    }

    bindToPage(root, layout, "active-nav-click", (event) => {
      event.preventDefault();
      scrollAndReloadLists();
    });

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const actorLists = currentUser
        ? dataLayer.derived.$actorLists.get(currentUser.did)
        : null;

      render(
        html`<div id="lists-view">
          ${headerTemplate({ title: "Lists" })}
          <main>
            ${listFeedTemplate({
              lists: actorLists?.lists,
              cursor: actorLists?.cursor,
              onLoadMore: () => loadLists(),
            })}
          </main>
        </div>`,
        root,
      );
    });

    async function loadLists({ reload = false } = {}) {
      await dataLayer.requests.loadCurrentUserLists({ reload });
    }

    root.addEventListener("page-enter", async () => {
      window.scrollTo(0, 0);
      await loadLists();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
        await loadLists({ reload: true });
      }
    });
  }
}

export default new ListsView();
