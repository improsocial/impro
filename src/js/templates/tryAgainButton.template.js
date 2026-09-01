import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function tryAgainButtonTemplate() {
  return html`<button
    class="rounded-button rounded-button-secondary-inverted try-again-button"
    @click=${() => window.location.reload()}
  >
    <app-icon icon="reload-line"></app-icon> Try again
  </button>`;
}
