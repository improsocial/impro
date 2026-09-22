import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";

export class ListInteractionHandler {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  async handlePinList(listUri, doPin) {
    if (doPin) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.pinList(listUri);
        showToast("List pinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to pin list", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unpinList(listUri);
        showToast("List unpinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to unpin list", { style: "error" });
      }
    }
  }

  async handleMuteList(list) {
    const confirmed = await confirmModal(
      "The users on this list will be muted for you. Their posts won't appear in your feeds. Muting is private.",
      {
        title: "Mute these accounts?",
        confirmButtonText: "Mute",
      },
    );
    if (!confirmed) return;
    try {
      hapticsImpactMedium();
      await this.dataLayer.mutations.muteModList(list);
      showToast("List muted");
    } catch (error) {
      console.error(error);
      showToast("Failed to mute list", { style: "error" });
    }
  }

  async handleUnmuteList(list) {
    try {
      await this.dataLayer.mutations.unmuteModList(list);
      showToast("List unmuted");
    } catch (error) {
      console.error(error);
      showToast("Failed to unmute list", { style: "error" });
    }
  }

  async handleBlockList(list) {
    const confirmed = await confirmModal(
      "The users on this list will be blocked. They won't be able to interact with you, and you won't see their content. Blocking is public.",
      {
        title: "Block these accounts?",
        confirmButtonText: "Block",
        confirmButtonStyle: "danger",
      },
    );
    if (!confirmed) return;
    try {
      hapticsImpactMedium();
      await this.dataLayer.mutations.blockModList(list);
      showToast("List blocked");
    } catch (error) {
      console.error(error);
      showToast("Failed to block list", { style: "error" });
    }
  }

  async handleUnblockList(list) {
    try {
      await this.dataLayer.mutations.unblockModList(list);
      showToast("List unblocked");
    } catch (error) {
      console.error(error);
      showToast("Failed to unblock list", { style: "error" });
    }
  }

  async handleOptOutOfReferenceList(list) {
    return await confirmModal(
      "You will no longer appear in this starter pack. The creator will be able to see that you've opted out and remove you if they wish.",
      {
        title: "Opt out of this starter pack?",
        confirmButtonText: "Opt out",
        pendingText: "Opting out…",
        confirmButtonStyle: "danger",
        onConfirm: async () => {
          try {
            hapticsImpactMedium();
            await this.dataLayer.mutations.optOutOfReferenceList(list);
            showToast("Opted out of starter pack");
          } catch (error) {
            showToast("Failed to update starter pack opt-out", {
              style: "error",
            });
            throw error;
          }
        },
      },
    );
  }

  async handleUndoReferenceListOptOut(list) {
    return await confirmModal(
      "You will be eligible to appear in this starter pack again.",
      {
        title: "Undo opt-out?",
        confirmButtonText: "Undo opt-out",
        pendingText: "Undoing…",
        onConfirm: async () => {
          try {
            hapticsImpactMedium();
            await this.dataLayer.mutations.undoReferenceListOptOut(list);
            showToast("Opt-out undone");
          } catch (error) {
            showToast("Failed to update starter pack opt-out", {
              style: "error",
            });
            throw error;
          }
        },
      },
    );
  }

  async handleDeleteList(list) {
    return await confirmModal(
      "This list will be permanently deleted. This action cannot be undone.",
      {
        title: "Delete this list?",
        confirmButtonText: "Delete",
        pendingText: "Deleting…",
        confirmButtonStyle: "danger",
        onConfirm: async () => {
          try {
            await this.dataLayer.mutations.deleteList(list);
            showToast("List deleted");
          } catch (error) {
            console.error(error);
            showToast("Failed to delete list", { style: "error" });
            throw error;
          }
        },
      },
    );
  }
}
