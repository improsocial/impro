import { html } from "/js/lib/lit-html.js";

export function notFoundPostTemplate() {
  return html`<div class="post small-post">
    <div class="missing-post-indicator">Post deleted</div>
  </div> `;
}
