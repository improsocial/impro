import { html } from "/js/lib/lit-html.js";

export function blockedPostTemplate() {
  return html`<div class="post small-post">
    <div class="missing-post-indicator">Post unavailable</div>
  </div> `;
}
