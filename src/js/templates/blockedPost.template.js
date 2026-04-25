import { html } from "/js/lib/lit-html.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";

export function blockedPostTemplate() {
  return html`<div class="post small-post">
    <div class="missing-post-indicator">${infoIconTemplate()} Blocked</div>
  </div> `;
}
