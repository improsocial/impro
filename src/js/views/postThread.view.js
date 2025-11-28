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
} from "/js/dataHelpers.js";
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

    function doShowReply(reply) {
      const post = reply.post;
      if (!post) {
        return false;
      }
      if (isBlockedPost(post) || isNotFoundPost(post) || isMutedPost(post)) {
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
            { direction: "desc" }
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

    function buildReplyChains(replies, currentUser) {
      const replyChains = [];
      for (const reply of replies) {
        if (doShowReply(reply)) {
          replyChains.push(buildReplyChain(reply));
        }
      }
      const sortedReplyChains = sortBy(
        replyChains,
        (chain) => getLikesWithoutUser(chain[0].post),
        {
          direction: "desc",
        }
      );
      // If there's a recent reply from the user, put it at the top
      const recentReplyFromUser = sortedReplyChains.find(
        (chain) => chain[0].post.viewer?.priorityReply
      );
      if (recentReplyFromUser) {
        return [
          recentReplyFromUser,
          ...sortedReplyChains.filter((chain) => chain !== recentReplyFromUser),
        ];
      } else {
        return sortedReplyChains;
      }
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

    function threadTemplate({ postThread, currentUser }) {
      try {
        const parents = flattenParents(postThread);
        const root = parents.length > 0 ? parents[0].post : postThread.post;
        const replies = postThread.replies ?? [];
        const hiddenReplies = replies.filter(
          (reply) => reply.post && isMutedPost(reply.post)
        );
        const replyChains = buildReplyChains(replies, currentUser);
        return html`
          <div class="post-thread">
            ${parents.map((parent, i) =>
              smallPostTemplate({
                post: parent.post ? parent.post : parent,
                isUserPost: currentUser?.did === parent.post?.author?.did,
                postInteractionHandler,
                replyContext: i === 0 ? "root" : "parent",
                hideMutedAccount: true,
              })
            )}
            ${largePostTemplate({
              post: postThread.post,
              isUserPost: currentUser?.did === postThread.post?.author?.did,
              postInteractionHandler,
              afterDelete: () => {
                // if the main post is deleted, go back to the previous page
                router.back();
              },
              onClickReply: async () => {
                await handleClickReply(postThread.post, root, currentUser);
              },
              replyContext: parents.length > 0 ? "reply" : null,
            })}
            ${isAuthenticated && currentUser && canReplyToPost(postThread.post)
              ? html`
                  <div
                    class="post-thread-reply-prompt"
                    @click=${async () => {
                      await handleClickReply(
                        postThread.post,
                        root,
                        currentUser
                      );
                    }}
                  >
                    <div class="post-thread-reply-prompt-inner">
                      ${avatarTemplate({
                        author: currentUser,
                        clickAction: "none",
                      })}
                      Write your reply
                    </div>
                  </div>
                `
              : ""}
            <div class="post-thread-replies">
              <div class="post-thread-reply-chains">
                ${replyChains.map((replyChain, i) =>
                  // there can be a lot of images in a reply chain, so lazy load them after the first few
                  // TODO: infinite scroll for reply chains? or use v2 endpoint?
                  replyChainTemplate({
                    replyChain,
                    currentUser,
                    lazyLoadImages: i > 20,
                  })
                )}
              </div>
              ${hiddenReplies.length > 0
                ? html`<hidden-replies-section>
                  ${hiddenReplies.map((reply) =>
                    smallPostTemplate({
                      post: reply.post,
                      isUserPost: currentUser?.did === reply.post?.author?.did,
                      postInteractionHandler,
                      overrideMutedWords: true,
                      lazyLoadImages: true,
                    })
                  )}
                </hidden-replies-section>
                </div>`
                : ""}
              <div class="post-thread-extra-space"></div>
            </div>
          </div>
        `;
      } catch (error) {
        return postThreadErrorTemplate({ error });
      }
    }

    function threadSkeletonTemplate() {
      return html`<div class="post-thread">
        ${Array.from({ length: 3 }).map((_, index) => {
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
            replies: [],
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
        root
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
