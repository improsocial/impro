import { html, render } from "/js/lib/lit-html.js";
import { requireAuth } from "/js/auth.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import {
  profileListItemTemplate,
  profileListItemSkeletonTemplate,
} from "/js/templates/profileListItem.template.js";
import { formatLargeNumber } from "/js/utils.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/infinite-scroll-container.js";

class ProfileFollowersView extends View {
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

    function followersListTemplate({ followers, hasMore }) {
      if (!followers || followers.length === 0) {
        return html`<div class="search-status-message">No followers yet.</div>`;
      }
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadFollowers();
            e.detail.resume();
          }
        }}
      >
        <div class="profile-list">
          ${followers.map((follower) =>
            profileListItemTemplate({ actor: follower })
          )}
        </div>
        ${hasMore
          ? Array.from({ length: 5 }).map(() =>
              profileListItemSkeletonTemplate()
            )
          : ""}
      </infinite-scroll-container>`;
    }

    function followersSkeletonTemplate() {
      return html`<div class="profile-list">
        ${Array.from({ length: 10 }).map(() =>
          profileListItemSkeletonTemplate()
        )}
      </div>`;
    }

    function followersErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading followers</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const profileFollowers =
        dataLayer.selectors.getProfileFollowers(profileDid);
      const profile = dataLayer.selectors.getProfile(profileDid);
      const profileFollowersRequestStatus = dataLayer.requests.getStatus(
        "loadProfileFollowers"
      );
      const hasMore = profileFollowers?.cursor ? true : false;

      const subtitle = profile?.followersCount
        ? `${formatLargeNumber(profile.followersCount)} ${
            profile.followersCount === 1 ? "follower" : "followers"
          }`
        : null;

      render(
        html`<div id="profile-followers-view">
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
                  if (profileFollowersRequestStatus.error) {
                    return followersErrorTemplate({
                      error: profileFollowersRequestStatus.error,
                    });
                  } else if (profileFollowers && profileFollowers.followers) {
                    return followersListTemplate({
                      followers: profileFollowers.followers,
                      hasMore,
                    });
                  } else {
                    return followersSkeletonTemplate();
                  }
                })()}
              </main>`,
          })}
        </div>`,
        root
      );
    }

    async function loadFollowers() {
      const profileFollowers =
        dataLayer.selectors.getProfileFollowers(profileDid);
      const cursor = profileFollowers?.cursor;
      const loadingPromise = dataLayer.requests.loadProfileFollowers(
        profileDid,
        {
          cursor,
        }
      );
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarations.ensureCurrentUser().then(() => {
        renderPage();
      });
      // Load the profile to get the follower count
      dataLayer.declarations.ensureProfile(profileDid).then(() => {
        renderPage();
      });
      await loadFollowers();
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

export default new ProfileFollowersView();
