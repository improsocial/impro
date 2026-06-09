import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
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
      interactionHandlers,
      isAuthenticated,
      mainLayout,
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

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const profileFollowers =
        dataLayer.derived.$profileFollowers.get(profileDid);
      const profile =
        dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
      const profileFollowersRequestStatus =
        dataLayer.requests.statusStore.$statuses.get(
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
          ${mainLayout({
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
                    isAuthenticated,
                    currentUserDid: currentUser?.did ?? null,
                    profileInteractionHandler:
                      interactionHandlers.profileInteractionHandler,
                  });
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    async function loadFollowers() {
      const profileFollowers =
        dataLayer.derived.$profileFollowers.get(profileDid);
      const cursor = profileFollowers?.cursor;
      await dataLayer.requests.loadProfileFollowers(profileDid, { cursor });
    }

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      // Load the profile to get the follower count
      dataLayer.declarative.ensureDetailedProfile(profileDid);
      await loadFollowers();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    });
  }
}

export default new ProfileFollowersView();
