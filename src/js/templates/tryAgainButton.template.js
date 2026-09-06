import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function tryAgainButtonTemplate({
  onClick = () => window.location.reload(),
} = {}) {
  return html`<button
    class="rounded-button rounded-button-secondary-inverted try-again-button"
    @click=${onClick}
  >
    <app-icon icon="reload-line"></app-icon> Try again
  </button>`;
}
