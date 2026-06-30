import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";

class ConfirmModal extends Modal {
  get className() {
    return "bottom-sheet text-modal confirm-modal compact";
  }

  get attributes() {
    return { "data-testid": "confirm-modal" };
  }

  render({
    dismiss,
    props: {
      message,
      title,
      confirmButtonStyle = "primary",
      confirmButtonText = "Confirm",
    },
  }) {
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
            class="modal-dialog-button cancel-button"
            data-testid="modal-cancel-button"
            @click=${() => dismiss(false)}
          >
            Cancel
          </button>
          <button
            class="modal-dialog-button confirm-button ${confirmButtonStyle}-button"
            data-testid="modal-confirm-button"
            @click=${() => dismiss(true)}
          >
            ${confirmButtonText}
          </button>
        </div>
      </div>
    `;
  }
}

export async function confirmModal(message, options = {}) {
  return new Promise((resolveOuter) => {
    let resolved = false;
    const resolveOnce = (value) => {
      if (resolved) return;
      resolved = true;
      resolveOuter(value);
    };
    globalThis.__testConfirmation?.(resolveOnce);
    ConfirmModal.open({ message, ...options }).then((value) =>
      resolveOnce(value ?? false),
    );
  });
}
