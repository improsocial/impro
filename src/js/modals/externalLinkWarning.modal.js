import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";

export class ExternalLinkWarningModal extends Modal {
  get className() {
    return "bottom-sheet text-modal external-link-warning-modal";
  }

  render({ dismiss, props: { href } }) {
    const url = new URL(href);
    return html`
      <div class="modal-dialog-content">
        <h2
          class="modal-dialog-title"
          data-testid="external-link-warning-title"
        >
          Leave this app?
        </h2>
        <p
          class="modal-dialog-message"
          data-testid="external-link-warning-message"
        >
          This link will take you to:
        </p>
        <a
          class="external-link-warning-href"
          href=${href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="external-link-warning-href"
          @click=${(event) => {
            event.stopPropagation();
            dismiss(true);
          }}
        >
          <span class="external-link-warning-host">${url.host}</span
          ><span class="external-link-warning-path"
            >${url.pathname}${url.search}${url.hash}</span
          >
        </a>
        <div class="modal-dialog-buttons">
          <button
            class="modal-dialog-button cancel-button"
            data-testid="external-link-warning-cancel-button"
            @click=${() => dismiss(false)}
          >
            Cancel
          </button>
          <button
            class="modal-dialog-button confirm-button primary-button"
            data-testid="external-link-warning-visit-button"
            @click=${() => {
              window.open(href, "_blank", "noopener,noreferrer");
              dismiss(true);
            }}
          >
            Visit site
          </button>
        </div>
      </div>
    `;
  }
}
