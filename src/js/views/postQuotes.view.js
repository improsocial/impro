import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { formatLargeNumber } from "/js/utils.js";
import { postFeedTemplate } from "/js/templates/postFeed.template.js";
import { pageEffect, bindPageTitle, onPageShow } from "/js/router.js";

export default async function postQuotesView({
  root,
  params,
  context: {
    dataLayer,
    identityResolver,
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
      <button
        class="rounded-button rounded-button-secondary-inverted"
        @click=${() => window.location.reload()}
      >
        Try again
      </button>
    </div>`;
  }

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const postQuotes = dataLayer.derived.$hydratedPostQuotes.get(postUri);
    const post = dataLayer.derived.$hydratedPosts.get(postUri);
    const postQuotesRequestStatus =
      dataLayer.requests.statusStore.$statuses.get("loadPostQuotes-" + postUri);

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
        ${headerTemplate({
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
        </main>
      </div>`,
      root,
    );
  });

  bindPageTitle(root, () => "Quoted by");

  async function loadQuotes({ reload = false } = {}) {
    const cursor = reload
      ? undefined
      : dataLayer.derived.$hydratedPostQuotes.get(postUri)?.cursor;
    await dataLayer.requests.loadPostQuotes(postUri, { cursor });
  }

  function loadPageData() {
    dataLayer.requests.loadPostThread(postUri);
    loadQuotes({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });
}
