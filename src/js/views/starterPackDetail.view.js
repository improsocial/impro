import { html, render } from "/js/lib/lit-html.js";
import { resolveDidFromHandleOrDid } from "/js/atproto.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { feedsFeedTemplate } from "/js/templates/feedsFeed.template.js";
import { feedGeneratorListItemTemplate } from "/js/templates/feedGeneratorListItem.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";
import {
  linkToProfile,
  linkToLogin,
  getPermalinkForStarterPack,
} from "/js/navigation.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { FEED_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import "/js/components/tab-bar.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";

function copyPermalink(permalink) {
  navigator.clipboard.writeText(permalink);
  showToast("Link copied to clipboard", { style: "success" });
}

function optOutMenuItemTemplate({ isOptedOut, onOptOut, onUndoOptOut }) {
  return html`<context-menu-item-group>
    <context-menu-item
      data-testid="menu-action-starter-pack-opt-out"
      data-teststate=${isOptedOut ? "opted-out" : "opted-in"}
      icon=${isOptedOut ? "undo-line" : "user-x-line"}
      @click=${isOptedOut ? onUndoOptOut : onOptOut}
    >
      ${isOptedOut ? "Undo opt-out" : "Opt out of starter pack"}
    </context-menu-item>
  </context-menu-item-group>`;
}

function headerMenuTemplate({
  permalink,
  showOptOut,
  isOptedOut,
  onOptOut,
  onUndoOptOut,
}) {
  return html`
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
          data-testid="menu-action-starter-pack-open-in-bsky"
          icon="open-line"
          @click=${() => {
            window.open(permalink, "_blank");
          }}
        >
          Open in bsky.app
        </context-menu-item>
        <context-menu-item
          data-testid="menu-action-starter-pack-copy-link"
          icon="link-line"
          @click=${() => copyPermalink(permalink)}
        >
          Copy link to starter pack
        </context-menu-item>
      </context-menu-item-group>
      ${showOptOut
        ? optOutMenuItemTemplate({ isOptedOut, onOptOut, onUndoOptOut })
        : ""}
    </context-menu>
  `;
}

function loadingTemplate() {
  return html`<main>
    <div
      class="starter-pack-detail-loading"
      data-testid="starter-pack-detail-loading"
    >
      <div class="loading-spinner"></div>
    </div>
  </main>`;
}

function notFoundTemplate({ onRetry }) {
  return html`<main>
    <div class="error-state" data-testid="starter-pack-not-found">
      <h3>Not Found</h3>
      <div>That starter pack could not be found.</div>
      ${tryAgainButtonTemplate({ onClick: onRetry })}
    </div>
  </main>`;
}

function headerActionTemplate({
  isOwner,
  isFollowingAll,
  permalink,
  onFollowAll,
}) {
  if (isOwner) {
    return html`<button
      class="rounded-button rounded-button-primary starter-pack-detail-action"
      data-testid="starter-pack-share"
      @click=${() => copyPermalink(permalink)}
    >
      Share
    </button>`;
  }
  return html`<button
    class="rounded-button rounded-button-primary starter-pack-detail-action"
    data-testid="starter-pack-follow-all"
    data-teststate=${isFollowingAll ? "pending" : "idle"}
    ?disabled=${isFollowingAll}
    @click=${onFollowAll}
  >
    Follow all
    ${isFollowingAll ? html`<div class="loading-spinner"></div>` : ""}
  </button>`;
}

function starterPackHeaderTemplate({
  starterPack,
  isOwner,
  isAuthenticated,
  isFollowingAll,
  permalink,
  onFollowAll,
}) {
  const { record, creator } = starterPack;
  return html`
    <div
      class="starter-pack-detail-header"
      data-testid="starter-pack-detail-header"
    >
      <img
        class="starter-pack-detail-avatar"
        src="/img/starter-pack-avatar-fallback.svg"
        alt=${record.name}
      />
      <div class="starter-pack-detail-header-text">
        <div class="starter-pack-detail-name" data-testid="starter-pack-name">
          ${record.name}
        </div>
        <div
          class="starter-pack-detail-creator"
          data-testid="starter-pack-creator"
        >
          Starter pack by
          ${isOwner
            ? "you"
            : html`<a href=${linkToProfile(creator)}>@${creator.handle}</a>`}
        </div>
      </div>
      ${isAuthenticated
        ? headerActionTemplate({
            isOwner,
            isFollowingAll,
            permalink,
            onFollowAll,
          })
        : ""}
    </div>
    ${record.description
      ? html`<div
          class="starter-pack-detail-description"
          data-testid="starter-pack-description"
        >
          ${richTextTemplate({
            text: record.description,
            facets: record.descriptionFacets ?? [],
          })}
        </div>`
      : ""}
    ${isAuthenticated
      ? ""
      : html`<div class="starter-pack-detail-sign-in">
          <a
            class="rounded-button rounded-button-primary"
            data-testid="starter-pack-sign-in"
            href=${linkToLogin()}
          >
            Sign in to follow
          </a>
        </div>`}
  `;
}

