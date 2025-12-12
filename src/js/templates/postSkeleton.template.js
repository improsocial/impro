import { html } from "/js/lib/lit-html.js";
import { repostIconTemplate } from "/js/templates/icons/repostIcon.template.js";
import { replyIconTemplate } from "/js/templates/icons/replyIcon.template.js";
import { heartIconTemplate } from "/js/templates/icons/heartIcon.template.js";

export function postSkeletonTemplate() {
  return html`<div class="post-skeleton">
    <div class="skeleton-left">
      <div class="skeleton-avatar skeleton-animate"></div>
    </div>
    <div class="skeleton-right">
      <div class="skeleton-content">
        <div class="skeleton-line-short skeleton-animate"></div>
        ${Array.from({ length: 2 }).map((_, index) => {
          return html`<div class="skeleton-line skeleton-animate"></div>`;
        })}
      </div>
      <div class="skeleton-actions">
        <div class="skeleton-action">
          <div class="skeleton-action-icon">${replyIconTemplate()}</div>
        </div>
        <div class="skeleton-action">
          <div class="skeleton-action-icon">${repostIconTemplate()}</div>
        </div>
        <div class="skeleton-action">
          <div class="skeleton-action-icon">${heartIconTemplate()}</div>
        </div>
      </div>
    </div>
  </div>`;
}
