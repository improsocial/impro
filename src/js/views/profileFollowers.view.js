import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/infinite-scroll-container.js";

export default async function profileFollowersView({
  root,
  params,
  context: {
    auth,
    dataLayer,
    identityResolver,
    interactionHandlers,
    isAuthenticated,
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
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }

  bindPageTitle(root, () => {
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    if (profile?.handle) return `Followers of @${profile.handle}`;
    return "Followers";
  });

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const profileFollowers =
      dataLayer.derived.$profileFollowers.get(profileDid);
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    const followersError =
      dataLayer.derived.$profileFollowersError.get(profileDid);
    const hasMore = profileFollowers?.cursor ? true : false;

    const subtitle = profile?.followersCount
      ? `${profile.followersCount.toLocaleString()} ${
          profile.followersCount === 1 ? "follower" : "followers"
        }`
      : null;

    render(
      html`<div id="profile-followers-view">
        ${headerTemplate({
          title: profile ? getDisplayName(profile) : "",
          subtitle,
        })}
        <main style="position: relative;">
          ${(() => {
            if (followersError) {
              return followersErrorTemplate({ error: followersError });
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
              pluginService,
            });
          })()}
        </main>
      </div>`,
      root,
    );
  });

  async function loadFollowers({ reload = false } = {}) {
    await dataLayer.requests.loadProfileFollowers(
      { did: profileDid },
      { reload },
    );
  }

  function loadPageData() {
    dataLayer.requests.loadDetailedProfile(profileDid);
    loadFollowers({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
