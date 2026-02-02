import { html, keyed } from "/js/lib/lit-html.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { linkToPost } from "/js/navigation.js";

function feedFeedbackMessageTemplate({ post }) {
  // Attach post URI, we use it to maintain scroll position when feedback is sent
  return html`
    <div class="feed-feedback-message" data-post-uri="${post.uri}">
      <div class="feed-feedback-message-inner">
        Your feedback has been sent to the feed operator.
      </div>
    </div>
  `;
}

function postTemplate({ post, hiddenPostUris, ...props }) {
  if (hiddenPostUris.includes(post.uri)) {
    return feedFeedbackMessageTemplate({ post });
  } else {
    return smallPostTemplate({
      post,
      ...props,
    });
  }
}

function replyContextTemplate({
  reply,
  post,
  currentUser,
  hiddenPostUris,
  postInteractionHandler,
  onClickShowLess,
  onClickShowMore,
  enableFeedFeedback,
}) {
  const root = reply.root;
  const parent = reply.parent;
  const grandparentAuthor = reply.grandparentAuthor;
  // don't show view more link if the parent's parent is the root
  const showViewMoreLink = parent.record.reply?.parent.uri !== root?.uri;
  const viewMoreLink = root?.author ? linkToPost(root) : linkToPost(post);
  return html`
    <div class="reply-context">
      ${root
        ? html`
            ${postTemplate({
              post: root,
              isUserPost: root?.author?.did === currentUser?.did,
              replyContext: "root",
              hiddenPostUris,
              postInteractionHandler,
              onClickShowLess,
              onClickShowMore,
              enableFeedFeedback,
              hideMutedAccount: true,
            })}
          `
        : ""}
      ${root?.uri !== parent?.uri
        ? html`
            ${showViewMoreLink
              ? html`
                  <div class="load-more-link">
                    <div class="load-more-spacer">
                      <div class="reply-context-ellipsis"></div>
                    </div>
                    <a href="${viewMoreLink}">View full thread</a>
                  </div>
                `
              : ""}
            ${postTemplate({
              post: parent,
              isUserPost: parent.author?.did === currentUser?.did,
              replyContext: "parent",
              showReplyToLabel: !!grandparentAuthor,
              replyToAuthor: grandparentAuthor,
              hiddenPostUris,
              postInteractionHandler,
              onClickShowLess,
              onClickShowMore,
              enableFeedFeedback,
              hideMutedAccount: true,
            })}
          `
        : ""}
    </div>
  `;
}

function feedItemTemplate({
  feedItem,
  currentUser,
  hiddenPostUris,
  postInteractionHandler,
  onClickShowLess,
  onClickShowMore,
  enableFeedFeedback,
}) {
  const post = feedItem.post;
  const reply = feedItem.reply;
  const feedContext = feedItem.feedContext;
  const reason = feedItem.reason;
  const repostAuthor =
    reason && reason.$type === "app.bsky.feed.defs#reasonRepost"
      ? reason.by
      : null;
  const showReplyContext = !!reply?.parent && !repostAuthor;
  // If the post has a parent but reply context isn't shown, show the reply-to label
  const showReplyToLabel = !!post.record?.reply && !showReplyContext;
  let replyToAuthor = null;
  if (showReplyToLabel) {
    replyToAuthor =
      reply?.parent?.author || post.record?.reply?.parentAuthor || null;
  }
  const isPinned = reason && reason.$type === "app.bsky.feed.defs#reasonPin";
  return html`
    <div>
      ${showReplyContext
        ? replyContextTemplate({
            reply,
            post,
            currentUser,
            feedContext,
            hiddenPostUris,
            postInteractionHandler,
            onClickShowLess,
            onClickShowMore,
            enableFeedFeedback,
          })
        : ""}
      ${postTemplate({
        post,
        isPinned,
        hiddenPostUris,
        isUserPost: currentUser?.did === post.author?.did,
        replyContext: showReplyContext ? "reply" : null,
        postInteractionHandler,
        onClickShowLess,
        onClickShowMore,
        repostAuthor,
        showReplyToLabel,
        replyToAuthor,
        enableFeedFeedback,
      })}
    </div>
  `;
}

function feedSkeletonTemplate() {
  return html`<div class="feed">
    ${Array.from({ length: 10 }).map((_, index) => {
      return postSkeletonTemplate();
    })}
  </div>`;
}

export function postFeedTemplate({
  feed,
  currentUser,
  feedGenerator = null,
  hiddenPostUris = [],
  onLoadMore,
  postInteractionHandler,
  onClickShowLess,
  onClickShowMore,
  enableFeedFeedback = false,
  emptyMessage = null,
}) {
  if (!feed) {
    return feedSkeletonTemplate();
  }
  if (feed.feed.length === 0) {
    return html`<div class="feed">
      <div class="feed-end-message">${emptyMessage ?? "Feed is empty."}</div>
    </div>`;
  }
  const hasMore = !!feed.cursor;
  try {
    return html`
      <infinite-scroll-container
        lookahead="2500px"
        @load-more=${async (e) => {
          if (hasMore && onLoadMore) {
            await onLoadMore();
            e.detail.resume();
          }
        }}
      >
        <div class="feed">
          ${feed.feed.map((feedItem, i) => {
            // data attributes are used by post seen observer
            const content = html`<div
              class="feed-item"
              data-feed-context="${feedItem.feedContext}"
              data-post-uri="${feedItem.post.uri}"
              data-feed-generator-uri="${feedGenerator?.uri ?? ""}"
            >
              ${keyed(
                feedItem.post.uri,
                feedItemTemplate({
                  feedItem,
                  currentUser,
                  hiddenPostUris,
                  postInteractionHandler,
                  onClickShowLess,
                  onClickShowMore,
                  enableFeedFeedback,
                }),
              )}
            </div>`;
            if (i < feed.feed.length - 1) {
              return content;
            }
            // if it's the last item, add a loading indicator
            const endingElement = hasMore
              ? html`<div class="feed-loading-indicator">
                  <div class="loading-spinner"></div>
                </div>`
              : html`<div class="feed-end-message">End of feed</div>`;
            return html`<div>${content}${endingElement}</div>`;
          })}
        </div>
      </infinite-scroll-container>
    `;
  } catch (error) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading posts</div>
      <button @click=${() => window.location.reload()}>Try again</button>
    </div>`;
  }
}
