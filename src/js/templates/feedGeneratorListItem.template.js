import { html } from "/js/lib/lit-html.js";
import { linkToFeed } from "/js/navigation.js";
import { cdnImageUrl } from "/js/dataHelpers.js";
import "/js/components/container-link.js";
import { FEED_AVATAR_FALLBACK_URL } from "/js/avatarFallbacks.js";
import { handleTemplate } from "/js/templates/handle.template.js";

export function feedGeneratorListItemTemplate({
  feedGenerator,
  currentUserDid,
  showDescription = false,
  rightItemTemplate = null,
}) {
  return html`
    <container-link
      class="feeds-list-item clickable"
      href=${linkToFeed(feedGenerator)}
    >
      <div class="feeds-list-item-avatar">
        ${feedGenerator.avatar
          ? html`<img
              src=${cdnImageUrl(feedGenerator.avatar)}
              alt=${feedGenerator.displayName}
              class="feed-avatar"
            />`
          : html`<img
              src=${FEED_AVATAR_FALLBACK_URL}
              alt=${feedGenerator.displayName}
              class="feed-avatar"
            />`}
      </div>
      <div class="feeds-list-item-content">
        <div class="feeds-list-item-title">${feedGenerator.displayName}</div>
        ${feedGenerator.creator
          ? html`<div class="feeds-list-item-creator">
              Feed by
              ${feedGenerator.creator.did === currentUserDid
                ? "you"
                : handleTemplate(feedGenerator.creator.handle)}
            </div>`
          : ""}
        ${showDescription && feedGenerator.description
          ? // prettier-ignore
            html`<div class="feeds-list-item-description">${feedGenerator.description}</div>`
          : ""}
      </div>
      ${rightItemTemplate
        ? html`<div class="feeds-list-item-actions">
            ${rightItemTemplate(feedGenerator)}
          </div>`
        : ""}
    </container-link>
  `;
}
