import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { classnames } from "/js/utils.js";
import { isModerationList } from "/js/dataHelpers.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import "/js/components/tab-bar.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { pageEffect } from "/js/router.js";
import { FEED_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";

class ListDetailView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      identityResolver,
      notificationService,
      chatNotificationService,
      postComposerService,
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

    const { postInteractionHandler, listInteractionHandler } =
      interactionHandlers;

    const state = new ReactiveStore("listDetailView");
    state.$activeTab = new Signal.State("posts");

    pageEffect(root, () => {
      const showLessInteractions =
        dataLayer.derived.$showLessInteractions.get() ?? [];
      const hiddenPostUris = showLessInteractions.map(
        (interaction) => interaction.item,
      );
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
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

      const listPermalink = `https://bsky.app/profile/${listCreatorHandle || handleOrDid}/lists/${rkey}`;

      render(
        html`<div id="list-detail-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            showSidebarOverlay: false,
            numNotifications,
            numChatNotifications,
            currentUser,
            pluginService,
            children: html`${headerTemplate({
              rightItemTemplate: list
                ? () => html`
                    <button
                      class="list-menu-button"
                      @click=${function (e) {
                        const contextMenu = this.nextElementSibling;
                        contextMenu.open(e.clientX, e.clientY);
                      }}
                    >
                      <span>...</span>
                    </button>
                    <context-menu>
                      <context-menu-item
                        data-testid="menu-action-list-open-in-bsky"
                        @click=${() => {
                          window.open(listPermalink, "_blank");
                        }}
                      >
                        Open in bsky.app
                      </context-menu-item>
                      <context-menu-item
                        data-testid="menu-action-list-copy-link"
                        @click=${() => {
                          navigator.clipboard.writeText(listPermalink);
                          showToast("Link copied to clipboard", {
                            style: "success",
                          });
                        }}
                      >
                        Copy link to list
                      </context-menu-item>
                    </context-menu>
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
                      : ""}
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
                            ${isModerationList(list)
                              ? "Moderation list"
                              : "List"}
                            by @${listCreator.handle}
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
                    : ""}
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
                        </div>`
                      : html`<div class="list-members-container">
                          ${profileFeedTemplate({
                            profiles: members,
                            hasMore: hasMoreMembers,
                            onLoadMore: () => loadMembers(),
                            emptyMessage: "This list has no members.",
                            showEndMessage: true,
                          })}
                        </div>`}
                  </div>
                </main>`}`,
          })}
        </div>`,
        root,
      );
    });

    async function loadFeed({ reload = false } = {}) {
      await dataLayer.requests.loadNextFeedPage(listUri, {
        reload,
        limit: FEED_PAGE_SIZE + 1,
      });
    }

    async function loadMembers({ reload = false } = {}) {
      await dataLayer.requests.loadListMembers(listUri, { reload });
    }

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await Promise.all([
        dataLayer.declarative.ensureList(listUri),
        loadFeed(),
        loadMembers(),
      ]);
    });

    root.addEventListener("page-restore", (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      window.scrollTo(0, scrollY);
    });
  }
}

export default new ListDetailView();
