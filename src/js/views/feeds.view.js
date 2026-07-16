import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { feedGeneratorListItemSkeletonTemplate } from "/js/templates/feedGeneratorListItemSkeleton.template.js";
import { menuIconTemplate } from "/js/templates/icons/menuIcon.template.js";
import { settingsIconTemplate } from "/js/templates/icons/settingsIcon.template.js";
import { homeIconTemplate } from "/js/templates/icons/homeIcon.template.js";
import { linkToList, linkToFeed } from "/js/navigation.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { enableReorder } from "/js/utils.js";
import { showToast } from "/js/toasts.js";
import { valueForPinnedItem } from "/js/dataHelpers.js";
import "/js/components/container-link.js";

class FeedsView extends View {
  async render({ root, context: { dataLayer } }) {
    await auth.requireAuth();

    const state = new ReactiveStore("feedsView");
    state.$draftOrder = new Signal.State(null);
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
      const draft = state.$draftOrder.get();
      if (draft) {
        state.$isSaving.set(true);
        try {
          await dataLayer.mutations.reorderPinnedItems(draft);
        } catch {
          showToast("Couldn't save feed order");
          return;
        } finally {
          state.$isSaving.set(false);
        }
      }
      state.$draftOrder.set(null);
      state.$isEditing.set(false);
    }

    function cancelEditing() {
      if (state.$isSaving.get()) return;
      state.$draftOrder.set(null);
      state.$isEditing.set(false);
    }

    function rowTemplate({ item, currentUser, isEditing, isSaving }) {
      const dragHandle = isEditing
        ? html`<button
            class="feeds-list-item-drag-handle"
            data-testid="feeds-list-item-drag-handle"
            aria-label="Drag to reorder"
            ?disabled=${isSaving}
          >
            ${menuIconTemplate()}
          </button>`
        : "";
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
          ${dragHandle}
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
              src=${item.data.avatar ?? "/img/list-avatar-fallback.svg"}
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
          ${dragHandle}
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
            src=${feedGenerator.avatar ?? "/img/list-avatar-fallback.svg"}
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
        ${dragHandle}
      </container-link>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const pinnedItems = dataLayer.derived.$hydratedPinnedItems.get();
      const draftOrder = state.$draftOrder.get();
      const isEditing = state.$isEditing.get();
      const isSaving = state.$isSaving.get();

      let orderedItems = pinnedItems;
      let persistedOrder = null;
      if (pinnedItems) {
        persistedOrder = pinnedItems.map(valueForPinnedItem);
        if (draftOrder) {
          const byValue = new Map(
            pinnedItems.map((it) => [valueForPinnedItem(it), it]),
          );
          orderedItems = draftOrder
            .map((value) => byValue.get(value))
            .filter(Boolean);
        }
      }

      const canEdit = (pinnedItems?.length ?? 0) >= 2;

      render(
        html`<div id="feeds-view">
          ${headerTemplate({
            title: "Feeds",
            subtitle: "",
            rightItemTemplate: () => {
              if (!canEdit) return null;
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
                class="header-edit-button"
                data-testid="feeds-edit-button"
                aria-label="Reorder feeds"
                @click=${() => state.$isEditing.set(true)}
              >
                ${settingsIconTemplate()}
              </button>`;
            },
          })}
          <main>
            <div class="feeds-list-header">Pinned Feeds</div>
            <div
              class="feeds-list"
              data-testid="feeds-list"
              ?data-editing=${isEditing}
            >
              ${orderedItems
                ? orderedItems.map((item) =>
                    rowTemplate({
                      item,
                      currentUser,
                      isEditing,
                      isSaving,
                    }),
                  )
                : Array.from({ length: 5 }).map(() =>
                    feedGeneratorListItemSkeletonTemplate(),
                  )}
            </div>
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
              state.$draftOrder.set(null);
            } else {
              state.$draftOrder.set(nextOrder);
            }
          },
        });
      } else if (listEl?.__reorderEnabled) {
        listEl.__reorderEnabled.cleanup();
      }
    });

    function resetEditingState() {
      state.$draftOrder.set(null);
      state.$isEditing.set(false);
    }

    root.addEventListener("page-enter", async () => {
      resetEditingState();
      await dataLayer.declarative.ensurePinnedItems();
    });

    root.addEventListener("page-exit", () => {
      resetEditingState();
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new FeedsView();
