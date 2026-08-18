import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/infinite-scroll-container.js";

export default async function profileFollowingView({
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

  function followingErrorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading following</div>
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }

  bindPageTitle(root, () => {
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    if (profile?.handle) return `Following @${profile.handle}`;
    return "Following";
  });

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const profileFollowing = dataLayer.derived.$profileFollows.get(profileDid);
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    const profileFollowingRequestStatus =
      dataLayer.requests.statusStore.$statuses.get(
        "loadProfileFollows-" + profileDid,
      );
    const hasMore = profileFollowing?.cursor ? true : false;

    const subtitle = profile?.followsCount
      ? `${profile.followsCount.toLocaleString()} following`
      : null;

    render(
      html`<div id="profile-following-view">
        ${headerTemplate({
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

  async function loadFollowing({ reload = false } = {}) {
    const cursor = reload
      ? undefined
      : dataLayer.derived.$profileFollows.get(profileDid)?.cursor;
    await dataLayer.requests.loadProfileFollows(profileDid, { cursor });
  }

  function loadPageData() {
    dataLayer.requests.loadDetailedProfile(profileDid);
    loadFollowing({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
