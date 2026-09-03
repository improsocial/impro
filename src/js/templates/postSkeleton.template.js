import { html } from "/js/lib/lit-html.js";
import { fillableIconTemplate } from "/js/templates/fillableIcon.template.js";
import "/js/components/app-icon.js";

export function postSkeletonTemplate() {
  return html`<div class="post-skeleton" data-testid="post-skeleton">
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
          <div class="skeleton-action-icon">
            <app-icon icon="reply"></app-icon>
          </div>
        </div>
        <div class="skeleton-action">
          <div class="skeleton-action-icon">
            <app-icon icon="repost"></app-icon>
          </div>
        </div>
        <div class="skeleton-action">
          <div class="skeleton-action-icon">
            ${fillableIconTemplate({ icon: "like" })}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
