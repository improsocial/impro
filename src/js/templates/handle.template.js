import { html } from "/js/lib/lit-html.js";
import { INVALID_HANDLE } from "/js/dataHelpers.js";
import { alertModal } from "/js/modals/alert.modal.js";
import "/js/components/app-icon.js";

export function handleTemplate(handle) {
  if (handle === INVALID_HANDLE) {
    return html`<button
      class="invalid-handle-badge"
      data-testid="invalid-handle-badge"
      title="Invalid handle"
      @click=${(event) => {
        event.preventDefault();
        event.stopPropagation();
        alertModal("This account's handle couldn't be verified.", {
          title: "Invalid handle",
          confirmButtonText: "Okay",
        });
      }}
    >
      <app-icon icon="alert-circle-line"></app-icon>Invalid handle
    </button>`;
  }
  return `@${handle}`;
}
