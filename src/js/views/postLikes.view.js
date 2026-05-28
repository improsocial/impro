import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/infinite-scroll-container.js";

class PostLikesView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      identityResolver,
      notificationService,
      chatNotificationService,
      postComposerService,
      isAuthenticated,
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
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const postLikes = dataLayer.dataStore.$postLikes.get(postUri).get();
      const post = dataLayer.derived.$hydratedPosts.get(postUri).get();
      const postLikesRequestStatus = dataLayer.requests.statusStore.$statuses
        .get("loadPostLikes-" + postUri)
        .get();
      const hasMore = postLikes?.cursor ? true : false;

      const subtitle = post?.likeCount
        ? `${formatLargeNumber(post.likeCount)} ${
            post.likeCount === 1 ? "like" : "likes"
          }`
        : null;

      render(
        html`<div id="post-likes-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            children: html`${headerTemplate({
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
                    profiles:
                      postLikes?.likes?.map((like) => like.actor) ?? null,
                    hasMore,
                    onLoadMore: loadLikes,
                    emptyMessage: "No likes yet.",
                  });
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    async function loadLikes() {
      const postLikes = dataLayer.dataStore.$postLikes.get(postUri).get();
      const cursor = postLikes?.cursor;
      await dataLayer.requests.loadPostLikes(postUri, { cursor });
    }

    root.addEventListener("page-enter", async () => {
      if (isAuthenticated) {
        dataLayer.declarative.ensureCurrentUser();
      }
      // Load the post thread to get the post like count
      dataLayer.declarative.ensurePostThread(postUri);
      await loadLikes();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    });
  }
}

export default new PostLikesView();
