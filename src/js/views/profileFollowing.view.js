import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { View } from "/js/views/view.js";
import { bindToPage } from "/js/router.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
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
      const profileFollowingRequestStatus = dataLayer.requests.getStatus(
        "loadProfileFollows-" + profileDid,
      );
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
            pluginService,
            children: html`${headerTemplate({
                title: profile ? getDisplayName(profile) : "",
                subtitle,
              })}
              <main style="position: relative;">
                ${(() => {
                  if (profileFollowingRequestStatus.error) {
                    return followingErrorTemplate({
                      error: profileFollowingRequestStatus.error,
                    });
                  }
                  return profileFeedTemplate({
                    profiles: profileFollowing?.follows ?? null,
                    hasMore,
                    onLoadMore: loadFollowing,
                    emptyMessage: "Not following anyone yet.",
                  });
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

    bindToPage(root, notificationService, "update", () => renderPage());

    bindToPage(root, chatNotificationService, "update", () => renderPage());
  }
}

export default new ProfileFollowingView();
