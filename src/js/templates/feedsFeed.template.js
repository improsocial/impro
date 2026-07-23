import { html } from "/js/lib/lit-html.js";

export function feedsListItemSkeletonTemplate() {
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

export function feedsFeedTemplate({
  items,
  renderItem,
  emptyMessage,
  hasMore = false,
  onLoadMore,
  isEditing = false,
}) {
  if (!items) {
    return html`<div class="feeds-list" data-testid="feeds-list">
      ${Array.from({ length: 10 }).map(() => feedsListItemSkeletonTemplate())}
    </div>`;
  }
  const list = html`<div
    class="feeds-list"
    data-testid="feeds-list"
    ?data-editing=${isEditing}
  >
    ${items.length === 0 && emptyMessage
      ? html`<div class="feed-end-message">${emptyMessage}</div>`
      : items.map((item) => renderItem(item))}
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
