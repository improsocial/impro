import { html, render } from "/js/lib/lit-html.js";

let signInModal = null;

export async function showSignInModal() {
  if (!signInModal) {
    signInModal = document.createElement("dialog");
    signInModal.classList.add("modal-dialog", "compact");

    render(
      html`
        <div class="modal-dialog-content">
          <h2 class="modal-dialog-title modal-dialog-title-large">Impro</h2>
          <p class="modal-dialog-message">Sign in to join the conversation!</p>
          <a
            href="/login"
            class="modal-dialog-button primary-button full-width"
            @click=${() => {
              signInModal.close();
            }}
          >
            Sign In
          </a>
        </div>
      `,
      signInModal,
    );

    // Dismiss on backdrop click
    signInModal.addEventListener("click", (e) => {
      if (e.target.tagName === "DIALOG") {
        e.target.close();
      }
    });

    document.body.appendChild(signInModal);
  }
  signInModal.showModal();
}

export function showInfoModal({ title, message, confirmButtonText = "OK" }) {
  const dialog = document.createElement("dialog");
  dialog.classList.add("modal-dialog", "info-modal");

  render(
    html`
      <div class="modal-dialog-content">
        <h2 class="modal-dialog-title">${title}</h2>
        <p class="modal-dialog-message">${message}</p>
        <div class="modal-dialog-buttons">
          <button class="modal-dialog-button primary-button">
            ${confirmButtonText}
          </button>
        </div>
      </div>
    `,
    dialog,
  );

  const okButton = dialog.querySelector(".primary-button");

  const dismiss = () => {
    dialog.close();
    dialog.remove();
  };

  okButton.addEventListener("click", dismiss);

  // Dismiss on backdrop click
  dialog.addEventListener("click", (e) => {
    if (e.target.tagName === "DIALOG") {
      dismiss();
    }
  });

  // Dismiss on Escape key
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    dismiss();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}

export async function confirm(
  message,
  {
    title = null,
    confirmButtonStyle = "primary",
    confirmButtonText = "Confirm",
  } = {},
) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.classList.add("modal-dialog");

    render(
      html`
        <div class="modal-dialog-content">
          ${title ? html`<h2 class="modal-dialog-title">${title}</h2>` : null}
          <p class="modal-dialog-message">${message}</p>
          <div class="modal-dialog-buttons">
            <button class="modal-dialog-button cancel-button">Cancel</button>
            <button
              class="modal-dialog-button confirm-button ${confirmButtonStyle}-button"
            >
              ${confirmButtonText}
            </button>
          </div>
        </div>
      `,
      dialog,
    );

    const cancelButton = dialog.querySelector(".cancel-button");
    const confirmButton = dialog.querySelector(".confirm-button");

    const dismiss = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    cancelButton.addEventListener("click", () => dismiss(false));
    confirmButton.addEventListener("click", () => dismiss(true));

    // Dismiss on backdrop click
    dialog.addEventListener("click", (e) => {
      if (e.target.tagName === "DIALOG") {
        dismiss(false);
      }
    });

    // Dismiss on Escape key
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      dismiss(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
