import { html, render } from "/js/lib/lit-html.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { formatLargeNumber } from "/js/utils.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";

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

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      reportService,
      {
        renderFunc: () => renderPage(),
      },
    );

    function quotesErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>Error loading quotes</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const postQuotes = dataLayer.selectors.getPostQuotes(postUri);
      const post = dataLayer.selectors.getPost(postUri);
      const postQuotesRequestStatus =
        dataLayer.requests.getStatus("loadPostQuotes");

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
    }

    async function loadQuotes() {
      const postQuotes = dataLayer.selectors.getPostQuotes(postUri);
      const cursor = postQuotes?.cursor;
      const loadingPromise = dataLayer.requests.loadPostQuotes(postUri, {
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
      // Load the post thread to get the post quote count
      dataLayer.declarative.ensurePostThread(postUri).then(() => {
        renderPage();
      });
      await loadQuotes();
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

export default new PostQuotesView();
