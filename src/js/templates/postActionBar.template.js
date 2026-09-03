import { html, keyed, render } from "/js/lib/lit-html.js";
import { showToast } from "/js/toasts.js";
import { getPermalinkForPost } from "/js/navigation.js";
import {
  formatLargeNumber,
  getBrowserLanguageCodes,
  groupBy,
  noop,
  classnames,
  isAndroid,
  isFirefox,
} from "/js/utils.js";
import { fillableIconTemplate } from "/js/templates/fillableIcon.template.js";
import "/js/components/app-icon.js";
import {
  getRKey,
  canReplyToPost,
  getFeedGeneratorProxyUrl,
} from "/js/dataHelpers.js";
import { richTextToString } from "/js/facetHelpers.js";
import { SignInModal } from "/js/modals/signIn.modal.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import "/js/components/animated-button.js";

function getBlueskyLinkForPost(post) {
  const rkey = getRKey(post);
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

function getFullPostText(post) {
  return richTextToString(post.record.text, post.record.facets);
}

// The Google Translate Android app claims translate.google.com links but drops
// their query params, so on Android the text has to be delivered via a
// PROCESS_TEXT intent instead. Firefox doesn't support intents so fallback to the web url
function openTranslator(text, targetLang) {
  const webUrl = `https://translate.google.com/?sl=auto&tl=${targetLang}&text=${encodeURIComponent(text)}`;
  if (isAndroid() && !isFirefox()) {
    window.location.href =
      "intent:#Intent;action=android.intent.action.PROCESS_TEXT;type=text/plain;" +
      `S.android.intent.extra.PROCESS_TEXT=${encodeURIComponent(text)};` +
      "B.android.intent.extra.PROCESS_TEXT_READONLY=true;" +
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
  } else {
    window.open(webUrl, "_blank");
  }
}

function postContextMenuTemplate({
  post,
  isAuthenticated,
  isUserPost,
  isPinnedToProfile,
  enableFeedFeedback,
  feedContext,
  pluginItems,
  onClickShowMore,
  onClickShowLess,
  onClickHidePost,
  onClickMute,
  onClickBlock,
  onClickReport,
  onClickDelete,
  onClickPin,
  onClickEditInteractionSettings,
}) {
  const canPin = isUserPost && !post.record?.reply;
  const canEditInteractionSettings = isUserPost && !post.record?.reply;
  const pluginGroups = [...groupBy(pluginItems, "pluginId").values()];
  return html`
    ${isAuthenticated && canPin
      ? html`
          <context-menu-item-group>
            <context-menu-item
              data-testid="menu-action-post-pin"
              data-teststate=${isPinnedToProfile ? "pinned" : "unpinned"}
              icon="pin-line"
              @click=${() => onClickPin(post, !isPinnedToProfile)}
            >
              ${isPinnedToProfile
                ? "Unpin from your profile"
                : "Pin to your profile"}
            </context-menu-item>
          </context-menu-item-group>
        `
      : null}
    ${post.record?.text
      ? html`
          <context-menu-item-group>
            <context-menu-item
              data-testid="menu-action-post-translate"
              icon="globe-earth-line"
              @click=${() => {
                const postText = getFullPostText(post);
                const targetLang = getBrowserLanguageCodes()[0] || "en";
                openTranslator(postText, targetLang);
              }}
            >
              Translate
            </context-menu-item>
            <context-menu-item
              data-testid="menu-action-post-copy-text"
              icon="clipboard-line"
              @click=${() => {
                const postText = getFullPostText(post);
                navigator.clipboard.writeText(postText);
                showToast("Post text copied to clipboard", {
                  style: "success",
                });
              }}
            >
              Copy post text
            </context-menu-item>
          </context-menu-item-group>
        `
      : null}
    ${isAuthenticated
      ? html`
          ${enableFeedFeedback
            ? html`
                <context-menu-item-group>
                  <context-menu-item
                    data-testid="menu-action-post-show-more"
                    icon="emoji-smile-line"
                    @click=${() => onClickShowMore(post, feedContext)}
                  >
                    Show more like this
                  </context-menu-item>
                  <context-menu-item
                    data-testid="menu-action-post-show-less"
                    icon="emoji-sad-line"
                    @click=${() => onClickShowLess(post, feedContext)}
                  >
                    Show less like this
                  </context-menu-item>
                </context-menu-item-group>
              `
            : null}
          ${!isUserPost
            ? html`
                ${!post.viewer?.isHidden
                  ? html`
                      <context-menu-item-group>
                        <context-menu-item
                          data-testid="menu-action-post-hide"
                          icon="eye-off-line"
                          @click=${() => onClickHidePost(post)}
                        >
                          Hide ${post.record?.reply ? "reply" : "post"} for me
                        </context-menu-item>
                      </context-menu-item-group>
                    `
                  : null}
                <context-menu-item-group>
                  <context-menu-item
                    data-testid="menu-action-post-mute"
                    data-teststate=${post.author.viewer?.muted
                      ? "muted"
                      : "unmuted"}
                    icon=${post.author.viewer?.muted
                      ? "speaker-volume-line"
                      : "speaker-slash-line"}
                    @click=${() =>
                      onClickMute(post.author, !post.author.viewer?.muted)}
                  >
                    ${post.author.viewer?.muted
                      ? "Unmute account"
                      : "Mute account"}
                  </context-menu-item>
                  <!-- Posts from blocked authors are hidden so the
                       "Unblock" option should never be reachable - left
                       defensively in case this changes in the future. -->
                  <context-menu-item
                    data-testid="menu-action-post-block"
                    data-teststate=${post.author.viewer?.blocking
                      ? "blocking"
                      : "not-blocking"}
                    icon=${post.author.viewer?.blocking
                      ? "user-check-line"
                      : "user-x-line"}
                    @click=${() =>
                      onClickBlock(post.author, !post.author.viewer?.blocking)}
                  >
                    ${post.author.viewer?.blocking
                      ? "Unblock account"
                      : "Block account"}
                  </context-menu-item>
                  <context-menu-item
                    data-testid="menu-action-post-report"
                    icon="flag-line"
                    @click=${() => onClickReport(post)}
                  >
                    Report post
                  </context-menu-item>
                </context-menu-item-group>
              `
            : null}
          ${isUserPost
            ? html`
                <context-menu-item-group>
                  ${canEditInteractionSettings
                    ? html`
                        <context-menu-item
                          data-testid="menu-action-interaction-settings"
                          icon="settings-cog-line"
                          @click=${() => onClickEditInteractionSettings(post)}
                        >
                          Edit interaction settings
                        </context-menu-item>
                      `
                    : null}
                  <context-menu-item
                    data-testid="menu-action-post-delete"
                    icon="delete-bin-line"
                    @click=${() => onClickDelete(post)}
                  >
                    Delete post
                  </context-menu-item>
                </context-menu-item-group>
              `
            : null}
        `
      : null}
    ${pluginGroups.map(
      (group) => html`
        <context-menu-item-group>
          ${group.map(
            (item) => html`
              <context-menu-item
                .iconElement=${item.iconElement}
                @click=${() => item.invoke()}
              >
                ${item.title}
              </context-menu-item>
            `,
          )}
        </context-menu-item-group>
      `,
    )}
  `;
}

function openContextMenu(event, contents, { className = null } = {}) {
  const menu = document.createElement("context-menu");
  if (className) menu.classList.add(className);
  const itemHolder = document.createElement("div");
  render(contents, itemHolder);
  while (itemHolder.firstChild) menu.appendChild(itemHolder.firstChild);
  document.body.appendChild(menu);
  menu.open(event.clientX, event.clientY);
  menu
    .querySelector("dialog")
    .addEventListener("close", () => menu.remove(), { once: true });
}

async function openPostContextMenu(event, props) {
  const pluginItems = await props.pluginService.getPostContextMenuItems(
    props.post,
    {
      feedGenerator: props.feedGenerator ?? null,
      feedContext: props.feedContext ?? null,
      feedProxyUrl: getFeedGeneratorProxyUrl(props.feedGenerator),
    },
  );
  openContextMenu(event, postContextMenuTemplate({ ...props, pluginItems }), {
    className: "post-context-menu",
  });
}

function shareMenuTemplate({ post }) {
  return html`
    <context-menu-item
      data-testid="menu-action-post-open-in-bsky"
      icon="open-line"
      @click=${() => {
        window.open(getBlueskyLinkForPost(post), "_blank");
      }}
    >
      Open in bsky.app
    </context-menu-item>
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

export function postActionBarTemplate({
  post,
  isAuthenticated,
  currentUser,
  isUserPost,
  feedContext = null,
  feedGenerator = null,
  onClickReply = noop,
  onClickRepost = noop,
  onClickQuotePost = noop,
  onClickLike = noop,
  onClickBookmark = noop,
  onClickShowLess = noop,
  onClickShowMore = noop,
  onClickHidePost = noop,
  onClickMute = noop,
  onClickBlock = noop,
  onClickDelete = noop,
  onClickReport = noop,
  onClickPin = noop,
  onClickEditInteractionSettings = noop,
  enableFeedFeedback = false,
  pluginService,
}) {
  const isPinnedToProfile =
    !!currentUser?.pinnedPost && currentUser.pinnedPost.uri === post.uri;
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
              openContextMenu(e, shareMenuTemplate({ post }));
            }}
          >
            <div class="post-action-icon">
              <app-icon icon="share-line"></app-icon>
            </div>
          </button>
        </div>
        <div class="post-action">
          <button
            class="post-action-button text-button"
            data-testid="post-action-more"
            @click=${(e) => {
              e.stopPropagation();
              openPostContextMenu(e, {
                post,
                isAuthenticated,
                isUserPost,
                isPinnedToProfile,
                enableFeedFeedback,
                feedContext,
                feedGenerator,
                pluginService,
                onClickShowMore,
                onClickShowLess,
                onClickHidePost,
                onClickMute,
                onClickBlock,
                onClickReport,
                onClickDelete,
                onClickPin,
                onClickEditInteractionSettings,
              });
            }}
          >
            <span class="text-button-text">...</span>
          </button>
        </div>
      </div>
    </div>
  `;
}
