import { html, render } from "/js/lib/lit-html.js";
import { View } from "/js/views/view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { formatLargeNumber } from "/js/utils.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { bindToPage, pageEffect } from "/js/router.js";

class PostQuotesView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      identityResolver,
      notificationService,
      chatNotificationService,
      postComposerService,
      reportService,
      isAuthenticated,
      pluginService,
      interactionHandlers,
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

    const { postInteractionHandler } = interactionHandlers;

    function quotesErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading quotes</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const postQuotes = dataLayer.derived.$hydratedPostQuotes.get(postUri);
      const post = dataLayer.derived.$hydratedPosts.get(postUri);
      const postQuotesRequestStatus =
        dataLayer.requests.statusStore.$statuses.get(
          "loadPostQuotes-" + postUri,
        );

      const subtitle = post?.quoteCount
        ? `${formatLargeNumber(post.quoteCount)} ${
            post.quoteCount === 1 ? "quote" : "quotes"
          }`
        : null;

      // Format as feed for postFeedTemplate
      const postQuotesFeed = postQuotes
        ? {
            feed: postQuotes.posts.map((quote) => ({ post: quote })),
            cursor: postQuotes.cursor,
          }
        : null;

      render(
        html`<div id="post-quotes-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            children: html`${headerTemplate({
                title: "Quotes",
                subtitle,
              })}
              <main style="position: relative;">
                ${postQuotesRequestStatus.error
                  ? quotesErrorTemplate({
                      error: postQuotesRequestStatus.error,
                    })
                  : postFeedTemplate({
                      feed: postQuotesFeed,
                      currentUser,
                      isAuthenticated,
                      onLoadMore: loadQuotes,
                      postInteractionHandler,
                      emptyMessage: "No quotes yet.",
                      pluginService,
                    })}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    async function loadQuotes() {
      const postQuotes = dataLayer.dataStore.$postQuotes.get(postUri);
      const cursor = postQuotes?.cursor;
      await dataLayer.requests.loadPostQuotes(postUri, { cursor });
    }

    root.addEventListener("page-enter", async () => {
      if (isAuthenticated) {
        dataLayer.declarative.ensureCurrentUser();
      }
      // Load the post thread to get the post quote count
      dataLayer.declarative.ensurePostThread(postUri);
      await loadQuotes();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    });
  }
}

export default new PostQuotesView();
