import "/js/components/join-group-chat-dialog.js";
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
      showToast("Request pending — the group owner will review it.", {
        style: "default",
      });
    }
  }

  _openJoinDialog(preview) {
    if (this.currentDialog) {
      console.warn("Join group chat dialog already open");
      return;
    }
    const dialog = document.createElement("join-group-chat-dialog");
    dialog.setAttribute("name", preview.name ?? "");
    if (preview.requireApproval) dialog.setAttribute("require-approval", "");
    dialog.addEventListener("confirm", (event) =>
      this._submit({ preview, ...event.detail }),
    );
    dialog.addEventListener("dialog-closed", () => {
      dialog.remove();
      this.currentDialog = null;
    });
    this.currentDialog = dialog;
    document.body.appendChild(dialog);
    dialog.open();
  }

  async _submit({ preview, successCallback, errorCallback }) {
    try {
      await this.dataLayer.mutations.requestJoinGroupChat(preview.code);
      successCallback();
      showToast(
        preview.requireApproval
          ? "Request sent — the group owner will review your request."
          : "Joined group chat",
        { style: "success" },
      );
    } catch (error) {
      console.error(error);
      errorCallback();
      showToast("Could not send join request. Please try again.", {
        style: "error",
      });
    }
  }
}
