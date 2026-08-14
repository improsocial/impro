import { html, render } from "/js/lib/lit-html.js";
import { wait } from "/js/utils.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import {
  doHideAuthorOnUnauthenticated,
  isLabelerProfile,
} from "/js/dataHelpers.js";
import { profileCardTemplate } from "/js/templates/profileCard.template.js";
import { floatingComposeButtonTemplate } from "/js/templates/floatingComposeButton.template.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { labelerSettingsTemplate } from "/js/templates/labelerSettings.template.js";
import { ApiError } from "/js/api.js";
import { bindToPage, pageEffect, bindPageTitle } from "/js/router.js";
import { AUTHOR_FEED_PAGE_SIZE, BSKY_LABELER_DID } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import "/js/components/tab-bar.js";
import { arrowLeftIconTemplate } from "/js/templates/icons/arrowLeft.template.js";
import { feedGeneratorListItemTemplate } from "/js/templates/feedGeneratorListItem.template.js";
import { feedsFeedTemplate } from "/js/templates/feedsFeed.template.js";
import { listFeedTemplate } from "/js/templates/listFeed.template.js";
import "/js/components/edit-profile-dialog.js";
import "/js/components/add-to-lists-dialog.js";

export default async function profileView({
  root,
  router,
  params,
  layout,
  context: {
    identityResolver,
    dataLayer,
    postComposerService,
    isAuthenticated,
    pluginService,
    interactionHandlers,
  },
}) {
  function getAuthorFeeds({ isCurrentUser, isLabeler }) {
    return [
      { feedType: "posts", name: "Posts" },
      isAuthenticated ? { feedType: "replies", name: "Replies" } : null,
      isLabeler ? null : { feedType: "media", name: "Media" },
      isCurrentUser ? { feedType: "likes", name: "Likes" } : null,
    ].filter(Boolean);
  }

  const state = new ReactiveStore("profileView");
  state.$activeTab = new Signal.State("posts");

  const { handleOrDid } = params;
  let profileDid = null;
  // If no handle or did is provided, use the current user
  if (!handleOrDid) {
    const currentUser = await dataLayer.declarative.ensureCurrentUser();
    profileDid = currentUser.did;
  } else if (handleOrDid.startsWith("did:")) {
    profileDid = handleOrDid;
  } else {
    profileDid = await identityResolver.resolveHandle(handleOrDid);
  }

  const { postInteractionHandler, profileInteractionHandler } =
    interactionHandlers;

  async function handleAddToLists(profile) {
    const dialog = document.createElement("add-to-lists-dialog");
    dialog.profile = profile;
    dialog.dataLayer = dataLayer;
    dialog.profileInteractionHandler = profileInteractionHandler;
    dialog.addEventListener("dialog-closed", () => {
      dialog.remove();
    });
    document.body.appendChild(dialog);
    dialog.open();
  }

  async function handleEditProfile(profile) {
    const dialog = document.createElement("edit-profile-dialog");
    dialog.addEventListener("profile-save", (event) =>
      handleSaveProfile(
        profile,
        event.detail.profileUpdates,
        event.detail.successCallback,
        event.detail.errorCallback,
      ),
    );
    dialog.addEventListener("edit-profile-closed", () => {
      dialog.remove();
    });
    root.querySelector("main").appendChild(dialog);
    dialog.setProfile(profile);
    dialog.open();
  }

  async function handleSaveProfile(
    profile,
    profileUpdates,
    successCallback,
    errorCallback,
  ) {
    try {
      await dataLayer.mutations.updateProfile(profile, profileUpdates);
      showToast("Profile updated");
      successCallback();
    } catch (error) {
      errorCallback(error);
    }
  }

  async function scrollAndReloadFeed() {
    if (window.scrollY > 0) {
      window.scrollTo({ top: -1, behavior: "smooth" });
    }
    await loadAuthorFeed({ reload: true });
  }

  async function handleTabClick(tab) {
    const currentTab = state.$activeTab.get();
    if (tab === currentTab) {
      if (tab === "feeds") {
        scrollAndReloadActorFeeds();
      } else if (tab === "lists") {
        scrollAndReloadActorLists();
      } else {
        scrollAndReloadFeed();
      }
      return;
    }
    // switch tab
    state.$activeTab.set(tab);
    // Load feed if needed
    if (tab === "feeds") {
      if (!dataLayer.derived.$actorFeeds.get(profileDid)) {
        await loadActorFeeds();
      }
    } else if (tab === "lists") {
      if (!dataLayer.derived.$actorLists.get(profileDid)) {
        await loadActorLists();
      }
    } else {
      const isFeedTab = tab !== "labeler-settings";
      if (isFeedTab && !dataLayer.hasCachedAuthorFeed(profileDid, tab)) {
        await loadAuthorFeed();
      }
    }
  }

  async function handleLabelerSettingsClick(labelerDid, label, visibility) {
    try {
      await dataLayer.mutations.updateLabelerSetting({
        labelerDid,
        label,
        visibility,
      });
    } catch (error) {
      console.error(error);
      showToast("Failed to update labeler setting", { style: "error" });
    }
  }

  function actorFeedsTemplate({ actorFeeds, onLoadMore, currentUserDid }) {
    return feedsFeedTemplate({
      items: actorFeeds?.feeds,
      renderItem: (feedGenerator) =>
        feedGeneratorListItemTemplate({ feedGenerator, currentUserDid }),
      emptyMessage: "No custom feeds.",
      hasMore: !!actorFeeds?.cursor,
      onLoadMore,
    });
  }

  function isNotFoundError(error) {
    return error instanceof ApiError && error.status === 400;
  }

  function getNotFoundMessage(notFoundError) {
    if (
      notFoundError.data.message ===
      "Error: actor must be a valid did or a handle"
    )
      return "Invalid handle";
    if (notFoundError.data.error === "AccountTakedown")
      return "Account has been suspended";
    if (notFoundError.data.error === "AccountDeactivated")
      return "Account is deactivated";
    return "Profile not found";
  }

  function profileErrorTemplate({ error }) {
    if (isNotFoundError(error)) {
      const message = getNotFoundMessage(error);
      return html`<div class="error-state">
        <h3>Not Found</h3>
        <div>${message}</div>
        <button class="rounded-button" @click=${() => window.location.reload()}>
          Try again
        </button>
      </div>`;
    }
    console.error(error);
    return html`<div class="error-state">
      <div>There was an error loading the profile.</div>
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }

  function profileUnavailableTemplate() {
    return html`
      <div class="error-state">
        <h1>Sign-In Required</h1>
        <p>
          This account has requested that users sign in to view their profile.
        </p>
        <button class="rounded-button" @click=${() => window.router.back()}>
          Go back
        </button>
      </div>
    `;
  }

  function profileTemplate({
    profile,
    isLabeler,
    labelerInfo,
    currentUser,
    activeTab,
  }) {
    try {
      if (!isAuthenticated && doHideAuthorOnUnauthenticated(profile)) {
        return profileUnavailableTemplate();
      }
      const isBlocking = !!profile.viewer?.blocking;
      const isBlockedBy = !!profile.viewer?.blockedBy;
      const profileChatStatus = dataLayer.derived.$profileChatStatus.get(
        profile.did,
      );
      const isCurrentUser = currentUser?.did === profile.did;
      let authorFeedsToShow = getAuthorFeeds({ isCurrentUser, isLabeler });
      const feedGenCount = profile.associated?.feedgens || 0;
      if (feedGenCount > 0) {
        authorFeedsToShow = [
          ...authorFeedsToShow,
          { feedType: "feeds", name: "Feeds" },
        ];
      }
      const listsCount = profile.associated?.lists || 0;
      if (listsCount > 0) {
        authorFeedsToShow = [
          ...authorFeedsToShow,
          { feedType: "lists", name: "Lists" },
        ];
      }
      let isDefaultLabeler = profile.did === BSKY_LABELER_DID;
      let isSubscribed = false;
      let labelerSettings = null;
      if (isLabeler) {
        const preferences = dataLayer.derived.$preferences.get();
        isSubscribed = isDefaultLabeler
          ? true
          : preferences?.isSubscribedToLabeler(profile.did);
        labelerSettings = dataLayer.derived.$labelerSettings.get(profile.did);
      }
      return html`
        <div class="profile-container">
          ${profileCardTemplate({
            profile,
            identityResolver,
            isAuthenticated,
            isCurrentUser,
            profileChatStatus,
            isLabeler,
            showSubscribeButton: !isDefaultLabeler,
            labelerInfo,
            isSubscribed,
            activitySubscription: profile.viewer?.activitySubscription ?? null,
            onClickPostNotifications: (profile) =>
              profileInteractionHandler.handlePostNotificationSubscription(
                profile,
              ),
            onClickChat: async (profile) => {
              if (!profileChatStatus || !profileChatStatus.canChat) {
                // This should never happen
                return;
              }
              if (profileChatStatus.convo) {
                window.router.go(`/messages/${profileChatStatus.convo.id}`);
              } else {
                const convo = await dataLayer.declarative.ensureConvoForProfile(
                  profile.did,
                );
                window.router.go(`/messages/${convo.id}`);
              }
            },
            onClickFollow: (profile, doFollow) =>
              profileInteractionHandler.handleFollow(profile, doFollow),
            onClickMute: (profile, doMute) =>
              profileInteractionHandler.handleMute(profile, doMute),
            onClickBlock: async (profile, doBlock) => {
              await profileInteractionHandler.handleBlock(profile, doBlock);
              if (!doBlock) {
                // wait for the app view to process that the block has been lifted, then reload the feed
                // We could do some fancier logic here but this is a good enough solution for now.
                await wait(2000);
                loadAuthorFeed();
                preloadHiddenFeeds({ isCurrentUser, isLabeler });
              }
            },
            onClickSubscribe: (profile, doSubscribe, labelerInfo) =>
              profileInteractionHandler.handleSubscribe(
                profile,
                doSubscribe,
                labelerInfo,
              ),
            onClickReport: (profile) =>
              profileInteractionHandler.handleReport(profile),
            onClickAddToLists: (profile) => handleAddToLists(profile),
            onClickEditProfile: () => handleEditProfile(profile),
            pluginService,
            isFollowPending: dataLayer.derived.$isFollowPending.get(
              profile.did,
            ),
            isBlockPending: dataLayer.derived.$isBlockPending.get(profile.did),
          })}
          ${isBlocking || isBlockedBy
            ? html`<div class="feed">
                <div class="feed-end-message">Posts hidden</div>
              </div>`
            : html`
                <div class="profile-tab-bar" data-scroll-lock-sticky>
                  <tab-bar
                    .tabs=${[
                      ...(isLabeler
                        ? [{ value: "labeler-settings", label: "Labels" }]
                        : []),
                      ...authorFeedsToShow.map((feedInfo) => ({
                        value: feedInfo.feedType,
                        label: feedInfo.name,
                      })),
                    ]}
                    active-tab=${activeTab}
                    @tab-click=${(event) => handleTabClick(event.detail)}
                  ></tab-bar>
                </div>
                ${isLabeler
                  ? html`<div
                      class="labeler-settings-pane"
                      ?hidden=${activeTab !== "labeler-settings"}
                    >
                      ${labelerSettingsTemplate({
                        labelerInfo,
                        profile,
                        isSubscribed,
                        labelerSettings,
                        onClick: (label, visibility) =>
                          handleLabelerSettingsClick(
                            profile.did,
                            label,
                            visibility,
                          ),
                      })}
                    </div>`
                  : null}
                ${authorFeedsToShow.map((feedInfo) => {
                  if (feedInfo.feedType === "feeds") {
                    const actorFeeds =
                      dataLayer.derived.$actorFeeds.get(profileDid);
                    return html`<div
                      class="feed-container"
                      ?hidden=${activeTab !== "feeds"}
                    >
                      ${actorFeedsTemplate({
                        actorFeeds,
                        onLoadMore: () => loadActorFeeds(),
                        currentUserDid: currentUser?.did,
                      })}
                    </div>`;
                  }
                  if (feedInfo.feedType === "lists") {
                    const actorLists =
                      dataLayer.derived.$actorLists.get(profileDid);
                    return html`<div
                      class="feed-container"
                      ?hidden=${activeTab !== "lists"}
                    >
                      ${listFeedTemplate({
                        lists: actorLists?.lists,
                        cursor: actorLists?.cursor,
                        onLoadMore: () => loadActorLists(),
                      })}
                    </div>`;
                  }
                  const feedURI = `${profileDid}-${feedInfo.feedType}`;
                  const authorFeed =
                    dataLayer.derived.$hydratedAuthorFeeds.get(feedURI);
                  return html`<div
                    class="feed-container"
                    ?hidden=${activeTab !== feedInfo.feedType}
                  >
                    ${postFeedTemplate({
                      feed: authorFeed,
                      currentUser,
                      isAuthenticated,
                      postInteractionHandler,
                      onLoadMore: () => loadAuthorFeed(),
                      pluginService,
                      showEndMessage: true,
                    })}
                  </div>`;
                })}
              `}
        </div>
      `;
    } catch (error) {
      console.error("error", error);
      return profileErrorTemplate({ error });
    }
  }

  function profileSkeletonTemplate() {
    return html`<div class="profile-container"></div>`;
  }

  bindToPage(root, layout, "active-nav-click", (event) => {
    event.preventDefault();
    scrollAndReloadFeed();
  });

  bindPageTitle(root, () => {
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    if (!profile) return null;
    if (profile.displayName) {
      return `${profile.displayName} (@${profile.handle})`;
    }
    return `@${profile.handle}`;
  });

  pageEffect(root, () => {
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    const currentUser = dataLayer.derived.$currentUser.get();
    const profileRequestStatus = dataLayer.requests.statusStore.$statuses.get(
      "loadDetailedProfile-" + profileDid,
    );
    const isLabeler = profile && isLabelerProfile(profile);
    const labelerInfo = isLabeler
      ? dataLayer.derived.$labelerInfo.get(profile.did)
      : null;
    // If labeler, require labeler info to be loaded
    const isLoaded = profile && (isLabeler ? !!labelerInfo : true);
    const activeTab = state.$activeTab.get();
    render(
      html`<div id="profile-view">
        <main style="position: relative;">
          <button class="floating-back-button" @click=${() => router.back()}>
            ${arrowLeftIconTemplate()}
          </button>
          ${(() => {
            if (profileRequestStatus.error) {
              return profileErrorTemplate({
                error: profileRequestStatus.error,
              });
            } else if (isLoaded) {
              return profileTemplate({
                profile,
                isLabeler,
                labelerInfo,
                currentUser,
                activeTab,
              });
            } else {
              return profileSkeletonTemplate();
            }
          })()}
        </main>
        ${currentUser
          ? floatingComposeButtonTemplate({
              onClick: () => postComposerService.composePost({ currentUser }),
            })
          : ""}
      </div>`,
      root,
    );
  });

  async function loadAuthorFeed({ reload = false } = {}) {
    const activeTab = state.$activeTab.get();
    if (
      activeTab === "labeler-settings" ||
      activeTab === "feeds" ||
      activeTab === "lists"
    ) {
      return;
    }
    await dataLayer.requests.loadNextAuthorFeedPage(profileDid, activeTab, {
      reload,
      limit: AUTHOR_FEED_PAGE_SIZE + 1,
    });
  }

  async function loadActorFeeds({ reload = false } = {}) {
    await dataLayer.requests.loadActorFeeds(profileDid, { reload });
  }

  async function scrollAndReloadActorFeeds() {
    if (window.scrollY > 0) {
      window.scrollTo({ top: -1, behavior: "smooth" });
    }
    await loadActorFeeds({ reload: true });
  }

  async function loadActorLists({ reload = false } = {}) {
    await dataLayer.requests.loadActorLists(profileDid, { reload });
  }

  async function scrollAndReloadActorLists() {
    if (window.scrollY > 0) {
      window.scrollTo({ top: -1, behavior: "smooth" });
    }
    await loadActorLists({ reload: true });
  }

  async function preloadHiddenFeeds({ isCurrentUser, isLabeler }) {
    const activeTab = state.$activeTab.get();
    const feedsToPreload = getAuthorFeeds({
      isCurrentUser,
      isLabeler,
    }).filter((feed) => feed.feedType !== activeTab);
    for (const feed of feedsToPreload) {
      await dataLayer.requests.loadNextAuthorFeedPage(
        profileDid,
        feed.feedType,
        {
          limit: AUTHOR_FEED_PAGE_SIZE + 1,
        },
      );
    }
  }

  let didSelectInitialTab = false;

  async function loadProfile() {
    await dataLayer.requests.loadDetailedProfile(profileDid);
    return dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
  }

  function loadPageData(profile) {
    const isLabeler = isLabelerProfile(profile);
    if (isLabeler) {
      dataLayer.requests.loadLabelerInfo(profile.did);
    }

    if (!profile.viewer?.blocking && !profile.viewer?.blockedBy) {
      const isCurrentUser =
        profile.did === dataLayer.derived.$currentUser.get()?.did;
      loadAuthorFeed({ reload: true });
      preloadHiddenFeeds({ isCurrentUser, isLabeler });
    }
    // Load chat status
    if (
      isAuthenticated &&
      profile.did !== dataLayer.derived.$currentUser.get()?.did
    ) {
      dataLayer.requests.loadProfileChatStatus(profile.did);
    }
  }

  root.addEventListener("page-enter", async () => {
    const profile = await loadProfile();
    if (!profile) {
      return;
    }
    // Labeler profiles open on their settings tab, but only the first time so
    // a revisit doesn't reset the user's tab. Must precede the feed loads,
    // which skip the author feed while that tab is active.
    if (!didSelectInitialTab) {
      didSelectInitialTab = true;
      if (isLabelerProfile(profile)) {
        state.$activeTab.set("labeler-settings");
      }
    }
    loadPageData(profile);
  });
}
