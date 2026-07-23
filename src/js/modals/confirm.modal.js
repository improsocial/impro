import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";

class ConfirmModal extends Modal {
  #isPending = false;

  get className() {
    return "bottom-sheet text-modal confirm-modal compact";
  }

  get attributes() {
    return { "data-testid": "confirm-modal" };
  }

  canDismiss() {
    return !this.#isPending;
  }

  render({
    dismiss,
    update,
    props: {
      message,
      title,
      confirmButtonStyle = "primary",
      confirmButtonText = "Confirm",
      pendingText = null,
      onConfirm = null,
    },
  }) {
    const isPending = this.#isPending;
    const handleConfirm = async () => {
      if (!onConfirm) {
        dismiss(true);
        return;
      }
      this.#isPending = true;
      update();
      try {
        await onConfirm();
        dismiss(true);
      } catch {
        this.#isPending = false;
        update();
      }
    };
    return html`
      <div class="modal-dialog-content" ?inert=${isPending}>
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
            class="modal-dialog-button confirm-button ${confirmButtonStyle}-button ${isPending
              ? "is-pending"
              : ""}"
            data-testid="modal-confirm-button"
            data-teststate=${isPending ? "pending" : "idle"}
            @click=${handleConfirm}
          >
            ${isPending
              ? html`<div class="loading-spinner"></div>
                  ${pendingText ?? confirmButtonText}`
              : confirmButtonText}
          </button>
        </div>
      </div>
    `;
  }
}

export async function confirmModal(message, options = {}) {
  return (await ConfirmModal.open({ message, ...options })) ?? false;
}
