import { html } from "/js/lib/lit-html.js";
import { editIconTemplate } from "/js/templates/icons/editIcon.template.js";

export function floatingComposeButtonTemplate({ onClick }) {
  return html`<button
    class="floating-compose-button"
    data-testid="floating-compose-button"
    @click=${() => onClick()}
  >
    ${editIconTemplate()}
  </button>`;
}
