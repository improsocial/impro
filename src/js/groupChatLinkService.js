import { html } from "/js/lib/lit-html.js";
import { showActionModal, showInfoModal } from "/js/modals.js";
import { showToast } from "/js/toasts.js";

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
      this._openJoinDialog(preview);
      return;
    }
    if (actionType === "requested") {
      showInfoModal({
        title: "Request pending",
        message: "The group owner will review your request.",
      });
    }
  }

  _openJoinDialog(preview) {
    const name = preview.name ?? "";
    showActionModal({
      title: preview.requireApproval ? "Request to join" : "Join group chat",
      message: preview.requireApproval
        ? html`Send a request to join <strong>${name}</strong>. The group owner
            will review your request before you can see messages.`
        : html`You're about to join <strong>${name}</strong>.`,
      confirmButtonText: preview.requireApproval ? "Send request" : "Join",
      onConfirm: () => this._submit(preview),
    });
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
