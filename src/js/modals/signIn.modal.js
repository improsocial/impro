import { html } from "/js/lib/lit-html.js";
import { linkToLogin } from "/js/navigation.js";
import { Modal } from "/js/modals/modal.js";

export class SignInModal extends Modal {
  get className() {
    return "bottom-sheet text-modal sign-in-modal compact";
  }

  get attributes() {
    return { "data-testid": "sign-in-modal" };
  }

  render({ dismiss }) {
    return html`
      <div class="modal-dialog-content">
        <h2
          class="modal-dialog-title modal-dialog-title-large"
          data-testid="modal-title"
        >
          Sign in
        </h2>
        <p class="modal-dialog-message" data-testid="modal-message">
          Sign in to join the conversation!
        </p>
        <a
          href=${linkToLogin()}
          class="modal-dialog-button primary-button full-width"
          data-testid="modal-primary-button"
          @click=${() => dismiss()}
        >
          Sign in
        </a>
      </div>
    `;
  }
}
