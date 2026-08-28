import { html, render } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { sortBy, maxBy, pinScrollPosition } from "/js/utils.js";
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
  isUnavailablePost,
  isEmptyPost,
  isMutedPost,
  getReplyRootFromPost,
  doHideAuthorOnUnauthenticated,
  canReplyToPost,
} from "/js/dataHelpers.js";
import { lockIconTemplate } from "/js/templates/icons/lockIcon.template.js";
import { ApiError } from "/js/api.js";
import "/js/components/hidden-replies-section.js";
import "/js/components/plugin-slot.js";
import { linkToPostFromUri } from "/js/navigation.js";
import { Signal, ReactiveStore } from "/js/signals.js";

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

  let authorDid = null;
  if (handleOrDid.startsWith("did:")) {
    authorDid = handleOrDid;
  } else {
    authorDid = await identityResolver.resolveHandle(handleOrDid);
  }
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

  function postThreadErrorTemplate({ error }) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      error.data?.error === "NotFound"
    ) {
      return html`<div class="error-state" data-testid="post-not-found">
        <div>Post not found</div>
        <button
          class="rounded-button rounded-button-secondary-inverted"
          @click=${() => window.location.reload()}
        >
          Try again
        </button>
      </div>`;
    } else {
      console.error(error);
      return html`<div class="error-state" data-testid="thread-error">
        <div>Error loading thread</div>
        <button
          class="rounded-button rounded-button-secondary-inverted"
          @click=${() => window.location.reload()}
        >
          Try again
        </button>
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

  function buildReplyChains(replies, postAuthor) {
    const replyChains = [];
    for (const reply of replies) {
      if (doShowReply(reply)) {
        replyChains.push(buildReplyChain(reply));
      }
    }
    let sortedReplyChains = sortBy(
      replyChains,
      (chain) => getLikesWithoutUser(chain[0].post),
      {
        direction: "desc",
      },
    );
    // Put replies by the post author first
    if (postAuthor) {
      sortedReplyChains = [
        ...sortedReplyChains.filter(
          (chain) => chain[0].post.author?.did === postAuthor.did,
        ),
        ...sortedReplyChains.filter(
          (chain) => chain[0].post.author?.did !== postAuthor.did,
        ),
      ];
    }
    // If there's a recent reply from the user, put it at the top
    const recentReplyFromUser = sortedReplyChains.find(
      (chain) => chain[0].post.viewer?.priorityReply,
    );
    if (recentReplyFromUser) {
      sortedReplyChains = [
        recentReplyFromUser,
        ...sortedReplyChains.filter((chain) => chain !== recentReplyFromUser),
      ];
    }
    return sortedReplyChains;
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

  function postThreadRepliesTemplate({ replies, postAuthor, currentUser }) {
    const hiddenSectionReplies = replies.filter((reply) =>
      doPutReplyInHiddenSection(reply),
    );
    const replyChains = buildReplyChains(replies, postAuthor);
    const isEmpty =
      replyChains.length === 0 && hiddenSectionReplies.length === 0;
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
              <div class="post-thread-reply-chains">
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
                        isUserPost:
                          currentUser?.did === reply.post?.author?.did,
                        postInteractionHandler,
                        ignoreContentWarning: true,
                        ignoreMuteWarning: true,
                        lazyLoadImages: true,
                        pluginService,
                      }),
                    )}
                  </hidden-replies-section>`
                : ""} `}
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
          <div class="no-unauthenticated-avatar">${lockIconTemplate()}</div>
          ${replyContext === "root" || replyContext === "parent"
            ? html`<div class="reply-context-line-out-container">
                <div class="reply-context-line-out"></div>
              </div>`
            : ""}
        </div>
        <div class="post-content-right">
          <div class="no-unauthenticated-message">
            ${NO_UNAUTHENTICATED_MESSAGE}
          </div>
        </div>
      </div>
    </div>`;
  }

  function noUnauthenticatedLargePostTemplate() {
    return html`<div class="post large-post no-unauthenticated-post">
      <div class="no-unauthenticated-header">
        <div class="no-unauthenticated-avatar">${lockIconTemplate()}</div>
        <div class="no-unauthenticated-skeleton-text">
          <div class="skeleton-line skeleton-line-short"></div>
          <div class="skeleton-line skeleton-line-medium"></div>
        </div>
      </div>
      <div class="no-unauthenticated-message no-unauthenticated-message-large">
        ${NO_UNAUTHENTICATED_MESSAGE}
      </div>
    </div>`;
  }

  function threadTemplate({ postThread, currentUser, hasFollowedInView }) {
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
                  showActions: !postThread.__isEmbeddedPrefill,
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
              if (hiddenUnauthenticated) {
                return "";
              }
              if (replies) {
                return postThreadRepliesTemplate({
                  replies,
                  postAuthor,
                  currentUser,
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

    render(
      html`<div id="post-detail-view">
        ${headerTemplate({ title: "Post" })}
        <main>
          ${(() => {
            if (postThreadRequestStatus.error) {
              return postThreadErrorTemplate({
                error: postThreadRequestStatus.error,
              });
            } else if (postThread) {
              return threadTemplate({
                postThread,
                currentUser,
                hasFollowedInView,
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

  // The browser clamps scrolling at the document height, so when there
  // isn't enough content below the post to pin it under the header,
  // stretch the main section to provide the missing scroll runway.
  function ensureScrollRunway(largePost, header) {
    const mainSection = root.querySelector(".post-thread-main-section");
    if (!mainSection) {
      return;
    }
    mainSection.style.minHeight = "";
    const targetScrollY =
      window.scrollY + getLargePostPinOffset(largePost, header);
    const shortfall =
      targetScrollY +
      window.innerHeight -
      document.documentElement.scrollHeight;
    if (shortfall > -1) {
      const sectionHeight = mainSection.getBoundingClientRect().height;
      mainSection.style.minHeight = `${Math.ceil(sectionHeight + shortfall) + 1}px`;
    }
  }

  function scrollToLargePost(largePost, header) {
    ensureScrollRunway(largePost, header);
    pinScrollPosition({
      targetY: () => {
        const offset = getLargePostPinOffset(largePost, header);
        return window.scrollY + offset;
      },
    });
  }

  onPageShow(root, async ({ action, scrollY }) => {
    userHasScrolled = false;
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

  onPageHide(root, () => {
    state.$hasFollowedInView.set(false);
  });
}
