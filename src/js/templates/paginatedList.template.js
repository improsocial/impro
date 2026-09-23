import { html } from "/js/lib/lit-html.js";
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
    return html`<div class=${containerClass} data-testid=${containerTestId}>
      ${Array.from({ length: skeletonCount }).map(() => renderSkeletonItem())}
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
      : html`${items.map(renderItem)}${trailing}`}
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
