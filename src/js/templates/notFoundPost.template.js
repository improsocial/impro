import { html } from "/js/lib/lit-html.js";
import { trashCanIconTemplate } from "/js/templates/icons/trashCanIcon.template.js";

export function notFoundPostTemplate() {
  return html`<div class="post small-post">
    <div class="missing-post-indicator">
      ${trashCanIconTemplate()} Post not found
    </div>
  </div> `;
}