function sortMembers({ members, optedOutDids, currentUserDid, isOwner }) {
  const optedOut = new Set(optedOutDids);
  const visible = members.filter(
    (profile) =>
      !profile.viewer?.blocking &&
      !profile.viewer?.blockedBy &&
      !profile.associated?.labeler,
  );
  visible.reverse();
  return visible.sort((a, b) => {
    const aOptedOut = optedOut.has(a.did);
    const bOptedOut = optedOut.has(b.did);
    if (aOptedOut !== bOptedOut) return aOptedOut ? -1 : 1;
    if (isOwner) {
      if (a.did === currentUserDid) return -1;
      if (b.did === currentUserDid) return 1;
    }
    return 0;
  });
}

export default async function starterPackDetailView({
  root,
  params,
  context: {
    auth,
    dataLayer,
    identityResolver,
    isAuthenticated,
    pluginService,
    interactionHandlers,
  },
}) {
  const { handleOrDid, rkey } = params;
  const optOutEnabled =
    isAuthenticated &&
    (await auth.hasScope("repo:app.bsky.graph.referencelistoptout"));

  const creatorDid = await resolveDidFromHandleOrDid(
    handleOrDid,
    identityResolver,
  );
  const starterPackUri = `at://${creatorDid}/app.bsky.graph.starterpack/${rkey}`;

  const {
    postInteractionHandler,
    profileInteractionHandler,
    listInteractionHandler,
  } = interactionHandlers;

  const state = new ReactiveStore("starterPackDetailView");
  state.$activeTab = new Signal.State("people");
  state.$isFollowingAll = new Signal.State(false);

  const $starterPackError = new Signal.Computed(
    () =>
      dataLayer.requests.statusStore.$errors.get(
        "loadStarterPack-" + starterPackUri,
      ) ?? null,
  );

  bindPageTitle(root, () => {
    return (
      dataLayer.derived.$starterPacks.get(starterPackUri)?.record?.name ?? null
    );
  });

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const starterPack = dataLayer.derived.$starterPacks.get(starterPackUri);
    const error = $starterPackError.get();
    const list = starterPack?.list ?? null;
    const listUri = list?.uri ?? null;
    const feeds = starterPack?.feeds ?? [];
    const membersEntry = listUri
      ? dataLayer.derived.$listMembers.get(listUri)
      : null;
    const feed = listUri ? dataLayer.derived.$hydratedFeeds.get(listUri) : null;
    const showLessInteractions = listUri
      ? dataLayer.derived.$showLessInteractions.get(listUri)
      : [];
    const hiddenPostUris = showLessInteractions.map(
      (interaction) => interaction.item,
    );
    const isFollowingAll = state.$isFollowingAll.get();
    const activeTab = state.$activeTab.get();
    const isOptedOut = !!list?.viewer?.referenceListOptOut;

    const isLoaded = !!list;
    const isOwner = isLoaded && starterPack.creator.did === currentUser?.did;
    const permalink = isLoaded ? getPermalinkForStarterPack(starterPack) : null;
    const showOptOut = isLoaded && optOutEnabled && !isOwner;
    const tabs = isLoaded
      ? [
          { value: "people", label: "People" },
          ...(feeds.length > 0 ? [{ value: "feeds", label: "Feeds" }] : []),
          { value: "posts", label: "Posts" },
        ]
      : [];
    const members = membersEntry
      ? sortMembers({
          members: membersEntry.members,
          optedOutDids: membersEntry.optedOutDids,
          currentUserDid: currentUser?.did ?? null,
          isOwner,
        })
      : null;

    render(
      html`<div id="starter-pack-detail-view">
        ${headerTemplate({
          title: "Starter pack",
          rightItemTemplate: isLoaded
            ? () =>
                headerMenuTemplate({
                  permalink,
                  showOptOut,
                  isOptedOut,
                  onOptOut: () => handleOptOut(list),
                  onUndoOptOut: () => handleUndoOptOut(list),
                })
            : null,
        })}
        ${!starterPack && !error
          ? loadingTemplate()
          : !isLoaded
            ? notFoundTemplate({ onRetry: () => loadPageData() })
            : html`<main>
                ${starterPackHeaderTemplate({
                  starterPack,
                  isOwner,
                  isAuthenticated,
                  isFollowingAll,
                  permalink,
                  onFollowAll: () => handleFollowAll(starterPack),
                })}
                <div
                  class="starter-pack-detail-tab-bar"
                  data-scroll-lock-sticky
                >
                  <tab-bar
                    .tabs=${tabs}
                    active-tab=${activeTab}
                    full-width
                    @tab-click=${(event) => state.$activeTab.set(event.detail)}
                  ></tab-bar>
                </div>
                <div
                  class="starter-pack-tab-content"
                  data-testid="starter-pack-tab-content"
                  data-teststate=${activeTab}
                >
                  ${activeTab === "people"
                    ? html`<div class="feed-container">
                        ${profileFeedTemplate({
                          profiles: members,
                          hasMore: false,
                          emptyMessage: "This starter pack has no members.",
                          showEndMessage: true,
                          isAuthenticated,
                          currentUserDid: currentUser?.did ?? null,
                          profileInteractionHandler,
                          pluginService,
                        })}
                      </div>`
                    : activeTab === "feeds"
                      ? feedsFeedTemplate({
                          items: feeds,
                          renderItem: (feedGenerator) =>
                            feedGeneratorListItemTemplate({
                              feedGenerator,
                              currentUserDid: currentUser?.did ?? null,
                            }),
                        })
                      : html`<div class="feed-container">
                          ${postFeedTemplate({
                            feed,
                            currentUser,
                            isAuthenticated,
                            hiddenPostUris,
                            onLoadMore: () => loadFeed(listUri),
                            postInteractionHandler,
                            pluginService,
                            showEndMessage: true,
                          })}
                        </div>`}
                </div>
              </main>`}
      </div>`,
      root,
    );
  });

  pageEffect(root, () => {
    if (state.$activeTab.get() !== "feeds") return;
    // Reset tab if feeds are no longer available
    const feeds =
      dataLayer.derived.$starterPacks.get(starterPackUri)?.feeds ?? [];
    if (feeds.length === 0) state.$activeTab.set("posts");
  });

  async function handleFollowAll(starterPack) {
    state.$isFollowingAll.set(true);
    try {
      await dataLayer.mutations.followAllStarterPackMembers(starterPack);
      showToast("All accounts have been followed!", { style: "success" });
    } catch (error) {
      console.error(error);
      showToast("An error occurred while trying to follow all", {
        style: "error",
      });
    } finally {
      state.$isFollowingAll.set(false);
    }
  }

  async function handleOptOut(list) {
    const optedOut =
      await listInteractionHandler.handleOptOutOfReferenceList(list);
    if (optedOut) reloadMembers(list.uri);
  }

  async function handleUndoOptOut(list) {
    const undone =
      await listInteractionHandler.handleUndoReferenceListOptOut(list);
    if (undone) reloadMembers(list.uri);
  }

  function reloadMembers(listUri) {
    dataLayer.requests.loadAllListMembers(listUri).catch(console.warn);
  }

  async function loadFeed(listUri, { reload = false } = {}) {
    await dataLayer.requests.loadNextFeedPage(
      { type: "list", uri: listUri },
      { reload, limit: FEED_PAGE_SIZE + 1 },
    );
  }

  async function loadPageData() {
    await dataLayer.requests.loadStarterPack(starterPackUri);
    const listUri =
      dataLayer.derived.$starterPacks.get(starterPackUri)?.list?.uri ?? null;
    if (!listUri) return;
    await Promise.all([
      dataLayer.requests.loadAllListMembers(listUri),
      loadFeed(listUri, { reload: true }),
    ]);
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
