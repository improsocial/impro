import { html } from "/js/lib/lit-html.js";
import { reloadIconTemplate } from "/js/templates/icons/reloadIcon.template.js";

export function tryAgainButtonTemplate() {
  return html`<button
    class="rounded-button rounded-button-secondary-inverted try-again-button"
    @click=${() => window.location.reload()}
  >
    ${reloadIconTemplate()} Try again
  </button>`;
}
