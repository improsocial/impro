import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { listFeedTemplate } from "/js/templates/listFeed.template.js";
import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
} from "/js/router.js";
import { showToast } from "/js/toasts.js";
import { parseUri } from "/js/dataHelpers.js";
import "/js/components/create-list-dialog.js";

export default async function listsView({
  root,
  layout,
  context: { auth, dataLayer },
}) {
  await auth.requireAuth();

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });

  bindToPage(root, layout, "active-nav-click", () => {
    loadPageData();
  });

  bindPageTitle(root, () => "Lists");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const actorLists = currentUser
      ? dataLayer.derived.$actorLists.get(currentUser.did)
      : null;

    render(
      html`<div id="lists-view">
        ${headerTemplate({
          title: "Lists",
          rightItemTemplate: () => html`
            <button
              class="rounded-button rounded-button-secondary new-list-button"
              data-testid="new-list-button"
              @click=${() => handleClickNew({ currentUser })}
            >
              + New
            </button>
          `,
        })}
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

  function loadPageData() {
    loadLists({ reload: true });
  }

  async function handleClickNew({ currentUser }) {
    const dialog = document.createElement("create-list-dialog");
    dialog.addEventListener("list-create", async (event) => {
      const { listData, successCallback, errorCallback } = event.detail;
      try {
        const list = await dataLayer.mutations.createList({
          ...listData,
          currentUser,
        });
        showToast("List created");
        successCallback();
        const { rkey } = parseUri(list.uri);
        window.router.go(`/profile/${currentUser.handle}/lists/${rkey}`);
      } catch (error) {
        errorCallback(error);
      }
    });
    dialog.addEventListener("create-list-closed", () => {
      dialog.remove();
    });
    root.querySelector("main").appendChild(dialog);
    dialog.open();
  }
}
