import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import { formatLargeNumber } from "/js/utils.js";
import "/js/components/infinite-scroll-container.js";

class PostRepostsView extends View {
  async render({
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

    function repostsErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading reposts</div>
        <button class="rounded-button" @click=${() => window.location.reload()}>
          Try again
        </button>
      </div>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const postReposts = dataLayer.derived.$postReposts.get(postUri);
      const post = dataLayer.derived.$hydratedPosts.get(postUri);
      const postRepostsRequestStatus =
        dataLayer.requests.statusStore.$statuses.get(
          "loadPostReposts-" + postUri,
        );
      const hasMore = postReposts?.cursor ? true : false;
      const subtitle = post?.repostCount
        ? `${formatLargeNumber(post.repostCount)} ${
            post.repostCount === 1 ? "repost" : "reposts"
          }`
        : null;

      render(
        html`<div id="post-reposts-view">
          ${headerTemplate({
            title: "Reposted by",
            subtitle,
          })}
          <main style="position: relative;">
            ${(() => {
              if (postRepostsRequestStatus.error) {
                return repostsErrorTemplate({
                  error: postRepostsRequestStatus.error,
                });
              }
              return profileFeedTemplate({
                profiles: postReposts?.repostedBy ?? null,
                hasMore,
                onLoadMore: loadReposts,
                emptyMessage: "No reposts yet.",
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

    bindPageTitle(root, () => "Reposted by");

    async function loadReposts() {
      const postReposts = dataLayer.derived.$postReposts.get(postUri);
      const cursor = postReposts?.cursor;
      await dataLayer.requests.loadPostReposts(postUri, { cursor });
    }

    root.addEventListener("page-enter", async () => {
      // Load the post thread to get the post repost count
      dataLayer.declarative.ensurePostThread(postUri);
      await loadReposts();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        if (scrollY > 0) {
          window.scrollTo(0, scrollY);
        }
      } else {
        window.scrollTo(0, 0);
        await dataLayer.requests.loadPostReposts(postUri);
      }
    });
  }
}

export default new PostRepostsView();
