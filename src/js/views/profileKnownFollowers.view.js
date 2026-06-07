import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/infinite-scroll-container.js";

class ProfileKnownFollowersView extends View {
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

    function errorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading followers you know</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const knownFollowers = dataLayer.derived.$knownFollowers.get(profileDid);
      const profile = dataLayer.derived.$hydratedProfiles.get(profileDid);
      const requestStatus = dataLayer.requests.statusStore.$statuses.get(
        "loadKnownFollowers-" + profileDid,
      );
      // Note, the knownFollowers response doesn't actually include a cursor right now
      // but we'll leave this here for future-proofing
      const hasMore = knownFollowers?.cursor ? true : false;
      render(
        html`<div id="profile-known-followers-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            children: html`${headerTemplate({
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
                  });
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    async function loadKnownFollowers() {
      const knownFollowers = dataLayer.derived.$knownFollowers.get(profileDid);
      const cursor = knownFollowers?.cursor;
      await dataLayer.requests.loadKnownFollowers(profileDid, { cursor });
    }

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      dataLayer.declarative.ensureProfile(profileDid);
      await loadKnownFollowers();
    });

    root.addEventListener("page-restore", async (event) => {
      const scrollY = event.detail?.scrollY ?? 0;
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    });
  }
}

export default new ProfileKnownFollowersView();
