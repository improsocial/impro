import { html, render } from "/js/lib/lit-html.js";
import { requireAuth } from "/js/auth.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import {
  profileListItemTemplate,
  profileListItemSkeletonTemplate,
} from "/js/templates/profileListItem.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/infinite-scroll-container.js";

class ProfileFollowingView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      identityResolver,
      notificationService,
      chatNotificationService,
      postComposerService,
    },
  }) {
    await requireAuth();

    const { handleOrDid } = params;

    let profileDid = null;
    if (handleOrDid.startsWith("did:")) {
      profileDid = handleOrDid;
    } else {
      profileDid = await identityResolver.resolveHandle(handleOrDid);
    }

    function followingListTemplate({ follows, hasMore }) {
      if (!follows || follows.length === 0) {
        return html`<div class="search-status-message">
          Not following anyone yet.
        </div>`;
      }
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadFollowing();
            e.detail.resume();
          }
        }}
      >
        <div class="profile-list">
          ${follows.map((follow) => profileListItemTemplate({ actor: follow }))}
        </div>
        ${hasMore
          ? Array.from({ length: 5 }).map(() =>
              profileListItemSkeletonTemplate(),
            )
          : ""}
      </infinite-scroll-container>`;
    }

    function followingSkeletonTemplate() {
      return html`<div class="profile-list">
        ${Array.from({ length: 10 }).map(() =>
          profileListItemSkeletonTemplate(),
        )}
      </div>`;
    }

    function followingErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading following</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const profileFollowing =
        dataLayer.selectors.getProfileFollows(profileDid);
      const profile = dataLayer.selectors.getProfile(profileDid);
      const profileFollowingRequestStatus =
        dataLayer.requests.getStatus("loadProfileFollows");
      const hasMore = profileFollowing?.cursor ? true : false;

      const subtitle = profile?.followsCount
        ? `${profile.followsCount.toLocaleString()} following`
        : null;

      render(
        html`<div id="profile-following-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            children: html`${textHeaderTemplate({
                title: profile ? getDisplayName(profile) : "",
                subtitle,
              })}
              <main style="position: relative;">
                ${(() => {
                  if (profileFollowingRequestStatus.error) {
                    return followingErrorTemplate({
                      error: profileFollowingRequestStatus.error,
                    });
                  } else if (profileFollowing && profileFollowing.follows) {
                    return followingListTemplate({
                      follows: profileFollowing.follows,
                      hasMore,
                    });
                  } else {
                    return followingSkeletonTemplate();
                  }
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    }

    async function loadFollowing() {
      const profileFollowing =
        dataLayer.selectors.getProfileFollows(profileDid);
      const cursor = profileFollowing?.cursor;
      const loadingPromise = dataLayer.requests.loadProfileFollows(profileDid, {
        cursor,
      });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
      // Load the profile to get the follows count
      dataLayer.declarative.ensureProfile(profileDid).then(() => {
        renderPage();
      });
      await loadFollowing();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      renderPage();
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new ProfileFollowingView();
