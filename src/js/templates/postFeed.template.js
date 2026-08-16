import { html, keyed } from "/js/lib/lit-html.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { mutedParentToggleTemplate } from "/js/templates/mutedParentToggle.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { linkToPost } from "/js/navigation.js";
import { isEmptyPost, isBlockedPost } from "/js/dataHelpers.js";

// Posts likely to be above the fold on load; lazy load the rest
const EAGER_IMAGE_ITEM_COUNT = 5;

function feedFeedbackMessageTemplate({ post }) {
  // Attach post URI, we use it to maintain scroll position when feedback is sent
  return html`
    <div
      class="feed-feedback-message"
      data-testid="feed-feedback-message"
      data-post-uri="${post.uri}"
    >
      <div class="feed-feedback-message-inner">
        Thank you for your feedback! It has been sent to the feed operator.
      </div>
    </div>
  `;
}

function postTemplate({ post, hiddenPostUris, isParent = false, ...props }) {
  if (hiddenPostUris.includes(post.uri)) {
    return feedFeedbackMessageTemplate({ post });
  }
  const rendered = smallPostTemplate({
    post,
    ...props,
    ignoreMuteWarning: isParent || props.ignoreMuteWarning,
  });
  if (isParent) {
    return mutedParentToggleTemplate({ post, children: rendered });
  }
  return rendered;
}

function replyContextTemplate({
  reply,
  post,
  currentUser,
  isAuthenticated,
  hiddenPostUris,
  postInteractionHandler,
  onClickShowLess,
  onClickShowMore,
  enableFeedFeedback,
  pluginService,
  lazyLoadImages,
}) {
  const root = reply.root;
  const parent = reply.parent;
  const grandparentAuthor = reply.grandparentAuthor;
  const rootExists = !!root && !isEmptyPost(root);
  const grandparentIsRoot = parent.record.reply?.parent.uri === root?.uri;
  // don't show view more link if the parent's parent is the root
  const showViewMoreLink = rootExists && !grandparentIsRoot;
  // when the root is blocked or deleted, show a label on the parent instead of
  // a tombstone post
  let replyToBlocked = false;
  let showParentReplyToLabel;
  if (rootExists) {
    showParentReplyToLabel = !!grandparentAuthor && showViewMoreLink;
  } else {
    const replyToTombstoneRoot = !!root && grandparentIsRoot;
    replyToBlocked = replyToTombstoneRoot && isBlockedPost(root);
    showParentReplyToLabel = !!grandparentAuthor || replyToTombstoneRoot;
  }
  return html`
    <div class="reply-context">
      ${rootExists
        ? html`
            ${postTemplate({
              post: root,
              currentUser,
              isAuthenticated,
              isUserPost: root.author?.did === currentUser?.did,
              replyContext: "root",
              hiddenPostUris,
              postInteractionHandler,
              onClickShowLess,
              onClickShowMore,
              enableFeedFeedback,
              pluginService,
              lazyLoadImages,
              isParent: true,
            })}
          `
        : ""}
      ${root?.uri !== parent.uri
        ? html`
            ${showViewMoreLink
              ? html`
                  <div class="load-more-link">
                    <div class="load-more-spacer">
                      <div class="reply-context-line-gap"></div>
                    </div>
                    <a href="${linkToPost(root)}">View full thread</a>
                  </div>
                `
              : ""}
            ${postTemplate({
              post: parent,
              currentUser,
              isAuthenticated,
              isUserPost: parent.author?.did === currentUser?.did,
              replyContext: rootExists ? "parent" : "root",
              showReplyToLabel: showParentReplyToLabel,
              replyToAuthor: grandparentAuthor,
              replyToBlocked,
              hiddenPostUris,
              postInteractionHandler,
              onClickShowLess,
              onClickShowMore,
              enableFeedFeedback,
              pluginService,
              lazyLoadImages,
              isParent: true,
            })}
          `
        : ""}
    </div>
  `;
}

