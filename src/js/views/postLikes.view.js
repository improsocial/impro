import { html, render } from "/js/lib/lit-html.js";
import { resolveDidFromHandleOrDid } from "/js/atproto.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/infinite-scroll-container.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";

export default async function postLikesView({
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
  const { handleOrDid, rkey } = params;

  const authorDid = await resolveDidFromHandleOrDid(
    handleOrDid,
    identityResolver,
  );
  const postUri = `at://${authorDid}/app.bsky.feed.post/${rkey}`;

  function likesErrorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading likes</div>
      ${tryAgainButtonTemplate()}
    </div>`;
  }

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const postLikes = dataLayer.derived.$postLikes.get(postUri);
    const post = dataLayer.derived.$hydratedPosts.get(postUri);
    const postLikesRequestStatus = dataLayer.requests.statusStore.$statuses.get(
      "loadPostLikes-" + postUri,
    );
    const hasMore = postLikes?.cursor ? true : false;

    const subtitle = post?.likeCount
      ? `${formatLargeNumber(post.likeCount)} ${
          post.likeCount === 1 ? "like" : "likes"
        }`
      : null;

    render(
      html`<div id="post-likes-view">
        ${headerTemplate({
          title: "Liked by",
          subtitle,
        })}
        <main style="position: relative;">
          ${(() => {
            if (postLikesRequestStatus.error) {
              return likesErrorTemplate({
                error: postLikesRequestStatus.error,
              });
            }
            return profileFeedTemplate({
              profiles: postLikes?.likes?.map((like) => like.actor) ?? null,
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
      : dataLayer.derived.$postLikes.get(postUri)?.cursor;
    await dataLayer.requests.loadPostLikes(postUri, { cursor });
  }

  function loadPageData() {
    dataLayer.requests.loadPostThread(postUri);
    loadLikes({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
