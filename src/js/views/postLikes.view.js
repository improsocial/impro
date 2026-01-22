import { html, render } from "/js/lib/lit-html.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import {
  profileListItemTemplate,
  profileListItemSkeletonTemplate,
} from "/js/templates/profileListItem.template.js";
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

    function likesListTemplate({ likes, hasMore }) {
      if (!likes || likes.length === 0) {
        return html`<div class="search-status-message">No likes yet.</div>`;
      }
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadLikes();
            e.detail.resume();
          }
        }}
      >
        <div class="profile-list">
          ${likes.map((like) => profileListItemTemplate({ actor: like.actor }))}
        </div>
        ${hasMore
          ? Array.from({ length: 5 }).map(() =>
              profileListItemSkeletonTemplate(),
            )
          : ""}
      </infinite-scroll-container>`;
    }

    function likesSkeletonTemplate() {
      return html`<div class="profile-list">
        ${Array.from({ length: 10 }).map(() =>
          profileListItemSkeletonTemplate(),
        )}
      </div>`;
    }

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
      const postLikesRequestStatus =
        dataLayer.requests.getStatus("loadPostLikes");
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
            children: html`${textHeaderTemplate({
                title: "Liked by",
                subtitle,
              })}
              <main style="position: relative;">
                ${(() => {
                  if (postLikesRequestStatus.error) {
                    return likesErrorTemplate({
                      error: postLikesRequestStatus.error,
                    });
                  } else if (postLikes && postLikes.likes) {
                    return likesListTemplate({
                      likes: postLikes.likes,
                      hasMore,
                    });
                  } else {
                    return likesSkeletonTemplate();
                  }
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

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new PostLikesView();
