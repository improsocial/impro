import { html } from "/js/lib/lit-html.js";

export function unavailablePostTemplate() {
  return html`<div class="post small-post">
    <div class="missing-post-indicator">Post is unavailable</div>
  </div> `;
}
