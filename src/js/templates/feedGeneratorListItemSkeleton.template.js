import { html } from "/js/lib/lit-html.js";

export function feedGeneratorListItemSkeletonTemplate() {
  return html`
    <div
      class="feeds-list-item feeds-list-item-skeleton"
      data-testid="feed-generator-list-item-skeleton"
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
