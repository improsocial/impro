import { html } from "/js/lib/lit-html.js";
import {
  isBlockedPost,
  isNotFoundPost,
  isUnavailablePost,
  getDisplayName,
  doHideAuthorOnUnauthenticated,
  getLabelNameAndDescription,
} from "/js/dataHelpers.js";
import { noop } from "/js/utils.js";
import { linkToPost } from "/js/navigation.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { postEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { postActionBarTemplate } from "/js/templates/postActionBar.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { repostIconTemplate } from "/js/templates/icons/repostIcon.template.js";
import { pinIconTemplate } from "/js/templates/icons/pinIcon.template.js";
import { postLabelsTemplate } from "/js/templates/postLabels.template.js";
import { blockedPostTemplate } from "/js/templates/blockedPost.template.js";
import { notFoundPostTemplate } from "/js/templates/notFoundPost.template.js";
import { unavailablePostTemplate } from "/js/templates/unavailablePost.template.js";
import "/js/components/lightbox-image-group.js";
import "/js/components/muted-reply-toggle.js";

export function smallPostTemplate({
  post,
  isUserPost,
  postInteractionHandler,
  replyContext,
  repostAuthor,
  isPinned = false,
  onClickShowLess = noop,
  onClickShowMore = noop,
  enableFeedFeedback = false,
  hideMutedAccount = false,
  overrideMutedWords = false,
  showReplyToLabel = false,
  replyToAuthor = null,
  lazyLoadImages = false,
}) {
  if (isBlockedPost(post)) {
    return blockedPostTemplate();
  } else if (isNotFoundPost(post)) {
    return notFoundPostTemplate();
  } else if (isUnavailablePost(post)) {
    return unavailablePostTemplate();
  } else if (
    !postInteractionHandler.isAuthenticated &&
    post.author &&
    doHideAuthorOnUnauthenticated(post.author)
  ) {
    return unavailablePostTemplate();
  }
  const postText = post.record.text?.trimEnd() || "";
  const content = html`
    <div
      class="post small-post clickable"
      @click=${(e) => {
        // if the click is on an anchor, don't go to the post, but let it bubble up so the router can handle it.
        if (e.target.closest("a")) {
          return;
        }
        window.router.go(linkToPost(post));
      }}
    >
      <div class="post-content-with-space">
        <div class="post-content-left">
          ${replyContext === "parent" || replyContext === "reply"
            ? html`<div class="reply-context-line-in"></div>`
            : ""}
          <div>
            ${avatarTemplate({ author: post.author, lazyLoad: lazyLoadImages })}
          </div>
          ${replyContext === "root" || replyContext === "parent"
            ? html`<div class="reply-context-line-out-container">
                <div class="reply-context-line-out"></div>
              </div>`
            : ""}
        </div>
        <div class="post-content-right">
          ${isPinned
            ? html`<div class="pinned-label">${pinIconTemplate()} Pinned</div>`
            : ""}
          ${repostAuthor
            ? html`<div class="repost-label">
                ${repostIconTemplate()} Reposted by
                ${getDisplayName(repostAuthor)}
              </div>`
            : ""}
          ${postHeaderTextTemplate({
            author: post.author,
            timestamp: post.record.createdAt,
          })}
          ${post.viewer?.badgeLabels
            ? postLabelsTemplate({ badgeLabels: post.viewer?.badgeLabels })
            : ""}
          ${showReplyToLabel
            ? html`<div class="reply-to-author">
                ⤷ Replied to
                ${replyToAuthor ? getDisplayName(replyToAuthor) : "Unknown"}
              </div>`
            : ""}
          <div class="post-body">
            ${postText.length > 0
              ? html`<div class="post-text">
                  ${richTextTemplate({
                    text: postText,
                    facets: post.record.facets,
                  })}
                </div>`
              : ""}
            ${post.embed
              ? html`<div class="post-embed">
                  ${postEmbedTemplate({
                    embed: post.embed,
                    mediaLabel: post.viewer?.mediaLabel,
                    lazyLoadImages,
                    isAuthenticated: postInteractionHandler.isAuthenticated,
                  })}
                </div>`
              : null}
            ${postActionBarTemplate({
              post,
              isUserPost,
              isAuthenticated: postInteractionHandler.isAuthenticated,
              onClickReply: () => {
                window.router.go(linkToPost(post));
              },
              onClickLike: (post, doLike) =>
                postInteractionHandler.handleLike(post, doLike),
              onClickRepost: (post, doRepost) =>
                postInteractionHandler.handleRepost(post, doRepost),
              onClickQuotePost: (post) =>
                postInteractionHandler.handleQuotePost(post),
              onClickBookmark: (post, doBookmark) =>
                postInteractionHandler.handleBookmark(post, doBookmark),
              onClickShowLess,
              onClickShowMore,
              onClickHidePost: (post) =>
                postInteractionHandler.handleHidePost(post),
              onClickMute: (profile, doMute) =>
                postInteractionHandler.handleMuteAuthor(profile, doMute),
              onClickBlock: (profile, doBlock) =>
                postInteractionHandler.handleBlockAuthor(profile, doBlock),
              onClickDelete: (post) => {
                postInteractionHandler.handleDeletePost(post);
              },
              onClickReport: (post) =>
                postInteractionHandler.handleReport(post),
              enableFeedFeedback,
            })}
          </div>
        </div>
      </div>
    </div>
  `;

  const contentLabel = post.viewer?.contentLabel;
  if (contentLabel && contentLabel.visibility !== "ignore") {
    const { name: labelName } = getLabelNameAndDescription(
      contentLabel.labelDefinition,
    );
    return html`<muted-reply-toggle label="${labelName}">
      ${content}
    </muted-reply-toggle>`;
  }
  if (hideMutedAccount && post.author.viewer?.muted) {
    return html`<muted-reply-toggle label="Muted account">
      ${content}
    </muted-reply-toggle>`;
  }
  if (post.viewer?.hasMutedWord && !overrideMutedWords) {
    return html`<muted-reply-toggle label="Hidden by muted word">
      ${content}
    </muted-reply-toggle>`;
  }
  if (post.viewer?.isHidden) {
    return html`<muted-reply-toggle label="Post hidden by you">
      ${content}
    </muted-reply-toggle>`;
  }
  return content;
}
