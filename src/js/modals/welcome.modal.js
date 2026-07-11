import { html } from "/js/lib/lit-html.js";
import { linkToLogin } from "/js/navigation.js";
import { Modal } from "/js/modals/modal.js";

export class WelcomeModal extends Modal {
  get className() {
    return "bottom-sheet text-modal welcome-modal";
  }

  get attributes() {
    return { "data-testid": "welcome-modal" };
  }

  render({ dismiss }) {
    return html`
      <div class="modal-dialog-content">
        <h2 class="modal-dialog-title" data-testid="modal-title">
          Welcome to Impro!
        </h2>
        <p class="modal-dialog-message" data-testid="modal-message">
          Impro is a community-built alternative Bluesky client. You can find
          more information about the project, including the full source code, at
          our
          <a href="https://github.com/improsocial/impro/blob/main/README.md"
            >GitHub repository</a
          >.
        </p>
        <div class="modal-dialog-buttons">
          <button
            class="modal-dialog-button cancel-button"
            data-testid="modal-secondary-button"
            @click=${() => dismiss()}
          >
            Explore
          </button>
          <a
            href=${linkToLogin()}
            class="modal-dialog-button primary-button"
            data-testid="modal-primary-button"
            autofocus
            @click=${() => dismiss()}
          >
            Sign in
          </a>
        </div>
      </div>
    `;
  }
}
