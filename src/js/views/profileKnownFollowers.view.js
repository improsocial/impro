import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/infinite-scroll-container.js";

export default async function profileKnownFollowersView({
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

  function errorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading followers you know</div>
      <button
        class="rounded-button rounded-button-secondary-inverted"
        @click=${() => window.location.reload()}
      >
        Try again
      </button>
    </div>`;
  }

  bindPageTitle(root, () => "Followers you know");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const knownFollowers = dataLayer.derived.$knownFollowers.get(profileDid);
    const profile = dataLayer.derived.$hydratedDetailedProfiles.get(profileDid);
    const requestStatus = dataLayer.requests.statusStore.$statuses.get(
      "loadKnownFollowers-" + profileDid,
    );
    // Note, the knownFollowers response doesn't actually include a cursor right now
    // but we'll leave this here for future-proofing
    const hasMore = knownFollowers?.cursor ? true : false;
    render(
      html`<div id="profile-known-followers-view">
        ${headerTemplate({
          title: profile ? getDisplayName(profile) : "",
          subtitle: "Followers you know",
        })}
        <main style="position: relative;">
          ${(() => {
            if (requestStatus.error) {
              return errorTemplate({ error: requestStatus.error });
            }
            return profileFeedTemplate({
              profiles: knownFollowers?.followers ?? null,
              hasMore,
              onLoadMore: loadKnownFollowers,
              emptyMessage: profile
                ? `You don't follow anyone who follows @${profile.handle}.`
                : "You don't follow anyone who follows this user.",
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

  async function loadKnownFollowers({ reload = false } = {}) {
    const cursor = reload
      ? undefined
      : dataLayer.derived.$knownFollowers.get(profileDid)?.cursor;
    await dataLayer.requests.loadKnownFollowers(profileDid, { cursor });
  }

  function loadPageData() {
    dataLayer.requests.loadDetailedProfile(profileDid);
    loadKnownFollowers({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
