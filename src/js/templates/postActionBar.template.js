import { html, keyed } from "/js/lib/lit-html.js";
import { haptics } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { getPermalinkForPost } from "/js/navigation.js";
import {
  formatLargeNumber,
  noop,
  classnames,
  canShareUrl,
  shareUrl,
} from "/js/utils.js";
import { fillableIconTemplate } from "/js/templates/fillableIcon.template.js";
import "/js/components/app-icon.js";
import { getRKey, canReplyToPost, getVideoFromPost } from "/js/dataHelpers.js";
import { SignInModal } from "/js/modals/signIn.modal.js";
import { openContextMenu } from "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import "/js/components/animated-button.js";
import "/js/components/plugin-slot.js";

function getBlueskyLinkForPost(post) {
  const rkey = getRKey(post);
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

function shareMenuTemplate({ post, onClickDownloadVideo }) {
  const video = getVideoFromPost(post);
  return html`
    <context-menu-item-group>
      <context-menu-item
        data-testid="menu-action-post-open-in-bsky"
        icon="open-line"
        @click=${() => {
          window.open(getBlueskyLinkForPost(post), "_blank");
        }}
      >
        Open in bsky.app
      </context-menu-item>
      ${canShareUrl()
        ? html`
            <context-menu-item
              data-testid="menu-action-post-share-via"
              icon="share-up-line"
              @click=${() => shareUrl(getPermalinkForPost(post))}
            >
              Share via...
            </context-menu-item>
          `
        : null}
      <context-menu-item
        data-testid="menu-action-post-copy-link"
        icon="link-line"
        @click=${() => {
          navigator.clipboard.writeText(getPermalinkForPost(post));
          showToast("Link copied to clipboard", { style: "success" });
        }}
      >
        Copy link to post
      </context-menu-item>
    </context-menu-item-group>
    ${video
      ? html`
          <context-menu-item-group>
            <context-menu-item
              data-testid="menu-action-post-download-video"
              data-teststate=${video.presentation === "gif" ? "gif" : "video"}
              icon="download-line"
              @click=${() => onClickDownloadVideo(post)}
            >
              ${video.presentation === "gif"
                ? "Download GIF"
                : "Download video"}
            </context-menu-item>
          </context-menu-item-group>
        `
      : null}
  `;
}

function repostMenuTemplate({
  post,
  currentUser,
  isAuthenticated,
  isReposted,
  canQuotePost,
  onClickRepost,
  onClickQuotePost,
}) {
  return html`
    <context-menu-item
      data-testid="menu-action-repost"
      data-teststate=${isReposted ? "reposted" : "not-reposted"}
      icon="repost"
      @click=${() => {
        if (!isAuthenticated) {
          SignInModal.open();
          return;
        }
        onClickRepost(post, !isReposted);
      }}
    >
      ${isReposted ? "Undo repost" : "Repost"}
    </context-menu-item>
    <context-menu-item
      data-testid="menu-action-quote-post"
      data-teststate=${canQuotePost ? "quotable" : "quotes-disabled"}
      ?disabled=${!canQuotePost || !currentUser}
      icon="quote-line"
      @click=${() => {
        if (!isAuthenticated) {
          SignInModal.open();
          return;
        }
        onClickQuotePost(post);
      }}
    >
      ${canQuotePost ? "Quote post" : "Quote posts disabled"}
    </context-menu-item>
  `;
}

function skeletonActionTemplate(icon) {
  return html`<div class="post-action">
    <div class="post-action-button">
      <div class="post-action-icon">${icon}</div>
    </div>
  </div>`;
}

export function postActionBarSkeletonTemplate() {
  return html`
    <div
      class="post-actions post-actions-skeleton"
      data-testid="post-action-bar-skeleton"
    >
      <div class="post-actions-primary">
        ${skeletonActionTemplate(html`<app-icon icon="reply"></app-icon>`)}
        ${skeletonActionTemplate(html`<app-icon icon="repost"></app-icon>`)}
        ${skeletonActionTemplate(fillableIconTemplate({ icon: "like" }))}
      </div>
      <div class="post-actions-secondary">
        ${skeletonActionTemplate(fillableIconTemplate({ icon: "bookmark" }))}
        ${skeletonActionTemplate(html`<app-icon icon="share-line"></app-icon>`)}
      </div>
    </div>
  `;
}

export function postActionBarTemplate({
  post,
  isAuthenticated,
  currentUser,
  feedGenerator = null,
  onClickReply = noop,
  onClickRepost = noop,
  onClickQuotePost = noop,
  onClickLike = noop,
  onClickBookmark = noop,
  onClickDownloadVideo = noop,
  pluginService,
}) {
  const numReplies = post.replyCount;
  const numReposts = post.repostCount + post.quoteCount;
  const isReposted = !!post.viewer?.repost;
  const numLikes = post.likeCount;
  const isLiked = !!post.viewer?.like;
  const isBookmarked = !!post.viewer?.bookmarked;
  const canQuotePost = !post.viewer?.embeddingDisabled;
  const canReply = canReplyToPost(post);
  return html`
    <div class="post-actions">
      <div class="post-actions-primary">
        <div class="post-action">
          <button
            class="post-action-button"
            data-testid="reply-button"
            ?disabled=${!canReply}
            @click=${() => {
              if (!isAuthenticated) {
                return SignInModal.open();
              }
              onClickReply(post);
            }}
          >
            <div class="post-action-icon">
              <app-icon icon="reply"></app-icon>
            </div>
            ${numReplies > 0
              ? html`<span class="post-action-count" data-testid="reply-count"
                  >${formatLargeNumber(numReplies)}</span
                >`
              : null}
          </button>
        </div>
        <div class="post-action">
          <button
            class=${classnames("post-action-button post-action-repost", {
              reposted: isReposted,
            })}
            data-testid="repost-button"
            @click=${(e) => {
              e.stopPropagation();
              if (!isAuthenticated) {
                return SignInModal.open();
              }
              haptics.impactLight();
              openContextMenu(
                e,
                repostMenuTemplate({
                  post,
                  currentUser,
                  isAuthenticated,
                  isReposted,
                  canQuotePost,
                  onClickRepost,
                  onClickQuotePost,
                }),
              );
            }}
          >
            <div class="post-action-icon">
              <app-icon icon="repost"></app-icon>
            </div>
            ${numReposts > 0
              ? html`<span class="post-action-count" data-testid="repost-count"
                  >${formatLargeNumber(numReposts)}</span
                >`
              : null}
          </button>
        </div>
        <div class="post-action">
          ${keyed(
            post.uri,
            html`<animated-button
              button-class="post-action-button like-button"
              testid="like-button"
              ?is-active=${isLiked}
              @click=${(e) => {
                e.stopPropagation();
                if (!isAuthenticated) {
                  SignInModal.open();
                  return;
                }
                onClickLike(post, !isLiked);
              }}
            >
              <div class="post-action-icon">
                ${fillableIconTemplate({ icon: "like", filled: isLiked })}
              </div>
              ${numLikes > 0
                ? html`<span class="post-action-count"
                    >${formatLargeNumber(numLikes)}</span
                  >`
                : null}
            </animated-button>`,
          )}
        </div>
      </div>
      <div class="post-actions-secondary">
        ${pluginService
          ? html`<plugin-slot
              name="post-action-bar:secondary-start"
              context-uri=${post.uri}
              context-feed-uri=${feedGenerator?.uri ?? ""}
              .pluginService=${pluginService}
            ></plugin-slot>`
          : ""}
        <div class="post-action post-action-bookmark">
          ${keyed(
            post.uri,
            html`<animated-button
              button-class="post-action-button bookmark-button"
              testid="bookmark-button"
              ?is-active=${isBookmarked}
              @click=${(e) => {
                e.stopPropagation();
                if (!isAuthenticated) {
                  SignInModal.open();
                  return;
                }
                onClickBookmark(post, !isBookmarked);
              }}
            >
              <div class="post-action-icon">
                ${fillableIconTemplate({
                  icon: "bookmark",
                  filled: isBookmarked,
                })}
              </div>
            </animated-button>`,
          )}
        </div>
        <div class="post-action post-action-share">
          <button
            class="post-action-button"
            data-testid="post-action-share"
            @click=${(e) => {
              e.stopPropagation();
              haptics.impactLight();
              openContextMenu(
                e,
                shareMenuTemplate({ post, onClickDownloadVideo }),
              );
            }}
          >
            <div class="post-action-icon">
              <app-icon icon="share-line"></app-icon>
            </div>
          </button>
        </div>
        ${pluginService
          ? html`<plugin-slot
              name="post-action-bar:secondary-end"
              context-uri=${post.uri}
              context-feed-uri=${feedGenerator?.uri ?? ""}
              .pluginService=${pluginService}
            ></plugin-slot>`
          : ""}
      </div>
    </div>
  `;
}
