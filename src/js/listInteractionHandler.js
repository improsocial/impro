import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { confirm } from "/js/modals.js";

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
    const confirmed = await confirm(
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
    const confirmed = await confirm(
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
}
