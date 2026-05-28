import { html, render } from "/js/lib/lit-html.js";
import { wait } from "/js/utils.js";
import { Signal } from "/js/signals.js";
import {
  doHideAuthorOnUnauthenticated,
  isLabelerProfile,
} from "/js/dataHelpers.js";
import { View } from "/js/views/view.js";
import { profileCardTemplate } from "/js/templates/profileCard.template.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { labelerSettingsTemplate } from "/js/templates/labelerSettings.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { ApiError } from "/js/api.js";
import { getFacetsFromText } from "/js/facetHelpers.js";
import { pageEffect } from "/js/router.js";
import { AUTHOR_FEED_PAGE_SIZE, BSKY_LABELER_DID } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import { tabBarTemplate } from "/js/templates/tabBar.template.js";
import { feedGeneratorListItemTemplate } from "/js/templates/feedGeneratorListItem.template.js";
import "/js/components/edit-profile-dialog.js";

class ProfileView extends View {
  async render({
    root,
    params,
    context: {
      identityResolver,
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
    const defaultAuthorFeeds = [
      {
        feedType: "posts",
        name: "Posts",
      },
      isAuthenticated
        ? {
            feedType: "replies",
            name: "Replies",
          }
        : null,
      {
        feedType: "media",
        name: "Media",
      },
    ].filter(Boolean);

    const currentUserAuthorFeeds = [
      ...defaultAuthorFeeds,
      {
        feedType: "likes",
        name: "Likes",
      },
    ];

    const $activeTab = new Signal.State("posts");
    const $richTextProfileDescription = new Signal.State(null);

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
        await loadProfileDescription();
        showToast("Profile updated");
        successCallback();
      } catch (error) {
        errorCallback(error);
      }
    }

    const tabScrollState = new Map();

    async function scrollAndReloadFeed() {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      // TODO - add setting to prevent reload?
      await loadAuthorFeed({ reload: true });
    }

    async function handleTabClick(tab) {
      const currentTab = $activeTab.get();
      if (tab === currentTab) {
        if (tab === "feeds") {
          scrollAndReloadActorFeeds();
        } else {
          scrollAndReloadFeed();
        }
        return;
      }
      // Save scroll state
      tabScrollState.set(currentTab, window.scrollY);
      // switch tab
      $activeTab.set(tab);
      // Restore or reset scroll
      if (tabScrollState.has(tab)) {
        window.scrollTo(0, tabScrollState.get(tab));
      } else {
        window.scrollTo(0, 0);
      }
      // Load feed if needed
      if (tab === "feeds") {
        if (!dataLayer.derived.$actorFeeds.get(profileDid).get()) {
          await loadActorFeeds();
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

    function actorFeedsTemplate({ actorFeeds, onLoadMore }) {
      if (!actorFeeds) {
        return html`<div class="feeds-list">
          <div class="loading-spinner"></div>
        </div>`;
      }
      if (actorFeeds.feeds.length === 0) {
        return html`<div class="feeds-list">
          <div class="feed-end-message">No custom feeds.</div>
        </div>`;
      }
      const hasMore = !!actorFeeds.cursor;
      return html`
        <infinite-scroll-container
          lookahead="2500px"
          @load-more=${async (e) => {
            if (hasMore && onLoadMore) {
              await onLoadMore();
              e.detail.resume();
            }
          }}
        >
          <div class="feeds-list">
            ${actorFeeds.feeds.map((feedGenerator) =>
              feedGeneratorListItemTemplate({ feedGenerator }),
            )}
            ${hasMore ? html`<div class="loading-spinner"></div>` : ""}
          </div>
        </infinite-scroll-container>
      `;
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
          <button @click=${() => window.location.reload()}>Try again</button>
        </div>`;
      }
      console.error(error);
      return html`<div class="error-state">
        <div>There was an error loading the profile.</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function profileUnavailableTemplate() {
      return html`
        <div class="error-state">
          <h1>Sign-In Required</h1>
          <p>
            This account has requested that users sign in to view their profile.
          </p>
          <button @click=${() => window.router.back()}>Go back</button>
        </div>
      `;
    }

    function profileTemplate({
      profile,
      isLabeler,
      labelerInfo,
      currentUser,
      activeTab,
      richTextProfileDescription,
    }) {
      try {
        if (!isAuthenticated && doHideAuthorOnUnauthenticated(profile)) {
          return profileUnavailableTemplate();
        }
        const isBlocking = !!profile.viewer?.blocking;
        const isBlockedBy = !!profile.viewer?.blockedBy;
        const profileChatStatus = dataLayer.derived.$profileChatStatus
          .get(profile.did)
          .get();
        const isCurrentUser = currentUser?.did === profile.did;
        let authorFeedsToShow = isCurrentUser
          ? currentUserAuthorFeeds
          : defaultAuthorFeeds;
        // Hide media feed for labelers. TODO: prevent prefetching
        if (isLabeler) {
          authorFeedsToShow = authorFeedsToShow.filter(
            (feed) => feed.feedType !== "media",
          );
        }
        const feedGenCount = profile.associated?.feedgens || 0;
        if (feedGenCount > 0) {
          authorFeedsToShow = [
            ...authorFeedsToShow,
            { feedType: "feeds", name: "Feeds" },
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
          labelerSettings = dataLayer.derived.$labelerSettings
            .get(profile.did)
            .get();
        }
        return html`
          <div class="profile-container">
            ${profileCardTemplate({
              profile,
              richTextProfileDescription,
              isAuthenticated,
              isCurrentUser,
              profileChatStatus,
              isLabeler,
              showSubscribeButton: !isDefaultLabeler,
              labelerInfo,
              isSubscribed,
              activitySubscription:
                profile.viewer?.activitySubscription ?? null,
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
                  const convo =
                    await dataLayer.declarative.ensureConvoForProfile(
                      profile.did,
                    );
                  window.router.go(`/messages/${convo.id}`);
                }
              },
              onClickFollow: (profile, doFollow) =>
                profileInteractionHandler.handleFollow(profile, doFollow, {
                  // Only show success toast for labelers, aka when the follow button is in the context menu
                  showSuccessToast: isLabeler,
                }),
              onClickMute: (profile, doMute) =>
                profileInteractionHandler.handleMute(profile, doMute),
              onClickBlock: async (profile, doBlock) => {
                await profileInteractionHandler.handleBlock(profile, doBlock);
                if (!doBlock) {
                  // wait for the app view to process that the block has been lifted, then reload the feed
                  // We could do some fancier logic here but this is a good enough solution for now.
                  await wait(2000);
                  loadAuthorFeed();
                  preloadHiddenFeeds();
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
              onClickEditProfile: () => handleEditProfile(profile),
              pluginService,
            })}
            ${isBlocking || isBlockedBy
              ? html`<div class="feed">
                  <div class="feed-end-message">Posts hidden</div>
                </div>`
              : html`
                  <div class="profile-tab-bar" data-scroll-lock-sticky>
                    ${tabBarTemplate({
                      tabs: [
                        ...(isLabeler
                          ? [{ value: "labeler-settings", label: "Labels" }]
                          : []),
                        ...authorFeedsToShow.map((feedInfo) => ({
                          value: feedInfo.feedType,
                          label: feedInfo.name,
                        })),
                      ],
                      activeTab,
                      onTabClick: handleTabClick,
                    })}
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
                      const actorFeeds = dataLayer.derived.$actorFeeds
                        .get(profileDid)
                        .get();
                      return html`<div
                        class="feed-container"
                        ?hidden=${activeTab !== "feeds"}
                      >
                        ${actorFeedsTemplate({
                          actorFeeds,
                          onLoadMore: () => loadActorFeeds(),
                        })}
                      </div>`;
                    }
                    const feedURI = `${profileDid}-${feedInfo.feedType}`;
                    const authorFeed = dataLayer.derived.$hydratedAuthorFeeds
                      .get(feedURI)
                      .get();
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

    pageEffect(root, () => {
      const profile = dataLayer.derived.$hydratedProfiles.get(profileDid).get();
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const profileRequestStatus = dataLayer.requests.statusStore.$statuses
        .get("loadProfile-" + profileDid)
        .get();
      const isLabeler = profile && isLabelerProfile(profile);
      const labelerInfo = isLabeler
        ? dataLayer.derived.$labelerInfo.get(profile.did).get()
        : null;
      // If labeler, require labeler info to be loaded
      const isLoaded = profile && (isLabeler ? !!labelerInfo : true);
      const activeTab = $activeTab.get();
      const richTextProfileDescription = $richTextProfileDescription.get();
      render(
        html`<div id="profile-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            showSidebarOverlay: false,
            activeNavItem: currentUser?.did === profile?.did ? "profile" : null,
            onClickActiveNavItem: () => {
              scrollAndReloadFeed();
            },
            showFloatingComposeButton: true,
            onClickComposeButton: async () => {
              await postComposerService.composePost({ currentUser });
            },
            children: html`
              <main style="position: relative;">
                <button
                  class="floating-back-button"
                  @click=${() => router.back()}
                >
                  ←
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
                      richTextProfileDescription,
                    });
                  } else {
                    return profileSkeletonTemplate();
                  }
                })()}
              </main>
            `,
          })}
        </div>`,
        root,
      );
    });

    async function loadAuthorFeed({ reload = false } = {}) {
      const activeTab = $activeTab.get();
      if (activeTab === "labeler-settings" || activeTab === "feeds") {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      await loadActorFeeds({ reload: true });
    }

    async function preloadHiddenFeeds() {
      const activeTab = $activeTab.get();
      const feedsToPreload = defaultAuthorFeeds.filter(
        (feed) => feed.feedType !== activeTab,
      );
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

    // This is async because it needs to resolve mentions
    async function loadProfileDescription() {
      const profile = dataLayer.derived.$hydratedProfiles.get(profileDid).get();
      if (!profile?.description) {
        return;
      }
      const facets = await getFacetsFromText(
        profile.description,
        identityResolver,
      );
      $richTextProfileDescription.set({
        text: profile.description,
        facets,
      });
    }

    root.addEventListener("page-enter", async () => {
      if (isAuthenticated) {
        await dataLayer.declarative.ensureCurrentUser();
      }

      let profile;
      try {
        profile = await dataLayer.declarative.ensureProfile(profileDid);
      } catch {
        return;
      }

      // Set active tab and load labeler info if this is a labeler profile
      const isLabeler = profile && isLabelerProfile(profile);
      if (isLabeler) {
        $activeTab.set("labeler-settings");
        dataLayer.requests.loadLabelerInfo(profile.did);
      }

      await loadProfileDescription();
      if (!profile.viewer?.blocking && !profile.viewer?.blockedBy) {
        loadAuthorFeed();
        preloadHiddenFeeds();
      }
      // Load chat status
      if (
        isAuthenticated &&
        profile.did !== dataLayer.derived.$currentUser.get()?.did
      ) {
        dataLayer.requests.loadProfileChatStatus(profile.did);
      }
    });

    root.addEventListener("page-restore", (e) => {
      const { isBack, scrollY } = e.detail;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
      }
    });
  }
}

export default new ProfileView();
