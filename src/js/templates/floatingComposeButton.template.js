import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function floatingComposeButtonTemplate({ onClick, disabled = false }) {
  return html`<button
    class="fab floating-compose-button"
    data-testid="floating-compose-button"
    ?disabled=${disabled}
    @click=${() => onClick()}
  >
    <app-icon icon="edit-pen-2"></app-icon>
  </button>`;
}
