import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function notFoundPostTemplate() {
  return html`<div
    class="post small-post"
    data-testid="post-tombstone-not-found"
  >
    <div class="missing-post-indicator">
      <app-icon icon="delete-bin-line"></app-icon> Post not found
    </div>
  </div> `;
}
