import { html } from "/js/lib/lit-html.js";
import { cdnImageUrl, isModerationList } from "/js/dataHelpers.js";
import { linkToList } from "/js/navigation.js";
import "/js/components/container-link.js";

function listItemSkeletonTemplate() {
  return html`
    <div
      class="feeds-list-item feeds-list-item-skeleton"
      data-testid="feeds-list-item-skeleton"
    >
      <div class="feeds-list-item-avatar">
        <div class="feeds-list-item-skeleton-avatar skeleton-animate"></div>
      </div>
      <div class="feeds-list-item-content">
        <div class="feeds-list-item-skeleton-title skeleton-animate"></div>
        <div class="feeds-list-item-skeleton-creator skeleton-animate"></div>
      </div>
    </div>
  `;
}

function listItemTemplate({ list }) {
  return html`
    <container-link
      class="feeds-list-item clickable"
      data-testid="feeds-list-item-list"
      href=${linkToList(list)}
    >
      <div class="feeds-list-item-avatar">
        <img
          src=${cdnImageUrl(list.avatar) || "/img/list-avatar-fallback.svg"}
          alt=${list.name}
          class="feed-avatar"
        />
      </div>
      <div class="feeds-list-item-content">
        <div class="feeds-list-item-title">${list.name}</div>
        ${list.creator
          ? html`<div class="feeds-list-item-creator">
              ${isModerationList(list) ? "Moderation list" : "List"} by
              @${list.creator.handle}
            </div>`
          : ""}
      </div>
    </container-link>
  `;
}

export function listFeedTemplate({ lists, cursor, onLoadMore }) {
  if (!lists) {
    return html`<div class="feeds-list" data-testid="feeds-list">
      ${Array.from({ length: 10 }).map(() => listItemSkeletonTemplate())}
    </div>`;
  }
  const hasMore = !!cursor;
  const list = html`<div class="feeds-list" data-testid="feeds-list">
    ${lists.length === 0
      ? html`<div class="feed-end-message">No lists.</div>`
      : lists.map((item) => listItemTemplate({ list: item }))}
    ${hasMore ? html`<div class="loading-spinner"></div>` : ""}
  </div>`;
  if (!onLoadMore) return list;
  return html`
    <infinite-scroll-container
      lookahead="2500px"
      @load-more=${async (event) => {
        if (hasMore) {
          await onLoadMore();
          event.detail.resume();
        }
      }}
    >
      ${list}
    </infinite-scroll-container>
  `;
}
