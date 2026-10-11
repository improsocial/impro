import { html, render } from "/js/lib/lit-html.js";
import { resolveDidFromHandleOrDid } from "/js/atproto.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import {
  sortBy,
  maxBy,
  pinScrollPosition,
  isMobileViewport,
  classnames,
} from "/js/utils.js";
import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
  onPageHide,
} from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { mutedParentToggleTemplate } from "/js/templates/mutedParentToggle.template.js";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import {
  flattenParents,
  isBlockedPost,
  isNotFoundPost,
  isEmptyPost,
  isMutedPost,
  getReplyRootFromPost,
  doHideAuthorOnUnauthenticated,
  canReplyToPost,
} from "/js/dataHelpers.js";
import { ApiError } from "/js/api.js";
import "/js/components/app-icon.js";
import "/js/components/hidden-replies-section.js";
import "/js/components/plugin-slot.js";
import { linkToPostFromUri } from "/js/navigation.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";

const THREAD_TREE_MAX_DEPTH_MOBILE = 4;
const THREAD_TREE_MAX_DEPTH_DESKTOP = 6;
const THREAD_TREE_BRANCHING_FACTOR = 10;

export default async function postThreadView({
  root,
  router,
  params,
  context: {
    dataLayer,
    identityResolver,
    postComposerService,
    isAuthenticated,
    pluginService,
    interactionHandlers,
  },
}) {
  const { handleOrDid, rkey } = params;

  const authorDid = await resolveDidFromHandleOrDid(
    handleOrDid,
    identityResolver,
  );
  const postUri = `at://${authorDid}/app.bsky.feed.post/${rkey}`;

  const { postInteractionHandler, profileInteractionHandler } =
    interactionHandlers;

  // Mirrors social-app: the follow button only shows for authors the viewer
  // isn't following, but stays visible (as "Following") after an in-view
  // follow so it can be undone.
  function doShowFollowButton(
    author,
    rootPost,
    currentUser,
    hasFollowedInView,
  ) {
    if (!isAuthenticated || !currentUser || !author?.did) {
      return false;
    }
    if (author.did === currentUser.did) {
      return false;
    }
    const isRootAuthor = rootPost?.author?.did === author.did;
    const onlyFollowersCanReply = !!rootPost?.threadgate?.record?.allow?.some(
      (rule) => rule.$type === "app.bsky.feed.threadgate#followerRule",
    );
    if (isRootAuthor && onlyFollowersCanReply) {
      return false;
    }
    if (author.viewer?.blocking || author.viewer?.blockedBy) {
      return false;
    }
    return !author.viewer?.following || hasFollowedInView;
  }

  function isNotFoundError(error) {
    return (
      error instanceof ApiError &&
      error.status === 400 &&
      error.data?.error === "NotFound"
    );
  }

  function threadLoadErrorTemplate({ onRetry }) {
    return html`<div
      class="error-state post-thread-load-error"
      data-testid="thread-load-error"
    >
      <div>Couldn't load this thread.</div>
      ${tryAgainButtonTemplate({ onClick: onRetry })}
    </div>`;
  }

  function postThreadErrorTemplate({ error }) {
    if (isNotFoundError(error)) {
      return html`<div class="error-state" data-testid="post-not-found">
        <div>Post not found</div>
        ${tryAgainButtonTemplate()}
      </div>`;
    } else {
      console.error(error);
      return html`<div class="error-state" data-testid="thread-error">
        <div>Error loading thread</div>
        ${tryAgainButtonTemplate()}
      </div>`;
    }
  }

  function replyHasContentLabel(reply) {
    return (
      reply.post.contentLabel && reply.post.contentLabel.visibility !== "ignore"
    );
  }

  function doShowReply(reply) {
    const post = reply.post;
    if (!post) {
      return false;
    }
    if (
      isBlockedPost(post) ||
      isNotFoundPost(post) ||
      isMutedPost(post) ||
      post.isBlockedReply ||
      replyHasContentLabel(reply) ||
      post.isHidden
    ) {
      return false;
    }
    if (
      !isAuthenticated &&
      post.author &&
      doHideAuthorOnUnauthenticated(post.author)
    ) {
      return false;
    }
    return true;
  }

  function getShownReplies(replies) {
    return replies.filter((reply) => doShowReply(reply));
  }

  function buildReplyChain(post) {
    const chain = [post];
    let currentPost = post;
    while (currentPost.replies && currentPost.replies.length > 0) {
      // get most liked reply
      const shownReplies = getShownReplies(currentPost.replies);
      if (shownReplies.length > 0) {
        const mostLikedReply = maxBy(shownReplies, (reply) =>
          getLikesWithoutUser(reply.post),
        );
        chain.push(mostLikedReply);
        currentPost = mostLikedReply;
      } else {
        break;
      }
    }
    return chain;
  }

  // Get likes without the user's like, so that liking posts doesn't affect the order of the replies.
  function getLikesWithoutUser(post) {
    const likeCount = post.likeCount;
    return !!post.viewer?.like ? likeCount - 1 : likeCount;
  }

  function sortReplies(replies, postAuthor) {
    let sortedReplies = sortBy(
      replies,
      (reply) => getLikesWithoutUser(reply.post),
      {
        direction: "desc",
      },
    );
    // Put replies by the post author first
    if (postAuthor) {
      sortedReplies = [
        ...sortedReplies.filter(
          (reply) => reply.post.author?.did === postAuthor.did,
        ),
        ...sortedReplies.filter(
          (reply) => reply.post.author?.did !== postAuthor.did,
        ),
      ];
    }
    // If there's a recent reply from the user, put it at the top
    const recentReplyFromUser = sortedReplies.find(
      (reply) => reply.post.viewer?.priorityReply,
    );
    if (recentReplyFromUser) {
      sortedReplies = [
        recentReplyFromUser,
        ...sortedReplies.filter((reply) => reply !== recentReplyFromUser),
      ];
    }
    return sortedReplies;
  }

  function buildReplyChains(replies, postAuthor) {
    return sortReplies(getShownReplies(replies), postAuthor).map((reply) =>
      buildReplyChain(reply),
    );
  }

  function buildThreadTree(postThread, { maxDepth, postAuthor }) {
    function walk(
      reply,
      depth,
      parentSkippedIndices,
      isLastSibling,
      parentHasMore,
      rows,
    ) {
      const skippedIndentIndices = new Set(parentSkippedIndices);
      if (depth > 1 && isLastSibling && !parentHasMore) {
        skippedIndentIndices.add(depth - 2);
      }
      const replies = depth < maxDepth ? (reply.replies ?? []) : [];
      const shownReplies = sortReplies(getShownReplies(replies), postAuthor);
      const keptReplies = shownReplies.slice(0, THREAD_TREE_BRANCHING_FACTOR);
      const numLoadedReplies = replies.filter(
        (child) => !isNotFoundPost(child.post ?? child),
      ).length;
      const moreReplies =
        Math.max(0, (reply.post.replyCount ?? 0) - numLoadedReplies) +
        (shownReplies.length - keptReplies.length);
      rows.push({
        type: "post",
        key: reply.post.uri,
        reply,
        depth,
        skippedIndentIndices,
        showChildReplyLine: keptReplies.length > 0 || moreReplies > 0,
      });
      keptReplies.forEach((child, i) => {
        walk(
          child,
          depth + 1,
          skippedIndentIndices,
          i === keptReplies.length - 1,
          moreReplies > 0,
          rows,
        );
      });
      if (moreReplies > 0) {
        rows.push({
          type: "readMore",
          key: `readMore:${reply.post.uri}`,
          depth,
          ownerUri: reply.post.uri,
          moreReplies,
          skippedIndentIndices,
        });
      }
    }

    const topLevelReplies = postThread.replies ?? [];
    const items = [];
    for (const reply of sortReplies(
      getShownReplies(topLevelReplies),
      postAuthor,
    )) {
      walk(reply, 1, new Set(), true, false, items);
    }
    const hiddenItems = [];
    for (const reply of topLevelReplies.filter(
      (reply) => !doShowReply(reply) && doPutReplyInHiddenSection(reply),
    )) {
      walk(reply, 1, new Set(), true, false, hiddenItems);
    }
    return { items, hiddenItems };
  }

  function getReplyContext(replyIndex, numReplies) {
    if (numReplies === 1) {
      return null;
    }
    if (replyIndex === 0) {
      return "root";
    } else if (replyIndex === numReplies - 1) {
      return "reply";
    }
    return "parent";
  }

  function replyChainTemplate({ replyChain, currentUser, lazyLoadImages }) {
    const numReplies = replyChain.length;
    return html`<div class="post-thread-reply-chain">
      ${replyChain.map((reply, i) => {
        const post = reply.post;
        if (!post) return "";
        return smallPostTemplate({
          post,
          currentUser,
          isAuthenticated,
          isUserPost: currentUser?.did === post.author?.did,
          postInteractionHandler,
          replyContext: getReplyContext(i, numReplies),
          postNumbering: reply.postNumbering,
          lazyLoadImages,
          pluginService,
        });
      })}
    </div>`;
  }

  async function handleClickReply(post, replyRoot, currentUser) {
    await postComposerService.composePost({
      currentUser,
      replyTo: post,
      replyRoot,
    });
  }

  // Note, this is different from hiding a reply entirely, that's why this name is weirdly specific.
  // Things shown here will also need to be filtered out from the reply chain separately (doShowReply())
  function doPutReplyInHiddenSection(reply) {
    if (!reply.post) {
      return false;
    }
    if (isMutedPost(reply.post) || replyHasContentLabel(reply)) {
      return true;
    }
    // If the post author blocked the replier, put the reply in the hidden section
    if (reply.post.isBlockedReply) {
      return true;
    }
    // Replies can be marked as hidden by bsky sentiment analysis (app.bsky.unspecced.getPostThreadOtherV2)
    if (reply.post.isHidden) {
      return true;
    }
    return false;
  }

  function linearRepliesTemplate({ replies, postAuthor, currentUser }) {
    const hiddenSectionReplies = replies.filter((reply) =>
      doPutReplyInHiddenSection(reply),
    );
    const replyChains = buildReplyChains(replies, postAuthor);
    const isEmpty =
      replyChains.length === 0 && hiddenSectionReplies.length === 0;
    const content = html`<div class="post-thread-reply-chains">
        ${replyChains.map((replyChain, i) =>
          // there can be a lot of images in a reply chain, so lazy load them after the first few
          replyChainTemplate({
            replyChain,
            currentUser,
            lazyLoadImages: i > 20,
          }),
        )}
      </div>
      ${hiddenSectionReplies.length > 0
        ? html`<hidden-replies-section>
            ${hiddenSectionReplies.map((reply) =>
              smallPostTemplate({
                post: reply.post,
                currentUser,
                isAuthenticated,
                isUserPost: currentUser?.did === reply.post?.author?.did,
                postInteractionHandler,
                ignoreContentWarning: true,
                ignoreMuteWarning: true,
                lazyLoadImages: true,
                pluginService,
              }),
            )}
          </hidden-replies-section>`
        : ""}`;
    return { isEmpty, content };
  }

  function treeIndentColumnsTemplate({ depth, skippedIndentIndices }) {
    return Array.from({ length: Math.max(0, depth - 1) }).map(
      (_, i) =>
        html`<span
          class=${classnames("tree-indent-column", {
            "is-skipped": skippedIndentIndices.has(i),
          })}
        ></span>`,
    );
  }

  function treeReplyRowTemplate({
    row,
    currentUser,
    lazyLoadImages,
    isHiddenRoot,
  }) {
    const post = row.reply.post;
    return html`<div
      class=${classnames("post-thread-tree-row", {
        "is-depth-1": row.depth === 1,
      })}
      data-testid="thread-tree-reply"
      data-depth=${row.depth}
    >
      ${treeIndentColumnsTemplate(row)}
      <div class="tree-row-content">
        ${row.depth > 1 ? html`<span class="tree-elbow"></span>` : ""}
        ${row.showChildReplyLine
          ? html`<span class="tree-child-line"></span>`
          : ""}
        ${smallPostTemplate({
          post,
          currentUser,
          isAuthenticated,
          isUserPost: currentUser?.did === post.author?.did,
          postInteractionHandler,
          replyContext: null,
          postNumbering: row.reply.postNumbering,
          ignoreContentWarning: isHiddenRoot,
          ignoreMuteWarning: isHiddenRoot,
          lazyLoadImages,
          pluginService,
        })}
      </div>
    </div>`;
  }

  function treeReadMoreTemplate({ row }) {
    return html`<div class="post-thread-tree-row tree-read-more-row">
      ${treeIndentColumnsTemplate(row)}
      <span class="tree-read-more-elbow"></span>
      <a
        class="tree-read-more-link"
        data-testid="thread-read-more"
        href=${linkToPostFromUri(row.ownerUri)}
      >
        <app-icon icon="chevron-right-circle-line"></app-icon>
        Read ${row.moreReplies} more
        ${row.moreReplies === 1 ? "reply" : "replies"}
      </a>
    </div>`;
  }

  function treeRowsTemplate({ rows, currentUser, isHiddenSection }) {
    return rows.map((row, i) =>
      row.type === "readMore"
        ? treeReadMoreTemplate({ row })
        : treeReplyRowTemplate({
            row,
            currentUser,
            lazyLoadImages: isHiddenSection || i > 20,
            isHiddenRoot: isHiddenSection && row.depth === 1,
          }),
    );
  }

  function treeRepliesTemplate({ postThread, postAuthor, currentUser }) {
    const { items, hiddenItems } = buildThreadTree(postThread, {
      maxDepth: isMobileViewport()
        ? THREAD_TREE_MAX_DEPTH_MOBILE
        : THREAD_TREE_MAX_DEPTH_DESKTOP,
      postAuthor,
    });
    const isEmpty = items.length === 0 && hiddenItems.length === 0;
    const content = html`<div
        class="post-thread-tree"
        data-testid="post-thread-tree"
      >
        ${treeRowsTemplate({
          rows: items,
          currentUser,
          isHiddenSection: false,
        })}
      </div>
      ${hiddenItems.length > 0
        ? html`<hidden-replies-section>
            ${treeRowsTemplate({
              rows: hiddenItems,
              currentUser,
              isHiddenSection: true,
            })}
          </hidden-replies-section>`
        : ""}`;
    return { isEmpty, content };
  }

  function postThreadRepliesTemplate({
    postThread,
    postAuthor,
    currentUser,
    threadView,
  }) {
    const { isEmpty, content } =
      threadView === "tree"
        ? treeRepliesTemplate({ postThread, postAuthor, currentUser })
        : linearRepliesTemplate({
            replies: postThread.replies,
            postAuthor,
            currentUser,
          });
    return html`
      <div class="post-thread-replies">
        ${isEmpty
          ? html`<plugin-slot
              name="post-thread-view:replies-empty"
              context-uri=${postUri}
              .pluginService=${pluginService}
            ></plugin-slot>`
          : html`<plugin-slot
                name="post-thread-view:replies-header"
                context-uri=${postUri}
                .pluginService=${pluginService}
              ></plugin-slot>
              ${content}`}
        <plugin-slot
          name="post-thread-view:after-replies"
          context-uri=${postUri}
          .pluginService=${pluginService}
        ></plugin-slot>
        <div class="post-thread-extra-space"></div>
      </div>
    `;
  }

  function repliesSkeletonTemplate({ numReplies }) {
    return html`
      <div class="post-thread-replies-skeleton">
        ${Array.from({ length: Math.min(numReplies, 10) }).map(() =>
          postSkeletonTemplate(),
        )}
      </div>
    `;
  }

  const NO_UNAUTHENTICATED_MESSAGE =
    "This author has chosen to make their posts visible only to people who are signed in.";

  function noUnauthenticatedSmallPostTemplate({ replyContext = null } = {}) {
    return html`<div class="post small-post">
      <div class="post-content-with-space">
        <div class="post-content-left">
          ${replyContext === "parent" || replyContext === "reply"
            ? html`<div class="reply-context-line-in"></div>`
            : ""}
          <div class="no-unauthenticated-avatar">
            <app-icon icon="lock-line"></app-icon>
          </div>
          ${replyContext === "root" || replyContext === "parent"
            ? html`<div class="reply-context-line-out-container">
                <div class="reply-context-line-out"></div>
              </div>`
            : ""}
        </div>
        <div class="post-content-right">
          <div
            class="no-unauthenticated-message"
            data-testid="no-unauthenticated-message"
          >
            ${NO_UNAUTHENTICATED_MESSAGE}
          </div>
        </div>
      </div>
    </div>`;
  }

  function noUnauthenticatedLargePostTemplate() {
    return html`<div class="post large-post no-unauthenticated-post">
      <div class="no-unauthenticated-header">
        <div class="no-unauthenticated-avatar">
          <app-icon icon="lock-line"></app-icon>
        </div>
        <div class="no-unauthenticated-skeleton-text">
          <div class="skeleton-line skeleton-line-short"></div>
          <div class="skeleton-line skeleton-line-medium"></div>
        </div>
      </div>
      <div
        class="no-unauthenticated-message no-unauthenticated-message-large"
        data-testid="no-unauthenticated-message"
      >
        ${NO_UNAUTHENTICATED_MESSAGE}
      </div>
    </div>`;
  }

  function threadTemplate({
    postThread,
    currentUser,
    hasFollowedInView,
    loadError,
    threadView,
  }) {
    try {
      const mainPost = isEmptyPost(postThread) ? postThread : postThread.post;
      const parents = flattenParents(postThread);
      // A post might still have a parent even if it isn't loaded by the appview -
      // this happens if the client has malformed reply refs.
      const replyParent = mainPost?.record?.reply?.parent;
      const hasParent = !!replyParent;
      // Don't set this to true unless the full post thread has loaded
      const hasBrokenReplyRef =
        hasParent && !postThread.__isPrefill && parents.length === 0;
      const root = getReplyRootFromPost(mainPost);
      const rootCandidate = parents.length ? parents[0].post : mainPost;
      const rootPost = rootCandidate?.uri === root?.uri ? rootCandidate : null;
      const replies = postThread.replies;
      const postAuthor = mainPost?.author;
      const hiddenUnauthenticated =
        !isAuthenticated &&
        mainPost?.author &&
        doHideAuthorOnUnauthenticated(mainPost.author);
      return html`
        <div class="post-thread">
          <plugin-slot
            name="post-thread-view:top"
            context-uri=${postUri}
            .pluginService=${pluginService}
          ></plugin-slot>
          ${parents.map((parent, i) => {
            const parentPost = parent.post ? parent.post : parent;
            const replyContext = i === 0 ? "root" : "parent";
            if (
              !isAuthenticated &&
              parentPost.author &&
              doHideAuthorOnUnauthenticated(parentPost.author)
            ) {
              return noUnauthenticatedSmallPostTemplate({ replyContext });
            }
            return mutedParentToggleTemplate({
              post: parentPost,
              children: smallPostTemplate({
                post: parentPost,
                currentUser,
                isAuthenticated,
                isUserPost: currentUser?.did === parentPost.author?.did,
                postInteractionHandler,
                replyContext,
                postNumbering: parent.postNumbering,
                ignoreMuteWarning: true,
                pluginService,
              }),
            });
          })}
          ${hasBrokenReplyRef
            ? html`<div class="load-more-link">
                <div class="load-more-spacer">
                  <div class="reply-context-line-gap"></div>
                </div>
                <a
                  href=${linkToPostFromUri(replyParent.uri)}
                  data-testid="post-thread-load-parent"
                  >Load parent post</a
                >
              </div>`
            : ""}
          <plugin-slot
            name="post-thread-view:before-main"
            context-uri=${postUri}
            .pluginService=${pluginService}
          ></plugin-slot>
          <div class="post-thread-main-section">
            ${hiddenUnauthenticated
              ? noUnauthenticatedLargePostTemplate()
              : largePostTemplate({
                  post: mainPost,
                  currentUser,
                  isAuthenticated,
                  pluginService,
                  isUserPost: currentUser?.did === mainPost?.author?.did,
                  postInteractionHandler,
                  postNumbering: postThread.postNumbering,
                  showFollowButton: doShowFollowButton(
                    postAuthor,
                    rootPost,
                    currentUser,
                    hasFollowedInView,
                  ),
                  isFollowPending: postAuthor?.did
                    ? dataLayer.derived.$isFollowPending.get(postAuthor.did)
                    : false,
                  onClickFollow: (profile, doFollow) => {
                    if (doFollow) {
                      state.$hasFollowedInView.set(true);
                    }
                    profileInteractionHandler.handleFollow(profile, doFollow);
                  },
                  afterHide: () => {
                    // if the main post is hidden, go back to the previous page
                    router.back();
                  },
                  afterDelete: () => {
                    // if the main post is deleted, go back to the previous page
                    router.back();
                  },
                  afterBlock: () => {
                    // if the main post's author is blocked, go back to the previous page
                    router.back();
                  },
                  onClickReply: async () => {
                    await handleClickReply(mainPost, root, currentUser);
                  },
                  replyContext: hasParent ? "reply" : null,
                  showActionBar: !postThread.__isEmbeddedPrefill,
                })}
            <plugin-slot
              name="post-thread-view:after-main"
              context-uri=${postUri}
              .pluginService=${pluginService}
            ></plugin-slot>
            ${!postThread.__isEmbeddedPrefill &&
            isAuthenticated &&
            currentUser &&
            canReplyToPost(mainPost)
              ? html`
                  <div
                    class="post-thread-reply-prompt"
                    data-testid="post-thread-reply-prompt"
                    @click=${async () => {
                      await handleClickReply(mainPost, root, currentUser);
                    }}
                  >
                    <div class="post-thread-reply-prompt-inner">
                      ${avatarTemplate({
                        author: currentUser,
                        clickAction: "none",
                      })}
                      <span class="post-thread-reply-prompt-text">
                        Write your reply
                      </span>
                    </div>
                  </div>
                `
              : ""}
            ${(() => {
              if (loadError) {
                return threadLoadErrorTemplate({
                  onRetry: retryLoadPostThread,
                });
              }
              if (hiddenUnauthenticated) {
                return "";
              }
              if (replies && threadView !== null) {
                return postThreadRepliesTemplate({
                  postThread,
                  postAuthor,
                  currentUser,
                  threadView,
                });
              }
              const numReplies = mainPost?.replyCount;
              if (numReplies > 0) {
                return repliesSkeletonTemplate({ numReplies });
              }
              return "";
            })()}
          </div>
        </div>
      `;
    } catch (error) {
      return postThreadErrorTemplate({ error });
    }
  }

  function threadSkeletonTemplate() {
    return html`<div class="post-thread">
      ${Array.from({ length: 3 }).map(() => {
        return postSkeletonTemplate();
      })}
    </div>`;
  }

  const state = new ReactiveStore("postThreadView");

  state.$hasFollowedInView = new Signal.State(false);

  state.$postThread = new Signal.Computed(() => {
    const hydratedPostThread =
      dataLayer.derived.$hydratedPostThreads.get(postUri);
    if (hydratedPostThread) {
      return hydratedPostThread;
    }
    // Prefill with saved post if available
    const post = dataLayer.derived.$hydratedPosts.get(postUri);
    if (post) {
      return {
        __isPrefill: true,
        post,
        postNumbering: dataLayer.derived.$postNumbering.get(postUri),
        parent: null,
        replies: null,
      };
    }
    const embeddedPost = dataLayer.derived.$hydratedEmbeddedPosts.get(postUri);
    if (embeddedPost) {
      return {
        __isPrefill: true,
        __isEmbeddedPrefill: true,
        post: embeddedPost,
        parent: null,
        replies: null,
      };
    }
    return null;
  });

  bindPageTitle(root, () => {
    const postThread = state.$postThread.get();
    const handle = postThread?.post?.author?.handle;
    if (handle) {
      return `Post by @${handle}`;
    }
    return null;
  });

  let hasScrolledToLargePost = false;

  // The pin only starts once the full thread has loaded, skip it if the user has already scrolled
  let userHasScrolled = false;
  const markUserScrolled = () => {
    userHasScrolled = true;
  };
  bindToPage(root, window, "touchmove", markUserScrolled);
  bindToPage(root, window, "wheel", markUserScrolled);
  bindToPage(root, window, "keydown", markUserScrolled);

  pageEffect(root, () => {
    const postThread = state.$postThread.get();
    const currentUser = dataLayer.derived.$currentUser.get();
    const postThreadRequestStatus =
      dataLayer.requests.statusStore.$statuses.get("loadPostThread-" + postUri);
    const hasFollowedInView = state.$hasFollowedInView.get();
    const threadView = dataLayer.derived.$threadView.get();

    render(
      html`<div id="post-detail-view">
        ${headerTemplate({ title: "Post" })}
        <main>
          ${(() => {
            const loadError = postThreadRequestStatus.error;
            if (loadError && (!postThread || isNotFoundError(loadError))) {
              return postThreadErrorTemplate({ error: loadError });
            } else if (postThread) {
              return threadTemplate({
                postThread,
                currentUser,
                hasFollowedInView,
                loadError,
                threadView,
              });
            } else {
              return threadSkeletonTemplate();
            }
          })()}
        </main>
      </div>`,
      root,
    );

    // Pin large post on first load
    const largePost = root.querySelector(".large-post");
    const header = root.querySelector("header");
    if (
      largePost &&
      header &&
      !postThread.__isPrefill &&
      !hasScrolledToLargePost
    ) {
      hasScrolledToLargePost = true;
      if (!userHasScrolled) {
        scrollToLargePost(largePost, header);
      }
    }
  });

  function getLargePostPinOffset(largePost, header) {
    const headerHeight = header.getBoundingClientRect().height;
    return largePost.getBoundingClientRect().top - headerHeight;
  }

  function scrollToLargePost(largePost, header) {
    pinScrollPosition({
      targetY: () => {
        const offset = getLargePostPinOffset(largePost, header);
        return window.scrollY + offset;
      },
    });
  }

  onPageShow(root, async ({ action, scrollY }) => {
    userHasScrolled = false;
    dataLayer.preferencesProvider.requirePreferences().catch((error) => {
      console.warn("Failed to load preferences", error);
    });
    if (action === "restore") {
      window.scrollTo(0, scrollY);
    } else {
      // On a revisit the thread is already rendered, so pin it under the header
      const largePost = root.querySelector(".large-post");
      const header = root.querySelector("header");
      if (largePost && header) {
        scrollToLargePost(largePost, header);
      }
    }
    // Revalidate
    await dataLayer.requests.loadPostThread(postUri);
  });

  async function retryLoadPostThread() {
    await dataLayer.requests.loadPostThread(postUri);
  }

  onPageHide(root, () => {
    state.$hasFollowedInView.set(false);
  });
}
