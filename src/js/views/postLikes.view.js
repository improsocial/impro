import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/infinite-scroll-container.js";

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

  let authorDid = null;
  if (handleOrDid.startsWith("did:")) {
    authorDid = handleOrDid;
  } else {
    authorDid = await identityResolver.resolveHandle(handleOrDid);
  }
  const postUri = `at://${authorDid}/app.bsky.feed.post/${rkey}`;

  function likesErrorTemplate({ error }) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading likes</div>
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const postLikes = dataLayer.derived.$postLikes.get(postUri);
    const post = dataLayer.derived.$hydratedPosts.get(postUri);
    const postLikesError = dataLayer.derived.$postLikesError.get(postUri);
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
            if (postLikesError) {
              return likesErrorTemplate({ error: postLikesError });
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
    await dataLayer.requests.loadPostLikes({ postUri }, { reload });
  }

  function loadPageData() {
    dataLayer.requests.loadPostThread({ uri: postUri });
    loadLikes({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
