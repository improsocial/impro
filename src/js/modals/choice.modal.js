import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";

class ChoiceModal extends Modal {
  #pendingValue = null;

  get className() {
    return "bottom-sheet text-modal confirm-modal choice-modal compact";
  }

  get attributes() {
    return { "data-testid": "choice-modal" };
  }

  canDismiss() {
    return this.#pendingValue === null;
  }

  render({ dismiss, update, props: { message, title, choices, onChoose } }) {
    const pendingValue = this.#pendingValue;
    const isPending = pendingValue !== null;
    const handleChoice = async (choice) => {
      if (!onChoose) {
        dismiss(choice.value);
        return;
      }
      this.#pendingValue = choice.value;
      update();
      try {
        await onChoose(choice.value);
        dismiss(choice.value);
      } catch {
        this.#pendingValue = null;
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
        <div class="modal-dialog-buttons modal-dialog-buttons-stacked">
          ${choices.map((choice) => {
            const choicePending = pendingValue === choice.value;
            return html`
              <button
                class="modal-dialog-button ${choice.style ??
                "primary"}-button ${choicePending ? "is-pending" : ""}"
                data-testid="modal-choice-${choice.value}"
                data-teststate=${choicePending ? "pending" : "idle"}
                ?disabled=${isPending}
                @click=${() => handleChoice(choice)}
              >
                ${choice.label}
                ${choicePending
                  ? html`<div class="loading-spinner"></div>`
                  : null}
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }
}

// Presents a stacked list of choices; resolves with the chosen value, or null
// when dismissed without choosing a value. An optional `onChoose(value)` is
// awaited before the modal dismisses (the chosen button shows a spinner);
// throw from it to keep the modal open.
export async function choiceModal(message, options = {}) {
  return (await ChoiceModal.open({ message, ...options })) ?? null;
}
