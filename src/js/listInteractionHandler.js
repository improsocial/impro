import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";

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
}
