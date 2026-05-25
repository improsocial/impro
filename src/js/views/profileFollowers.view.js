import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { View } from "/js/views/view.js";
import { bindToPage } from "/js/router.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
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
      pluginService,
    },
  }) {
    await auth.requireAuth();

    const { handleOrDid } = params;

    let profileDid = null;
    if (handleOrDid.startsWith("did:")) {
      profileDid = handleOrDid;
    } else {
      profileDid = await identityResolver.resolveHandle(handleOrDid);
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
      const profile = dataLayer.base.getProfile(profileDid);
      const profileFollowersRequestStatus = dataLayer.requests.getStatus(
        "loadProfileFollowers-" + profileDid,
      );
      const hasMore = profileFollowers?.cursor ? true : false;

      const subtitle = profile?.followersCount
        ? `${profile.followersCount.toLocaleString()} ${
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
            pluginService,
            children: html`${headerTemplate({
                title: profile ? getDisplayName(profile) : "",
                subtitle,
              })}
              <main style="position: relative;">
                ${(() => {
                  if (profileFollowersRequestStatus.error) {
                    return followersErrorTemplate({
                      error: profileFollowersRequestStatus.error,
                    });
                  }
                  return profileFeedTemplate({
                    profiles: profileFollowers?.followers ?? null,
                    hasMore,
                    onLoadMore: loadFollowers,
                    emptyMessage: "No followers yet.",
                  });
                })()}
              </main>`,
          })}
        </div>`,
        root,
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
        },
      );
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then(() => {
        renderPage();
      });
      // Load the profile to get the follower count
      dataLayer.declarative.ensureProfile(profileDid).then(() => {
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

    bindToPage(root, notificationService, "update", () => renderPage());

    bindToPage(root, chatNotificationService, "update", () => renderPage());
  }
}

export default new ProfileFollowersView();
