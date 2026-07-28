import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { classnames } from "/js/utils.js";
import { isModerationList } from "/js/dataHelpers.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { auth } from "/js/auth.js";
import { headerTemplate } from "/js/templates/header.template.js";
import "/js/components/tab-bar.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { userPlusIconTemplate } from "/js/templates/icons/userPlusIcon.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { bindToPage, pageEffect, bindPageTitle } from "/js/router.js";
import { FEED_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import "/js/components/edit-list-details-dialog.js";
import "/js/components/manage-list-members-dialog.js";

class ListDetailView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      identityResolver,
      isAuthenticated,
      pluginService,
      interactionHandlers,
    },
  }) {
    await auth.requireAuth();

    const { handleOrDid, rkey } = params;

    let profileDid = null;
    if (handleOrDid.startsWith("did:")) {
      profileDid = handleOrDid;
    } else {
      profileDid = await identityResolver.resolveHandle(handleOrDid);
    }
    const listUri = `at://${profileDid}/app.bsky.graph.list/${rkey}`;

    const {
      postInteractionHandler,
      listInteractionHandler,
      profileInteractionHandler,
    } = interactionHandlers;

    const state = new ReactiveStore("listDetailView");
    state.$activeTab = new Signal.State("posts");

    function listSubscriptionButtonTemplate({ list, listInteractionHandler }) {
      const isMuted = !!list.viewer?.muted;
      const isBlocked = !!list.viewer?.blocked;
      const isSubscribed = isMuted || isBlocked;
      const teststate = isMuted
        ? "muted"
        : isBlocked
          ? "blocked"
          : "not-subscribed";
      return html`
        <button
          class=${classnames("rounded-button", "subscribe-list-button", {
            "rounded-button-primary": !isSubscribed,
            subscribed: isSubscribed,
          })}
          data-testid="subscribe-list-button"
          data-teststate=${teststate}
          @click=${function (e) {
            if (isMuted) {
              listInteractionHandler.handleUnmuteList(list);
              return;
            }
            if (isBlocked) {
              listInteractionHandler.handleUnblockList(list);
              return;
            }
            const menu = this.nextElementSibling;
            menu.open(e.clientX, e.clientY);
          }}
        >
          ${isMuted ? "Unmute list" : isBlocked ? "Unblock list" : "Subscribe"}
        </button>
        <context-menu>
          <context-menu-item
            data-testid="menu-action-list-mute"
            icon="speaker-slash-line"
            @click=${() => listInteractionHandler.handleMuteList(list)}
          >
            Mute accounts
          </context-menu-item>
          <context-menu-item
            data-testid="menu-action-list-block"
            icon="user-x-line"
            @click=${() => listInteractionHandler.handleBlockList(list)}
          >
            Block accounts
          </context-menu-item>
        </context-menu>
      `;
    }

    bindPageTitle(root, () => {
      return dataLayer.derived.$lists.get(listUri)?.name ?? null;
    });

    pageEffect(root, () => {
      const showLessInteractions =
        dataLayer.derived.$showLessInteractions.get(listUri);
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item,
      );
      const currentUser = dataLayer.derived.$currentUser.get();
      const list = dataLayer.derived.$lists.get(listUri);
      const listCreator = list?.creator;
      const listCreatorHandle = listCreator?.handle;
      const preferences = dataLayer.derived.$preferences.get();
      const isPinned = preferences?.isFeedPinned(listUri) ?? false;
      const feed = dataLayer.derived.$hydratedFeeds.get(listUri);
      const membersEntry = dataLayer.derived.$listMembers.get(listUri);
      const members = membersEntry?.members ?? null;
      const hasMoreMembers = membersEntry?.cursor != null;
      const activeTab = state.$activeTab.get();
      const isCurateList = !isModerationList(list);
      const isCurrentUserList = listCreator?.did === currentUser?.did;
      const listPermalink = `https://bsky.app/profile/${listCreatorHandle || handleOrDid}/lists/${rkey}`;
      render(
        html`<div id="list-detail-view">
          ${headerTemplate({
            rightItemTemplate: list
              ? () => html`
                  ${isCurateList
                    ? html`<button
                        class=${classnames("pin-feed-button", {
                          pinned: isPinned,
                        })}
                        data-testid="pin-list-button"
                        data-teststate=${isPinned ? "pinned" : "not-pinned"}
                        @click=${() =>
                          listInteractionHandler.handlePinList(
                            listUri,
                            !isPinned,
                          )}
                      >
                        ${pinIconTemplate({ filled: isPinned })}
                      </button>`
                    : listSubscriptionButtonTemplate({
                        list,
                        listInteractionHandler,
                      })}
                  <button
                    class="context-menu-button"
                    @click=${function (e) {
                      const contextMenu = this.nextElementSibling;
                      contextMenu.open(e.clientX, e.clientY);
                    }}
                  >
                    <span>...</span>
                  </button>
                  <context-menu>
                    <context-menu-item-group>
                      <context-menu-item
                        data-testid="menu-action-list-open-in-bsky"
                        icon="open-line"
                        @click=${() => {
                          window.open(listPermalink, "_blank");
                        }}
                      >
                        Open in bsky.app
                      </context-menu-item>
                      <context-menu-item
                        data-testid="menu-action-list-copy-link"
                        icon="link-line"
                        @click=${() => {
                          navigator.clipboard.writeText(listPermalink);
                          showToast("Link copied to clipboard", {
                            style: "success",
                          });
                        }}
                      >
                        Copy link to list
                      </context-menu-item>
                    </context-menu-item-group>
                    ${isCurrentUserList
                      ? html`<context-menu-item
                            data-testid="menu-action-list-add-people"
                            icon="user-plus-line"
                            @click=${() => handleAddPeople(list)}
                          >
                            Add people to list
                          </context-menu-item>
                          <context-menu-item-group>
                            <context-menu-item
                              data-testid="menu-action-list-edit"
                              icon="edit-pen-2-line"
                              @click=${() => handleEditList(list)}
                            >
                              Edit list details
                            </context-menu-item>
                            <context-menu-item
                              data-testid="menu-action-list-delete"
                              icon="delete-bin-line"
                              @click=${() => handleDeleteList(list)}
                            >
                              Delete list
                            </context-menu-item>
                          </context-menu-item-group>`
                      : ""}
                  </context-menu>
                `
              : null,
          })}
          ${!list
            ? html`<main>
                <div
                  class="list-detail-loading"
                  data-testid="list-detail-loading"
                >
                  <div class="loading-spinner"></div>
                </div>
              </main>`
            : html`<main>
                <div
                  class="list-detail-header"
                  data-testid="list-detail-header"
                >
                  ${list.avatar
                    ? html`<img
                        class="list-detail-avatar"
                        src=${list.avatar}
                        alt=${list.name}
                      />`
                    : html`<img
                        class="list-detail-avatar"
                        src="/img/list-avatar-fallback.svg"
                        alt=${list.name}
                      />`}
                  <div class="list-detail-header-text">
                    <div
                      class="list-detail-name"
                      data-testid="list-detail-name"
                    >
                      ${list.name}
                    </div>
                    ${listCreator
                      ? html`<div
                          class="list-detail-creator"
                          data-testid="list-detail-creator"
                        >
                          ${isModerationList(list) ? "Moderation list" : "List"}
                          by
                          ${isCurrentUserList
                            ? "you"
                            : `@${listCreator.handle}`}
                        </div>`
                      : ""}
                  </div>
                </div>
                ${list.description
                  ? html`<div
                      class="list-detail-description"
                      data-testid="list-detail-description"
                    >
                      ${richTextTemplate({
                        text: list.description,
                        facets: list.descriptionFacets ?? [],
                      })}
                    </div>`
                  : ""}
                ${isCurateList
                  ? html`<div
                      class="list-detail-tab-bar"
                      data-scroll-lock-sticky
                    >
                      <tab-bar
                        .tabs=${[
                          { value: "posts", label: "Posts" },
                          { value: "people", label: "People" },
                        ]}
                        active-tab=${activeTab}
                        full-width
                        @tab-click=${(event) =>
                          state.$activeTab.set(event.detail)}
                      ></tab-bar>
                    </div>`
                  : html`<hr />`}
                <div
                  class="list-tab-content"
                  data-testid="list-tab-content"
                  data-teststate=${activeTab}
                >
                  ${activeTab === "posts" && isCurateList
                    ? html`<div class="feed-container">
                        ${postFeedTemplate({
                          feed,
                          currentUser,
                          isAuthenticated,
                          hiddenPostUris,
                          onLoadMore: () => loadFeed(),
                          postInteractionHandler,
                          pluginService,
                          showEndMessage: true,
                        })}
                        ${feed?.feed?.length === 0 && isCurrentUserList
                          ? html`<button
                              class="rounded-button rounded-button-primary list-empty-add-people-button"
                              data-testid="list-empty-add-people-button"
                              @click=${() => handleAddPeople(list)}
                            >
                              ${userPlusIconTemplate()} Add people to list
                            </button>`
                          : ""}
                      </div>`
                    : html`<div class="feed-container">
                        ${profileFeedTemplate({
                          profiles: members,
                          hasMore: hasMoreMembers,
                          onLoadMore: () => loadMembers(),
                          emptyMessage: "This list has no members.",
                          showEndMessage: true,
                          isAuthenticated,
                          currentUserDid: currentUser?.did ?? null,
                          profileInteractionHandler,
                          ...(isCurateList ? {} : { rightItemTemplate: null }),
                        })}
                        ${members?.length === 0 && isCurrentUserList
                          ? html`<button
                              class="rounded-button rounded-button-primary list-empty-add-people-button"
                              data-testid="list-empty-add-people-button"
                              @click=${() => handleAddPeople(list)}
                            >
                              ${userPlusIconTemplate()} Add people to list
                            </button>`
                          : ""}
                      </div>`}
                </div>
              </main>`}
        </div>`,
        root,
      );
    });

    async function handleDeleteList(list) {
      const deleted = await listInteractionHandler.handleDeleteList(list);
      if (!deleted) return;
      const fallbackRoute = list.creator?.handle
        ? `/profile/${list.creator.handle}`
        : "/";
      window.router.back({ fallbackRoute });
    }

    function handleAddPeople(list) {
      const dialog = document.createElement("manage-list-members-dialog");
      dialog.dataLayer = dataLayer;
      dialog.list = list;
      let reloadTimeout = null;
      dialog.addEventListener("dialog-closed", () => {
        clearTimeout(reloadTimeout);
        dialog.remove();
      });
      dialog.addEventListener("members-changed", () => {
        if (isModerationList(list) || userHasScrolled) return;
        clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(() => {
          if (userHasScrolled) return;
          loadFeed({ reload: true });
        }, 1000); // 1 sec delay for appview update
      });
      root.querySelector("main").appendChild(dialog);
      dialog.open();
    }

    async function handleEditList(list) {
      const dialog = document.createElement("edit-list-details-dialog");
      dialog.addEventListener("list-save", async (event) => {
        const { listUpdates, successCallback, errorCallback } = event.detail;
        try {
          await dataLayer.mutations.updateList(list, listUpdates);
          showToast("List updated");
          successCallback();
        } catch (error) {
          errorCallback(error);
        }
      });
      dialog.addEventListener("edit-list-details-closed", () => {
        dialog.remove();
      });
      root.querySelector("main").appendChild(dialog);
      dialog.setList(list);
      dialog.open();
    }

    async function loadFeed({ reload = false } = {}) {
      await dataLayer.requests.loadNextFeedPage(
        { type: "list", uri: listUri },
        { reload, limit: FEED_PAGE_SIZE + 1 },
      );
    }

    async function loadMembers({ reload = false } = {}) {
      await dataLayer.requests.loadListMembers(listUri, { reload });
    }

    async function loadListAndFeeds({ reload = false } = {}) {
      const list = await dataLayer.declarative.ensureList(listUri);
      const requests = [loadMembers({ reload })];
      if (!isModerationList(list)) {
        requests.push(loadFeed({ reload }));
      }
      await Promise.all(requests);
    }

    let userHasScrolled = false;
    const markUserScrolled = () => {
      userHasScrolled = true;
    };
    bindToPage(root, window, "touchmove", markUserScrolled);
    bindToPage(root, window, "wheel", markUserScrolled);
    bindToPage(root, window, "keydown", markUserScrolled);

    root.addEventListener("page-enter", async () => {
      userHasScrolled = false;
      await loadListAndFeeds();
    });

    root.addEventListener("page-restore", async (e) => {
      userHasScrolled = false;
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
        await loadListAndFeeds({ reload: true });
      }
    });
  }
}

export default new ListDetailView();
