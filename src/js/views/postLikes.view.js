import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { bindToPage } from "/js/router.js";
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

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const postLikes = dataLayer.selectors.getPostLikes(postUri);
      const post = dataLayer.selectors.getPost(postUri);
      const postLikesRequestStatus = dataLayer.requests.getStatus(
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
    }

    async function loadLikes() {
      const postLikes = dataLayer.selectors.getPostLikes(postUri);
      const cursor = postLikes?.cursor;
      const loadingPromise = dataLayer.requests.loadPostLikes(postUri, {
        cursor,
      });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      if (isAuthenticated) {
        dataLayer.declarative.ensureCurrentUser().then(() => {
          renderPage();
        });
      }
      // Load the post thread to get the post like count
      dataLayer.declarative.ensurePostThread(postUri).then(() => {
        renderPage();
      });
      await loadLikes();
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

export default new PostLikesView();
