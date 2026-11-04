import "/js/components/new-chat-dialog.js";

export class NewChatService {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
    this.currentDialog = null;
  }

  openNewChatDialog() {
    if (this.currentDialog !== null) {
      console.warn("New chat dialog already open");
      return;
    }
    this.currentDialog = document.createElement("new-chat-dialog");
    this.currentDialog.dataLayer = this.dataLayer;
    this.currentDialog.addEventListener("dialog-closed", () => {
      if (this.currentDialog) {
        this.currentDialog.remove();
        this.currentDialog = null;
      }
    });
    document.body.appendChild(this.currentDialog);
    this.currentDialog.open();
  }
}
