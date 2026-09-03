import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function unavailablePostTemplate() {
  return html`<div
    class="post small-post"
    data-testid="post-tombstone-unavailable"
  >
    <div class="missing-post-indicator">
      <app-icon icon="info-circle-line"></app-icon> Post unavailable
    </div>
  </div> `;
}
