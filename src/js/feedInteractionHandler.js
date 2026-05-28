import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";

export class FeedInteractionHandler {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  async handlePinFeed(feedUri, doPin) {
    if (doPin) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.pinFeed(feedUri);
        showToast("Feed pinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to pin feed", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unpinFeed(feedUri);
        showToast("Feed unpinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to unpin feed", { style: "error" });
      }
    }
  }
}
