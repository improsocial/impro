import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";

export class StarterPackInteractionHandler {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  async handleOptOut(list) {
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

  async handleUndoOptOut(list) {
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

  async handleDelete(starterPack) {
    return await confirmModal(
      "This starter pack will be permanently deleted. This action cannot be undone.",
      {
        title: "Delete this starter pack?",
        confirmButtonText: "Delete",
        pendingText: "Deleting…",
        confirmButtonStyle: "danger",
        onConfirm: async () => {
          try {
            await this.dataLayer.mutations.deleteStarterPack(starterPack);
            showToast("Starter pack deleted");
          } catch (error) {
            console.error(error);
            showToast("Failed to delete starter pack", { style: "error" });
            throw error;
          }
        },
      },
    );
  }
}
