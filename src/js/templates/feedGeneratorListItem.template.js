import { html } from "/js/lib/lit-html.js";
import { linkToFeed } from "/js/navigation.js";

export function feedGeneratorListItemTemplate({ feedGenerator }) {
  return html`
    <div
      class="feeds-list-item clickable"
      @click=${() => window.router.go(linkToFeed(feedGenerator))}
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
              by @${feedGenerator.creator.handle}
            </div>`
          : ""}
      </div>
    </div>
  `;
}
