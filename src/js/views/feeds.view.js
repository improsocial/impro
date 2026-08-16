import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
  onPageHide,
} from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { feedsFeedTemplate } from "/js/templates/feedsFeed.template.js";
import { menuIconTemplate } from "/js/templates/icons/menuIcon.template.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { homeIconTemplate } from "/js/templates/icons/homeIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { linkToList, linkToFeed } from "/js/navigation.js";
import { Signal, ReactiveStore, SignalSet, SignalArray } from "/js/signals.js";
import { enableReorder } from "/js/utils.js";
import { showToast } from "/js/toasts.js";
import { cdnImageUrl, valueForPinnedItem } from "/js/dataHelpers.js";
import "/js/components/container-link.js";

export default async function feedsView({
  root,
  layout,
  context: { auth, dataLayer },
}) {
  await auth.requireAuth();

  const state = new ReactiveStore("feedsView");
  state.$draftOrder = new SignalArray();
  state.$draftUnpinned = new SignalSet();
  state.$isEditing = new Signal.State(false);
  state.$isSaving = new Signal.State(false);

  function orderMatches(orderA, orderB) {
    if (orderA.length !== orderB.length) return false;
    for (let i = 0; i < orderA.length; i++) {
      if (orderA[i] !== orderB[i]) return false;
    }
    return true;
  }

  async function handleSave() {
    if (state.$isSaving.get()) return;
    const draftOrder = state.$draftOrder;
    const draftUnpinned = state.$draftUnpinned;
    if (draftOrder.length > 0 || draftUnpinned.size > 0) {
      const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get();
      if (!pinnedItems) return;
      const baseOrder =
        draftOrder.length > 0
          ? [...draftOrder]
          : pinnedItems.map(valueForPinnedItem);
      const nextValues =
        draftUnpinned.size > 0
          ? baseOrder.filter((value) => !draftUnpinned.has(value))
          : baseOrder;
      state.$isSaving.set(true);
      try {
        await dataLayer.mutations.setPinnedItems(nextValues);
        showToast("Feeds updated!");
      } catch {
        showToast("Couldn't save changes");
        return;
      } finally {
        state.$isSaving.set(false);
      }
    }
    state.$draftOrder.clear();
    state.$draftUnpinned.clear();
    state.$isEditing.set(false);
  }

  function cancelEditing() {
    if (state.$isSaving.get()) return;
    state.$draftOrder.clear();
    state.$draftUnpinned.clear();
    state.$isEditing.set(false);
  }

  function editControlsTemplate({ value, isSaving, showUnpin }) {
    return html`${showUnpin
        ? html`<button
            class="feeds-list-item-unpin-button"
            data-testid="feeds-list-item-unpin-button"
            aria-label="Unpin"
            ?disabled=${isSaving}
            @click=${(e) => {
              e.preventDefault();
              e.stopPropagation();
              state.$draftUnpinned.add(value);
            }}
          >
            ${pinIconTemplate({ filled: true })}
          </button>`
        : ""}
      <button
        class="feeds-list-item-drag-handle"
        data-testid="feeds-list-item-drag-handle"
        aria-label="Drag to reorder"
        ?disabled=${isSaving}
      >
        ${menuIconTemplate()}
      </button>`;
  }

  function rowTemplate({ item, currentUser, rightItem }) {
    const value = valueForPinnedItem(item);
    if (item.type === "timeline") {
      return html`<div
        class="feeds-list-item"
        data-pinned-value=${value}
        data-testid="feeds-list-item-following"
      >
        <div class="feeds-list-item-avatar following-avatar">
          ${homeIconTemplate({ filled: true })}
        </div>
        <div class="feeds-list-item-content">
          <div class="feeds-list-item-title">Following</div>
          <div class="feeds-list-item-creator">Feed by @bsky.app</div>
        </div>
        ${rightItem}
      </div>`;
    }
    if (item.type === "list") {
      return html`<container-link
        class="feeds-list-item clickable"
        data-testid="feeds-list-item-list"
        data-pinned-value=${value}
        href=${linkToList(item.data)}
      >
        <div class="feeds-list-item-avatar">
          <img
            src=${cdnImageUrl(item.data.avatar) ??
            "/img/list-avatar-fallback.svg"}
            alt=${item.data.name}
            class="feed-avatar"
          />
        </div>
        <div class="feeds-list-item-content">
          <div class="feeds-list-item-title">${item.data.name}</div>
          ${item.data.creator
            ? html`<div class="feeds-list-item-creator">
                List by
                ${item.data.creator.did === currentUser?.did
                  ? "you"
                  : `@${item.data.creator.handle}`}
              </div>`
            : ""}
        </div>
        ${rightItem}
      </container-link>`;
    }
    const feedGenerator = item.data;
    return html`<container-link
      class="feeds-list-item clickable"
      data-testid="feeds-list-item-feed"
      data-pinned-value=${value}
      href=${linkToFeed(feedGenerator)}
    >
      <div class="feeds-list-item-avatar">
        <img
          src=${cdnImageUrl(feedGenerator.avatar) ??
          "/img/feed-avatar-fallback.svg"}
          alt=${feedGenerator.displayName}
          class="feed-avatar"
        />
      </div>
      <div class="feeds-list-item-content">
        <div class="feeds-list-item-title">${feedGenerator.displayName}</div>
        ${feedGenerator.creator
          ? html`<div class="feeds-list-item-creator">
              Feed by
              ${feedGenerator.creator.did === currentUser?.did
                ? "you"
                : `@${feedGenerator.creator.handle}`}
            </div>`
          : ""}
      </div>
      ${rightItem}
    </container-link>`;
  }

  bindPageTitle(root, () => "Feeds");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get();
    const draftOrder = state.$draftOrder;
    const draftUnpinned = state.$draftUnpinned;
    const isEditing = state.$isEditing.get();
    const isSaving = state.$isSaving.get();

    let orderedItems = pinnedItems;
    let persistedOrder = null;
    if (pinnedItems) {
      persistedOrder = pinnedItems.map(valueForPinnedItem);
      if (draftOrder.length > 0) {
        const byValue = new Map(
          pinnedItems.map((it) => [valueForPinnedItem(it), it]),
        );
        orderedItems = draftOrder
          .map((value) => byValue.get(value))
          .filter(Boolean);
      }
      if (draftUnpinned.size > 0) {
        orderedItems = orderedItems.filter(
          (it) => !draftUnpinned.has(valueForPinnedItem(it)),
        );
      }
    }

    const canEdit = (pinnedItems?.length ?? 0) >= 2;
    const showUnpin = (orderedItems?.length ?? 0) >= 2;

    render(
      html`<div id="feeds-view">
        ${headerTemplate({
          title: "Feeds",
          subtitle: "",
          rightItemTemplate: () => {
            if (isEditing) {
              return html`<div class="header-actions">
                <button
                  class="rounded-button feeds-cancel-button"
                  data-testid="feeds-cancel-button"
                  ?disabled=${isSaving}
                  @click=${cancelEditing}
                >
                  Cancel
                </button>
                <button
                  class="rounded-button rounded-button-primary feeds-save-button"
                  data-testid="feeds-save-button"
                  ?disabled=${isSaving}
                  @click=${handleSave}
                >
                  ${isSaving
                    ? html`Saving<span class="loading-spinner"></span>`
                    : "Save"}
                </button>
              </div>`;
            }
            return html`<button
              class="icon-button header-edit-button"
              data-testid="feeds-edit-button"
              aria-label="Edit feeds"
              @click=${() => state.$isEditing.set(true)}
              ?disabled=${!canEdit}
            >
              ${settingsIconTemplate()}
            </button>`;
          },
        })}
        <main>
          <div class="feeds-list-header">Pinned Feeds</div>
          ${feedsFeedTemplate({
            items: orderedItems,
            renderItem: (item) => {
              const value = valueForPinnedItem(item);
              const rightItem = isEditing
                ? editControlsTemplate({ value, isSaving, showUnpin })
                : item.type === "timeline"
                  ? ""
                  : html`<div class="feeds-list-item-chevron">
                      ${chevronRightIconTemplate()}
                    </div>`;
              return rowTemplate({ item, currentUser, rightItem });
            },
            isEditing,
          })}
        </main>
      </div>`,
      root,
    );

    const listEl = root.querySelector(".feeds-list");
    if (listEl && orderedItems && isEditing && !isSaving) {
      enableReorder(listEl, {
        itemSelector: ".feeds-list-item",
        handleSelector: ".feeds-list-item-drag-handle",
        onReorder: (elements) => {
          const nextOrder = elements.map((el) => el.dataset.pinnedValue);
          const baseline = persistedOrder ?? [];
          if (orderMatches(nextOrder, baseline)) {
            state.$draftOrder.clear();
          } else {
            state.$draftOrder.replace(nextOrder);
          }
        },
      });
    } else if (listEl?.__reorderEnabled) {
      listEl.__reorderEnabled.cleanup();
    }
  });

  function resetEditingState() {
    state.$draftOrder.clear();
    state.$draftUnpinned.clear();
    state.$isEditing.set(false);
  }

  // Reset whenever the page changes visibility, unlike the data load below
  onPageShow(root, resetEditingState);
  onPageHide(root, resetEditingState);

  function loadPageData() {
    dataLayer.requests.loadPinnedItems();
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });

  bindToPage(root, layout, "active-nav-click", () => {
    loadPageData();
  });
}
