import { html } from "/js/lib/lit-html.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";

export function unavailablePostTemplate() {
  return html`<div
    class="post small-post"
    data-testid="post-tombstone-unavailable"
  >
    <div class="missing-post-indicator">
      ${infoIconTemplate()} Post unavailable
    </div>
  </div> `;
}
