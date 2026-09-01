import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function blockedPostTemplate() {
  return html`<div class="post small-post" data-testid="post-tombstone-blocked">
    <div class="missing-post-indicator">
      <app-icon icon="info-circle-line"></app-icon> Blocked
    </div>
  </div> `;
}
