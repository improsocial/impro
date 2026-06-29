import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";

class AlertModal extends Modal {
  get className() {
    return "bottom-sheet text-modal alert-modal";
  }

  get attributes() {
    return { "data-testid": "alert-modal" };
  }

  render({ dismiss, props: { message, title, confirmButtonText = "OK" } }) {
    return html`
      <div class="modal-dialog-content">
        ${title
          ? html`<h2 class="modal-dialog-title" data-testid="modal-title">
              ${title}
            </h2>`
          : null}
        <p class="modal-dialog-message" data-testid="modal-message">
          ${message}
        </p>
        <div class="modal-dialog-buttons">
          <button
            class="modal-dialog-button primary-button"
            data-testid="modal-primary-button"
            @click=${() => dismiss()}
          >
            ${confirmButtonText}
          </button>
        </div>
      </div>
    `;
  }
}

export function alertModal(message, options = {}) {
  AlertModal.open({ message, ...options });
}
