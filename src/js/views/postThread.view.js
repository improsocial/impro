import { html, render } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { sortBy } from "/js/utils.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { smallPostTemplate } from "/js/templates/smallPost.template.js";
import { largePostTemplate } from "/js/templates/largePost.template.js";
import { postSkeletonTemplate } from "/js/templates/postSkeleton.template.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import {
  flattenParents,
  isBlockedPost,
  isNotFoundPost,
  isUnavailablePost,
  isMutedPost,
  getReplyRootFromPost,
  doHideAuthorOnUnauthenticated,
} from "/js/dataHelpers.js";
import { lockIconTemplate } from "/js/templates/icons/lockIcon.template.js";
import { ApiError } from "/js/api.js";
import { View } from "./view.js";
import "/js/components/hidden-replies-section.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";

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

    function postThreadErrorTemplate({ error }) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.data?.error === "NotFound"
      ) {
        return html`<div class="error-state">
          <div>Post not found</div>
          <button @click=${() => window.location.reload()}>Try again</button>
        </div>`;
      } else {
        console.error(error);
        return html`<div class="error-state">
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
          const post = dataLayer.selectors.getPost(reply.post.uri); // todo - map in selector?
          return smallPostTemplate({
            post,
            currentUser,
            isAuthenticated,
            isUserPost: currentUser?.did === post.author?.did,
            postInteractionHandler,
            replyContext: getReplyContext(i, numReplies),
            lazyLoadImages,
          });
        })}
      </div>`;
    }

    function canReplyToPost(post) {
      if (
        isBlockedPost(post) ||
        isNotFoundPost(post) ||
        isUnavailablePost(post)
      ) {
        return false;
      }
      if (post.viewer?.replyDisabled) {
        return false;
      }
      return true;
    }

    async function handleClickReply(post, replyRoot, currentUser) {
      await postComposerService.composePost({
        currentUser,
        replyTo: post,
        replyRoot,
      });
      renderPage();
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
      return html`
        <div class="post-thread-replies">
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
              isUserPost: currentUser?.did === reply.post?.author?.did,
              postInteractionHandler,
              ignoreContentWarning: true,
              overrideMutedWords: true,
              lazyLoadImages: true,
            }),
          )}
        </hidden-replies-section>
        </div>`
            : ""}
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
        const parents = flattenParents(postThread);
        // A post might still have a parent even if it isn't loaded by the appview -
        // this happens if the client has malformed reply refs.
        const hasParent = postThread.post?.record?.reply?.parent;
        const root = getReplyRootFromPost(postThread.post);
        const replies = postThread.replies;
        const postAuthor = postThread.post?.author;
        const hiddenUnauthenticated =
          !isAuthenticated &&
          postThread.post?.author &&
          doHideAuthorOnUnauthenticated(postThread.post.author);
        return html`
          <div class="post-thread">
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
              return smallPostTemplate({
                post: parentPost,
                currentUser,
                isAuthenticated,
                isUserPost: currentUser?.did === parentPost.author?.did,
                postInteractionHandler,
                replyContext,
                hideMutedAccount: true,
              });
            })}
            ${hiddenUnauthenticated
              ? noUnauthenticatedLargePostTemplate()
              : largePostTemplate({
                  post: postThread.post,
                  currentUser,
                  isAuthenticated,
                  isUserPost: currentUser?.did === postThread.post?.author?.did,
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
                    await handleClickReply(postThread.post, root, currentUser);
                  },
                  replyContext: hasParent ? "reply" : null,
                })}
            ${isAuthenticated && currentUser && canReplyToPost(postThread.post)
              ? html`
                  <div
                    class="post-thread-reply-prompt"
                    @click=${async () => {
                      await handleClickReply(
                        postThread.post,
                        root,
                        currentUser,
                      );
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
              const numReplies = postThread.post.replyCount;
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

    function getPostThread() {
      let postThread = dataLayer.selectors.getPostThread(postUri);
      if (!postThread) {
        // prefill with saved post if available
        const post = dataLayer.selectors.getPost(postUri);
        if (post) {
          postThread = {
            post,
            parent: null,
            replies: null,
          };
        }
      }
      return postThread;
    }

    function renderPage() {
      const postThread = getPostThread();
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const postThreadRequestStatus =
        dataLayer.requests.getStatus("loadPostThread");
      render(
        html`<div id="post-detail-view">
          ${mainLayoutTemplate({
            isAuthenticated,
            showSidebarOverlay: false,
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }).then(() => {
                renderPage();
              }),
            currentUser,
            numNotifications,
            numChatNotifications,
            children: html`${textHeaderTemplate({ title: "Post" })}
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
    }

    function scrollToLargePost() {
      const largePost = root.querySelector(".large-post");
      if (largePost) {
        const headerHeight = root.querySelector("header").offsetHeight;
        const largePostTop = largePost.offsetTop;
        window.scrollTo(0, largePostTop - headerHeight);
      }
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      scrollToLargePost();
      let requests = [];
      if (isAuthenticated) {
        requests.push(dataLayer.requests.loadCurrentUser());
      }
      // Fetch full thread
      requests.push(dataLayer.requests.loadPostThread(postUri));
      await Promise.all(requests);
      renderPage();
      scrollToLargePost();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      renderPage();
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      } else {
        scrollToLargePost();
      }
      // Revalidate
      await dataLayer.requests.loadPostThread(postUri);
      renderPage();
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new PostThreadView();
