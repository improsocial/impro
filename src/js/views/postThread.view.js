import { html, render } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { sortBy } from "/js/utils.js";
import { pageEffect } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { mutedParentToggleTemplate } from "/js/templates/mutedParentToggle.template.js";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
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
import { View } from "/js/views/view.js";
import "/js/components/hidden-replies-section.js";
import "/js/components/plugin-slot.js";
import { linkToPostFromUri } from "/js/navigation.js";

class PostThreadView extends View {
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

    function postThreadErrorTemplate({ error }) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.data?.error === "NotFound"
      ) {
        return html`<div class="error-state" data-testid="post-not-found">
          <div>Post not found</div>
          <button @click=${() => window.location.reload()}>Try again</button>
        </div>`;
      } else {
        console.error(error);
        return html`<div class="error-state" data-testid="thread-error">
          <div>Error loading thread</div>
          <button @click=${() => window.location.reload()}>Try again</button>
        </div>`;
      }
    }

    function replyHasContentLabel(reply) {
      return (
        reply.post.contentLabel &&
        reply.post.contentLabel.visibility !== "ignore"
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
          let mostLikedReply = sortBy(
            shownReplies,
            (reply) => getLikesWithoutUser(reply.post),
            { direction: "desc" },
          )[0];
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
          const post = dataLayer.derived.$hydratedPosts
            .get(reply.post.uri)
            .get();
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
                .interactionHandlers=${interactionHandlers}
              ></plugin-slot>`
            : html`<plugin-slot
                  name="post-thread-view:replies-header"
                  context-uri=${postUri}
                  .pluginService=${pluginService}
                  .interactionHandlers=${interactionHandlers}
                ></plugin-slot>
                <div class="post-thread-reply-chains">
                  ${replyChains.map((replyChain, i) =>
                    // there can be a lot of images in a reply chain, so lazy load them after the first few
                    // TODO: infinite scroll for reply chains? or use v2 endpoint?
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
            .interactionHandlers=${interactionHandlers}
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
        <div
          class="no-unauthenticated-message no-unauthenticated-message-large"
        >
          ${NO_UNAUTHENTICATED_MESSAGE}
        </div>
      </div>`;
    }

    function threadTemplate({ postThread, currentUser }) {
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
              .interactionHandlers=${interactionHandlers}
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
                    <div class="reply-context-ellipsis"></div>
                  </div>
                  <a href=${linkToPostFromUri(replyParent.uri)}
                    >Load parent post</a
                  >
                </div>`
              : ""}
            <plugin-slot
              name="post-thread-view:before-main"
              context-uri=${postUri}
              .pluginService=${pluginService}
              .interactionHandlers=${interactionHandlers}
            ></plugin-slot>
            ${hiddenUnauthenticated
              ? noUnauthenticatedLargePostTemplate()
              : largePostTemplate({
                  post: mainPost,
                  currentUser,
                  isAuthenticated,
                  pluginService,
                  isUserPost: currentUser?.did === mainPost?.author?.did,
                  postInteractionHandler,
                  afterHide: () => {
                    // if the main post is hidden, go back to the previous page
                    router.back();
                  },
                  afterDelete: () => {
                    // if the main post is deleted, go back to the previous page
                    router.back();
                  },
                  onClickReply: async () => {
                    await handleClickReply(mainPost, root, currentUser);
                  },
                  replyContext: hasParent ? "reply" : null,
                })}
            <plugin-slot
              name="post-thread-view:after-main"
              context-uri=${postUri}
              .pluginService=${pluginService}
              .interactionHandlers=${interactionHandlers}
            ></plugin-slot>
            ${isAuthenticated && currentUser && canReplyToPost(mainPost)
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

    pageEffect(root, () => {
      let postThread = dataLayer.derived.$hydratedPostThreads
        .get(postUri)
        .get();
      if (!postThread) {
        // Prefill with saved post if available
        const post = dataLayer.derived.$hydratedPosts.get(postUri).get();
        if (post) {
          postThread = {
            __isPrefill: true,
            post,
            parent: null,
            replies: null,
          };
        }
      }
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const postThreadRequestStatus = dataLayer.requests.statusStore.$statuses
        .get("loadPostThread-" + postUri)
        .get();
      render(
        html`<div id="post-detail-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            showSidebarOverlay: false,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            currentUser,
            numNotifications,
            numChatNotifications,
            pluginService,
            children: html`${headerTemplate({ title: "Post" })}
              <main>
                ${(() => {
                  if (postThreadRequestStatus.error) {
                    return postThreadErrorTemplate({
                      error: postThreadRequestStatus.error,
                    });
                  } else if (postThread) {
                    return threadTemplate({ postThread, currentUser });
                  } else {
                    return threadSkeletonTemplate();
                  }
                })()}
              </main>`,
          })}
        </div>`,
        root,
      );
    });

    function scrollToLargePost() {
      const largePost = root.querySelector(".large-post");
      if (largePost) {
        const headerHeight = root.querySelector("header").offsetHeight;
        const largePostTop = largePost.offsetTop;
        window.scrollTo(0, largePostTop - headerHeight);
      }
    }

    root.addEventListener("page-enter", async () => {
      scrollToLargePost();
      let requests = [];
      if (isAuthenticated) {
        requests.push(dataLayer.requests.loadCurrentUser());
      }
      requests.push(dataLayer.requests.loadPostThread(postUri));
      await Promise.all(requests);
      scrollToLargePost();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      } else {
        scrollToLargePost();
      }
      // Revalidate
      await dataLayer.requests.loadPostThread(postUri);
    });
  }
}

export default new PostThreadView();
