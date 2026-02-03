import { html } from "/js/lib/lit-html.js";
import { noop, formatFullTimestamp, formatLargeNumber } from "/js/utils.js";
import {
  isBlockedPost,
  isNotFoundPost,
  isUnavailablePost,
  doHideAuthorOnUnauthenticated,
} from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { postEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { postActionBarTemplate } from "/js/templates/postActionBar.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { postLabelsTemplate } from "/js/templates/postLabels.template.js";
import { blockedPostTemplate } from "/js/templates/blockedPost.template.js";
import { notFoundPostTemplate } from "/js/templates/notFoundPost.template.js";
import { unavailablePostTemplate } from "/js/templates/unavailablePost.template.js";
import { moderationWarningTemplate } from "/js/templates/moderationWarning.template.js";
import {
  linkToPostLikes,
  linkToPostQuotes,
  linkToPostReposts,
} from "/js/navigation.js";
import "/js/components/lightbox-image-group.js";

function postActionCountsTemplate({
  repostCount,
  likeCount,
  quoteCount,
  bookmarkCount,
  post,
}) {
  if (!repostCount && !likeCount && !quoteCount && !bookmarkCount) {
    return null;
  }
  return html`
    <div class="post-action-counts">
      ${repostCount > 0
        ? html`<a href="${linkToPostReposts(post)}" class="post-action-count">
            <span class="post-action-count-num"
              >${formatLargeNumber(repostCount)}</span
            >
            <span class="post-action-count-text"
              >${repostCount === 1 ? "repost" : "reposts"}</span
            >
          </a>`
        : ""}
      ${quoteCount > 0
        ? html`<a href="${linkToPostQuotes(post)}" class="post-action-count">
            <span class="post-action-count-num"
              >${formatLargeNumber(quoteCount)}</span
            >
            <span class="post-action-count-text"
              >${quoteCount === 1 ? "quote" : "quotes"}</span
            >
          </a>`
        : ""}
      ${likeCount > 0
        ? html`<a href="${linkToPostLikes(post)}" class="post-action-count">
            <span class="post-action-count-num"
              >${formatLargeNumber(likeCount)}</span
            >
            <span class="post-action-count-text"
              >${likeCount === 1 ? "like" : "likes"}</span
            >
          </a>`
        : ""}
      ${bookmarkCount > 0
        ? html`<div class="post-action-count">
            <span class="post-action-count-num"
              >${formatLargeNumber(bookmarkCount)}</span
            >
            <span class="post-action-count-text"
              >${bookmarkCount === 1 ? "save" : "saves"}</span
            >
          </div>`
        : ""}
    </div>
  `;
}

export function largePostTemplate({
  post,
  isUserPost,
  postInteractionHandler,
  onClickReply = noop,
  replyContext,
  afterDelete = null,
  afterHide = null,
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
  const badgeLabels = post.viewer?.badgeLabels ?? [];
  const contentLabel = post.viewer?.contentLabel;
  // Instead of hiding, add the content label to the badge labels
  if (contentLabel && contentLabel.visibility !== "ignore") {
    badgeLabels.push(contentLabel);
  }
  let content = html`
      <div class="post-content">
        <div class="post-content-top">
          <div>
            ${
              replyContext === "parent" || replyContext === "reply"
                ? html`<div class="reply-context-line-in"></div>`
                : ""
            }
            <div>${avatarTemplate({ author: post.author })}</div>
          </div>
          <div class="large-post-header-text">
            ${postHeaderTextTemplate({
              author: post.author,
              timestamp: post.record.createdAt,
              includeTime: false,
            })}
          </div>
        </div>
        ${badgeLabels.length > 0 ? postLabelsTemplate({ badgeLabels }) : ""}
        <div class="post-content-bottom">
          <div class="post-body">
            ${
              postText.length > 0
                ? html`<div class="post-text">
                    ${richTextTemplate({
                      text: postText,
                      facets: post.record.facets,
                    })}
                  </div>`
                : ""
            }
            ${
              post.embed
                ? html`<div class="post-embed">
                    ${postEmbedTemplate({
                      embed: post.embed,
                      mediaLabel: post.viewer?.mediaLabel,
                      isAuthenticated: postInteractionHandler.isAuthenticated,
                    })}
                  </div>`
                : null
            }
            <div class="post-full-timestamp">
              ${formatFullTimestamp(post.record.createdAt)}
            </div>
            ${postActionCountsTemplate({
              repostCount: post.repostCount,
              quoteCount: post.quoteCount,
              likeCount: post.likeCount,
              bookmarkCount: post.bookmarkCount,
              post,
            })}
            ${postActionBarTemplate({
              post,
              isUserPost,
              isAuthenticated: postInteractionHandler.isAuthenticated,
              onClickReply,
              onClickLike: (post, doLike) =>
                postInteractionHandler.handleLike(post, doLike),
              onClickRepost: (post, doRepost) =>
                postInteractionHandler.handleRepost(post, doRepost),
              onClickQuotePost: (post) =>
                postInteractionHandler.handleQuotePost(post),
              onClickBookmark: (post, doBookmark) =>
                postInteractionHandler.handleBookmark(post, doBookmark),
              onClickHidePost: async (post) => {
                await postInteractionHandler.handleHidePost(post);
                if (afterHide) {
                  afterHide(post);
                }
              },
              onClickMute: (profile, doMute) =>
                postInteractionHandler.handleMuteAuthor(profile, doMute),
              onClickBlock: (profile, doBlock) =>
                postInteractionHandler.handleBlockAuthor(profile, doBlock),
              onClickDelete: async (post) => {
                await postInteractionHandler.handleDeletePost(post);
                if (afterDelete) {
                  afterDelete(post);
                }
              },
              onClickReport: (post) =>
                postInteractionHandler.handleReport(post),
            })}
            </div>
          </div>
        </div>
      </div>
    `;

  if (post.viewer?.hasMutedWord) {
    content = html`<moderation-warning label="Post hidden by muted word"
      >${content}</moderation-warning
    > `;
  } else if (post.viewer?.isHidden) {
    content = html`<moderation-warning label="Post hidden by you"
      >${content}</moderation-warning
    > `;
  }
  return html`<div class="post large-post">${content}</div>`;
}
