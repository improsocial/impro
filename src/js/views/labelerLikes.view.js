import { html, render } from "/js/lib/lit-html.js";
import { resolveDidFromHandleOrDid } from "/js/atproto.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileListTemplate } from "/js/templates/profileList.template.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/infinite-scroll-container.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";

export default async function labelerLikesView({
  root,
  params,
  context: {
    dataLayer,
    identityResolver,
    isAuthenticated,
    interactionHandlers,
    pluginService,
  },
}) {
  const labelerDid = await resolveDidFromHandleOrDid(
    params.handleOrDid,
    identityResolver,
  );
  const labelerUri = `at://${labelerDid}/app.bsky.labeler.service/self`;

  function likesErrorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state" data-testid="likes-error">
      <div>Error loading likes</div>
      ${tryAgainButtonTemplate()}
    </div>`;
  }

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const likes = dataLayer.derived.$postLikes.get(labelerUri);
    const labelerInfo = dataLayer.derived.$labelerInfo.get(labelerDid);
    const likesRequestStatus = dataLayer.requests.statusStore.$statuses.get(
      "loadPostLikes-" + labelerUri,
    );
    const hasMore = likes?.cursor ? true : false;
    const likeCount = labelerInfo?.likeCount;

    const subtitle = likeCount
      ? `${formatLargeNumber(likeCount)} ${likeCount === 1 ? "like" : "likes"}`
      : null;

    render(
      html`<div id="labeler-likes-view">
        ${headerTemplate({
          title: "Liked by",
          subtitle,
        })}
        <main style="position: relative;">
          ${(() => {
            if (likesRequestStatus.error) {
              return likesErrorTemplate({ error: likesRequestStatus.error });
            }
            return profileListTemplate({
              profiles: likes?.likes?.map((like) => like.actor) ?? null,
              hasMore,
              onLoadMore: loadLikes,
              emptyMessage: "No likes yet.",
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

  bindPageTitle(root, () => "Liked by");

  async function loadLikes({ reload = false } = {}) {
    const cursor = reload
      ? undefined
      : dataLayer.derived.$postLikes.get(labelerUri)?.cursor;
    await dataLayer.requests.loadPostLikes(labelerUri, { cursor });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    dataLayer.requests.loadLabelerInfo(labelerDid);
    loadLikes({ reload: true });
  });
}
