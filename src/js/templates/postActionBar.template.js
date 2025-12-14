import { html, keyed } from "/js/lib/lit-html.js";
import { showToast } from "/js/toasts.js";
import { getPermalinkForPost } from "/js/navigation.js";
import { formatLargeNumber, noop, classnames } from "/js/utils.js";
import { repostIconTemplate } from "/js/templates/icons/repostIcon.template.js";
import { replyIconTemplate } from "/js/templates/icons/replyIcon.template.js";
import { bookmarkIconTemplate } from "/js/templates/icons/bookmarkIcon.template.js";
import { getRKey } from "/js/dataHelpers.js";
import { showSignInModal } from "/js/modals.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/like-button.js";

function getBlueskyLinkForPost(post) {
  const rkey = getRKey(post);
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

export function postActionBarTemplate({
  post,
  isAuthenticated,
  isUserPost,
  onClickReply = noop,
  onClickRepost = noop,
  onClickQuotePost = noop,
  onClickLike = noop,
  onClickBookmark = noop,
  onClickShowLess = noop,
  onClickMute = noop,
  onClickBlock = noop,
  onClickDelete = noop,
  enableFeedFeedback = false,
}) {
  const numReplies = post.replyCount;
  const numReposts = post.repostCount;
  const isReposted = !!post.viewer?.repost;
  const numLikes = post.likeCount;
  const isLiked = !!post.viewer?.like;
  const isBookmarked = !!post.viewer?.bookmarked;
  const canQuotePost = !post.viewer?.embeddingDisabled;
  return html`
    <div
      class="post-actions"
      @click=${(e) => {
        // don't propagate, so misclicks don't trigger the post click handler
        e.stopPropagation();
      }}
    >
      <div class="post-action">
        <button
          class="post-action-button"
          @click=${() => {
            if (!isAuthenticated) {
              return showSignInModal();
            }
            onClickReply(post);
          }}
        >
          <div class="post-action-icon">${replyIconTemplate()}</div>
          ${numReplies > 0
            ? html`<span class="post-action-count"
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
          @click=${function (e) {
            e.stopPropagation();
            if (!isAuthenticated) {
              return showSignInModal();
            }
            const contextMenu = this.querySelector("context-menu");
            contextMenu.open(e.clientX, e.clientY);
          }}
        >
          <div class="post-action-icon">${repostIconTemplate()}</div>
          ${numReposts > 0
            ? html`<span class="post-action-count"
                >${formatLargeNumber(numReposts)}</span
              >`
            : null}
          <context-menu>
            <context-menu-item
              @click=${() => {
                if (!isAuthenticated) {
                  showSignInModal();
                  return;
                }
                onClickRepost(post, !isReposted);
              }}
            >
              ${isReposted ? "Undo repost" : "Repost"}
            </context-menu-item>
            <context-menu-item
              ?disabled=${!canQuotePost}
              @click=${() => {
                if (!isAuthenticated) {
                  showSignInModal();
                  return;
                }
                onClickQuotePost(post);
              }}
            >
              ${canQuotePost ? "Quote post" : "Quote posts disabled"}
            </context-menu-item>
          </context-menu>
        </button>
      </div>
      <div class="post-action">
        ${keyed(
          post.uri,
          html`<like-button
            @click=${(e) => {
              e.stopPropagation();
            }}
            ?is-liked=${isLiked}
            count=${numLikes}
            @click-like=${() => {
              if (!isAuthenticated) {
                showSignInModal();
                return;
              }
              onClickLike(post, !isLiked);
            }}
          ></like-button>`
        )}
      </div>
      <div class="post-action post-action-bookmark">
        <button
          class="post-action-button ${classnames({
            bookmarked: isBookmarked,
          })}"
          @click=${(e) => {
            e.stopPropagation();
            if (!isAuthenticated) {
              return showSignInModal();
            }
            onClickBookmark(post, !isBookmarked);
          }}
        >
          <div class="post-action-icon">
            ${bookmarkIconTemplate({
              filled: isBookmarked,
            })}
          </div>
        </button>
      </div>
      <div class="post-action">
        <button
          class="post-action-button text-button"
          @click=${function (e) {
            e.stopPropagation();
            const contextMenu = this.nextElementSibling;
            contextMenu.open(e.clientX, e.clientY);
          }}
        >
          <span class="text-button-text">...</span>
        </button>
        <context-menu>
          <context-menu-item
            @click=${() => {
              window.open(getBlueskyLinkForPost(post), "_blank");
            }}
          >
            Open in bsky.app
          </context-menu-item>
          <context-menu-item
            @click=${() => {
              navigator.clipboard.writeText(getPermalinkForPost(post));
              showToast("Link copied to clipboard");
            }}
          >
            Copy link to post
          </context-menu-item>
          ${enableFeedFeedback && isAuthenticated
            ? html`
                <context-menu-item
                  @click=${() => {
                    onClickShowLess(post);
                  }}
                >
                  Show less like this
                </context-menu-item>
              `
            : null}
          ${isAuthenticated
            ? html`<context-menu-item
                  @click=${() => {
                    onClickMute(post.author, !post.author.viewer?.muted);
                  }}
                >
                  ${post.author.viewer?.muted
                    ? "Unmute Account"
                    : "Mute Account"}
                </context-menu-item>
                <context-menu-item
                  @click=${() => {
                    onClickBlock(post.author, !post.author.viewer?.blocking);
                  }}
                >
                  ${post.author.viewer?.blocking
                    ? "Unblock Account"
                    : "Block Account"}
                </context-menu-item>
                ${isUserPost
                  ? html` <context-menu-item
                      @click=${() => {
                        onClickDelete(post);
                      }}
                    >
                      Delete post
                    </context-menu-item>`
                  : null} `
            : null}
        </context-menu>
      </div>
    </div>
  `;
}