function feedItemTemplate({
  feedItem,
  currentUser,
  isAuthenticated,
  feedGenerator,
  hiddenPostUris,
  postInteractionHandler,
  onClickShowLess,
  onClickShowMore,
  enableFeedFeedback,
  pluginService,
  lazyLoadImages,
}) {
  const post = feedItem.post;
  const reply = feedItem.reply;
  const feedContext = feedItem.feedContext;
  const reason = feedItem.reason;
  const repostAuthor =
    reason && reason.$type === "app.bsky.feed.defs#reasonRepost"
      ? reason.by
      : null;
  const isPinned = reason && reason.$type === "app.bsky.feed.defs#reasonPin";
  const parent = reply?.parent;
  const parentIsView = !!parent && !isEmptyPost(parent);
  const showReplyContext = parentIsView && !repostAuthor && !isPinned;
  // If the post has a parent but reply context isn't shown, show the reply-to label
  const showReplyToLabel = !!post.record?.reply && !showReplyContext;
  let replyToAuthor = null;
  let replyToBlocked = false;
  if (showReplyToLabel) {
    replyToAuthor =
      (parentIsView ? parent.author : null) ||
      post.record?.reply?.parentAuthor ||
      null;
    replyToBlocked = !!parent && isBlockedPost(parent);
  }
  return html`
    <div>
      ${showReplyContext
        ? replyContextTemplate({
            reply,
            post,
            currentUser,
            isAuthenticated,
            feedContext,
            hiddenPostUris,
            postInteractionHandler,
            onClickShowLess,
            onClickShowMore,
            enableFeedFeedback,
            pluginService,
            lazyLoadImages,
          })
        : ""}
      ${postTemplate({
        post,
        currentUser,
        isAuthenticated,
        isPinned,
        feedContext,
        feedGenerator,
        hiddenPostUris,
        isUserPost: currentUser?.did === post.author?.did,
        replyContext: showReplyContext ? "reply" : null,
        postInteractionHandler,
        onClickShowLess,
        onClickShowMore,
        repostAuthor,
        showReplyToLabel,
        replyToAuthor,
        replyToBlocked,
        enableFeedFeedback,
        pluginService,
        lazyLoadImages,
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
  isAuthenticated,
  feedGenerator = null,
  hiddenPostUris = [],
  onLoadMore,
  postInteractionHandler,
  onClickShowLess,
  onClickShowMore,
  enableFeedFeedback = false,
  emptyMessage = null,
  showEndMessage = false,
  pluginService,
}) {
  if (!feed) {
    return feedSkeletonTemplate();
  }
  if (feed.feed.length === 0) {
    return html`<div class="feed">
      <div class="feed-end-message" data-testid="feed-end-message">
        ${emptyMessage ?? "This feed is empty."}
      </div>
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
        <div class="feed" data-testid="feed">
          ${feed.feed.map((feedItem, i) => {
            // data attributes are used by post seen observer
            const content = html`<div
              class="feed-item"
              data-testid="feed-item"
              data-post-uri="${feedItem.post.uri}"
              data-feed-generator-uri="${feedGenerator?.uri ?? ""}"
            >
              ${keyed(
                feedItem.post.uri,
                feedItemTemplate({
                  feedItem,
                  currentUser,
                  isAuthenticated,
                  feedGenerator,
                  hiddenPostUris,
                  postInteractionHandler,
                  onClickShowLess,
                  onClickShowMore,
                  enableFeedFeedback,
                  pluginService,
                  lazyLoadImages: i >= EAGER_IMAGE_ITEM_COUNT,
                }),
              )}
            </div>`;
            if (i < feed.feed.length - 1) {
              return content;
            }
            // if it's the last item, add a loading indicator
            const endingElement = hasMore
              ? html`<div
                  class="feed-loading-indicator"
                  data-testid="feed-loading-indicator"
                >
                  <div class="loading-spinner"></div>
                </div>`
              : showEndMessage
                ? html`<div
                    class="feed-end-message"
                    data-testid="feed-end-message"
                  >
                    End of feed
                  </div>`
                : null;
            return html`<div>${content}${endingElement}</div>`;
          })}
        </div>
      </infinite-scroll-container>
    `;
  } catch (error) {
    console.error(error);
    return html`<div class="error-state">
      <div>Error loading posts</div>
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }
}
