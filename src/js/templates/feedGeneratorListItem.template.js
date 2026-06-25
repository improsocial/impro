import { html } from "/js/lib/lit-html.js";
import { linkToFeed } from "/js/navigation.js";
import "/js/components/container-link.js";

export function feedGeneratorListItemTemplate({
  feedGenerator,
  currentUserDid,
}) {
  return html`
    <container-link
      class="feeds-list-item clickable"
      href=${linkToFeed(feedGenerator)}
    >
      <div class="feeds-list-item-avatar">
        ${feedGenerator.avatar
          ? html`<img
              src=${feedGenerator.avatar}
              alt=${feedGenerator.displayName}
              class="feed-avatar"
            />`
          : html`<img
              src="/img/list-avatar-fallback.svg"
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
                : `@${feedGenerator.creator.handle}`}
            </div>`
          : ""}
      </div>
    </container-link>
  `;
}
