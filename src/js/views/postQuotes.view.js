import { html, render } from "/js/lib/lit-html.js";
import { View } from "./view.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { formatLargeNumber } from "/js/utils.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";
import "/js/components/infinite-scroll-container.js";

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

    const postInteractionHandler = new PostInteractionHandler(
      dataLayer,
      postComposerService,
      {
        renderFunc: () => renderPage(),
      }
    );

    function quotesListTemplate({ quotes, hasMore, currentUser }) {
      if (!quotes || quotes.length === 0) {
        return html`<div class="search-status-message">No quotes yet.</div>`;
      }
      return html`<infinite-scroll-container
        @load-more=${async (e) => {
          if (hasMore) {
            await loadQuotes();
            e.detail.resume();
          }
        }}
      >
        <div class="post-list">
          ${quotes.map((quote) =>
            smallPostTemplate({
              post: quote,
              isUserPost: currentUser?.did === quote.author?.did,
              postInteractionHandler,
            })
          )}
        </div>
        ${hasMore
          ? Array.from({ length: 5 }).map(() => postSkeletonTemplate())
          : ""}
      </infinite-scroll-container>`;
    }

    function quotesSkeletonTemplate() {
      return html`<div class="post-list">
        ${Array.from({ length: 10 }).map(() => postSkeletonTemplate())}
      </div>`;
    }

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
      const hasMore = postQuotes?.cursor ? true : false;

      const subtitle = post?.quoteCount
        ? `${formatLargeNumber(post.quoteCount)} ${
            post.quoteCount === 1 ? "quote" : "quotes"
          }`
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
            children: html`${textHeaderTemplate({
                title: "Quotes",
                subtitle,
              })}
              <main style="position: relative;">
                ${(() => {
                  if (postQuotesRequestStatus.error) {
                    return quotesErrorTemplate({
                      error: postQuotesRequestStatus.error,
                    });
                  } else if (postQuotes && postQuotes.posts) {
                    return quotesListTemplate({
                      quotes: postQuotes.posts,
                      currentUser,
                      hasMore,
                    });
                  } else {
                    return quotesSkeletonTemplate();
                  }
                })()}
              </main>`,
          })}
        </div>`,
        root
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
        dataLayer.declarations.ensureCurrentUser().then(() => {
          renderPage();
        });
      }
      // Load the post thread to get the post quote count
      dataLayer.declarations.ensurePostThread(postUri).then(() => {
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
