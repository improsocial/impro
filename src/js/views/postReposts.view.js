import { html, render } from "/js/lib/lit-html.js";
import { requireAuth } from "/js/auth.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { profileListItemTemplate, profileListItemSkeletonTemplate } from "/js/templates/profileListItem.template.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/infinite-scroll-container.js";

class PostRepostsView extends View {
  async render({
    root,
    params,
    context: { dataLayer, identityResolver, notificationService, chatNotificationService, postComposerService },
  }) {
    await requireAuth();

    const { handleOrDid, rkey } = params;

    let authorDid = null;
    if (handleOrDid.startsWith("did:")) {
      authorDid = handleOrDid;
    } else {
      authorDid = await identityResolver.resolveHandle(handleOrDid);
    }
    const postUri = `at://${authorDid}/app.bsky.feed.post/${rkey}`;

    function repostsListTemplate({ reposts, hasMore }) {
      if (!reposts || reposts.length === 0) {
        return html`<div class="search-status-message">No reposts yet.</div>`;
      }
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadReposts();
            e.detail.resume();
          }
        }}
      >
        <div class="profile-list">
          ${reposts.map((repost) => profileListItemTemplate({ actor: repost }))}
        </div>
        ${hasMore
          ? Array.from({ length: 5 }).map(() => profileListItemSkeletonTemplate())
          : ""}
      </infinite-scroll-container>`;
    }

    function repostsSkeletonTemplate() {
      return html`<div class="profile-list">
        ${Array.from({ length: 10 }).map(() => profileListItemSkeletonTemplate())}
      </div>`;
    }

    function repostsErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading reposts</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications = notificationService.getNumNotifications();
      const numChatNotifications = chatNotificationService?.getNumNotifications() ?? null;
      const postReposts = dataLayer.selectors.getPostReposts(postUri);
      const post = dataLayer.selectors.getPost(postUri);
      const postRepostsRequestStatus =
        dataLayer.requests.getStatus("loadPostReposts");
      const hasMore = postReposts?.cursor ? true : false;
      const subtitle = post?.repostCount
        ? `${formatLargeNumber(post.repostCount)} ${
            post.repostCount === 1 ? "repost" : "reposts"
          }`
        : null;

      render(
        html`<div id="post-reposts-view">
          ${mainLayoutTemplate({
            onClickComposeButton: () => postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            children: html`${textHeaderTemplate({
                title: "Reposted by",
                subtitle,
              })}
              <main style="position: relative;">
                ${(() => {
                  if (postRepostsRequestStatus.error) {
                    return repostsErrorTemplate({
                      error: postRepostsRequestStatus.error,
                    });
                  } else if (postReposts && postReposts.reposts) {
                    return repostsListTemplate({
                      reposts: postReposts.reposts,
                      hasMore,
                    });
                  } else {
                    return repostsSkeletonTemplate();
                  }
                })()}
              </main>`,
          })}
        </div>`,
        root
      );
    }

    async function loadReposts() {
      const postReposts = dataLayer.selectors.getPostReposts(postUri);
      const cursor = postReposts?.cursor;
      const loadingPromise = dataLayer.requests.loadPostReposts(postUri, {
        cursor,
      });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarations.ensureCurrentUser().then(() => {
        renderPage();
      });
      // Load the post thread to get the post repost count
      dataLayer.declarations.ensurePostThread(postUri).then(() => {
        renderPage();
      });
      await loadReposts();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      renderPage();
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    });

    notificationService.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new PostRepostsView();
