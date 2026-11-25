import { html, repeat } from "/js/lib/lit-html.js";
import "/js/components/infinite-scroll-container.js";

function paginatedListItemSkeletonTemplate() {
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

function uniqueItemKeys(items, itemKey) {
  const occurrences = new Map();
  return items.map((item) => {
    const key = itemKey(item);
    const count = occurrences.get(key) ?? 0;
    occurrences.set(key, count + 1);
    return count === 0 ? key : `${key}#${count}`;
  });
}

function itemsTemplate({ items, renderItem, itemKey }) {
  if (!itemKey) {
    return items.map(renderItem);
  }
  const keys = uniqueItemKeys(items, itemKey);
  return repeat(items, (_, index) => keys[index], renderItem);
}

function emptyListMessageTemplate(message) {
  return html`<div class="feed-end-message" data-testid="empty-state">
    ${message}
  </div>`;
}

function endListMessageTemplate(message) {
  return html`<div class="feed-end-message" data-testid="feed-end-message">
    ${message}
  </div>`;
}

export function paginatedListTemplate({
  items,
  renderItem,
  itemKey = null,
  renderSkeletonItem = paginatedListItemSkeletonTemplate,
  skeletonCount = 10,
  hasMore = false,
  onLoadMore = null,
  emptyMessage = null,
  emptyTemplate = null,
  endMessage = null,
  footerTemplate = null,
  errorTemplate = null,
  lookahead = "2500px",
  containerClass = "feeds-list",
  containerTestId = "feeds-list",
}) {
  if (!items) {
    return html`<div
      class="${containerClass} loading-block"
      data-testid=${containerTestId}
    >
      ${Array.from({ length: skeletonCount }).map((_, index) =>
        renderSkeletonItem({ index }),
      )}
    </div>`;
  }
  const trailing = errorTemplate
    ? errorTemplate
    : hasMore
      ? html`<div
          class="feed-loading-indicator"
          data-testid="feed-loading-indicator"
        >
          <div class="loading-spinner"></div>
        </div>`
      : (footerTemplate ??
        (endMessage ? endListMessageTemplate(endMessage) : ""));
  const list = html`<div class=${containerClass} data-testid=${containerTestId}>
    ${items.length === 0
      ? (emptyTemplate ??
        (emptyMessage ? emptyListMessageTemplate(emptyMessage) : ""))
      : html`${itemsTemplate({ items, renderItem, itemKey })}${trailing}`}
  </div>`;
  if (!onLoadMore) return list;
  return html`
    <infinite-scroll-container
      lookahead=${lookahead}
      ?disabled=${!!errorTemplate || !hasMore}
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
