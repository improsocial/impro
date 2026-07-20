import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";

class ChoiceModal extends Modal {
  get className() {
    return "bottom-sheet text-modal confirm-modal choice-modal compact";
  }

  get attributes() {
    return { "data-testid": "choice-modal" };
  }

  render({ dismiss, props: { message, title, choices } }) {
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
        <div class="modal-dialog-buttons modal-dialog-buttons-stacked">
          ${choices.map(
            (choice) => html`
              <button
                class="modal-dialog-button ${choice.style ?? "primary"}-button"
                data-testid="modal-choice-${choice.value}"
                @click=${() => dismiss(choice.value)}
              >
                ${choice.label}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }
}

// Presents a stacked list of choices; resolves with the chosen value, or null
// when dismissed without choosing a value
export async function choiceModal(message, options = {}) {
  return (await ChoiceModal.open({ message, ...options })) ?? null;
}
