import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";
import { alertModal } from "/js/modals/alert.modal.js";
import { showToast } from "/js/toasts.js";

class JoinChatModal extends Modal {
  get className() {
    return "bottom-sheet text-modal join-chat-modal";
  }

  get attributes() {
    return { "data-testid": "join-chat-modal" };
  }

  constructor(options) {
    super(options);
    this.isPending = false;
  }

  canDismiss() {
    return !this.isPending;
  }

  render({ dismiss, update, props: { preview, onSubmit } }) {
    const name = preview.name ?? "";
    const runConfirm = async () => {
      if (this.isPending) return;
      this.isPending = true;
      update();
      try {
        await onSubmit();
        this.isPending = false;
        dismiss(true);
      } catch {
        this.isPending = false;
        update();
      }
    };
    return html`
      <div class="modal-dialog-content">
        <h2 class="modal-dialog-title" data-testid="modal-title">
          ${preview.requireApproval ? "Request to join" : "Join group chat"}
        </h2>
        <p class="modal-dialog-message" data-testid="modal-message">
          ${preview.requireApproval
            ? html`Send a request to join <strong>${name}</strong>. The group
                owner will review your request before you can see messages.`
            : html`You're about to join <strong>${name}</strong>.`}
        </p>
        <div class="modal-dialog-buttons">
          <button
            class="modal-dialog-button cancel-button"
            data-testid="modal-cancel-button"
            ?disabled=${this.isPending}
            @click=${() => dismiss(false)}
          >
            Cancel
          </button>
          <button
            class="modal-dialog-button confirm-button primary-button"
            data-testid="modal-confirm-button"
            ?disabled=${this.isPending}
            @click=${runConfirm}
          >
            ${this.isPending
              ? html`<span
                  class="loading-spinner"
                  data-testid="loading-spinner"
                ></span>`
              : preview.requireApproval
                ? "Send request"
                : "Join"}
          </button>
        </div>
      </div>
    `;
  }
}

export class GroupChatLinkService {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  handleAction(actionType, preview) {
    if (actionType === "copy") {
      navigator.clipboard?.writeText(`https://bsky.app/chat/${preview.code}`);
      showToast("Copied to clipboard", { style: "success" });
      return;
    }
    if (!this.dataLayer.isAuthenticated) {
      window.open(
        `https://bsky.app/chat/${preview.code}`,
        "_blank",
        "noopener",
      );
      return;
    }
    if (actionType === "open") {
      const convoId = preview.convo?.id ?? preview.convoId;
      if (convoId) window.router.go(`/messages/${convoId}`);
      return;
    }
    if (actionType === "join" || actionType === "request") {
      JoinChatModal.open({
        preview,
        onSubmit: () => this._submit(preview),
      });
      return;
    }
    if (actionType === "requested") {
      alertModal("The group owner will review your request.", {
        title: "Request pending",
      });
    }
  }

  async _submit(preview) {
    try {
      await this.dataLayer.mutations.requestJoinGroupChat(preview.code);
      showToast(
        preview.requireApproval
          ? "Request sent — the group owner will review your request."
          : "Joined group chat",
        { style: "success" },
      );
    } catch (error) {
      console.error(error);
      showToast("Could not send join request. Please try again.", {
        style: "error",
      });
      throw error;
    }
  }
}
