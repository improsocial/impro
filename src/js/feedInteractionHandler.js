import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { EventEmitter } from "/js/eventEmitter.js";

export class FeedInteractionHandler extends EventEmitter {
  constructor(dataLayer) {
    super();
    this.dataLayer = dataLayer;
  }

  renderFunc() {
    this.emit("requestRender");
  }

  async handlePinFeed(feedUri, doPin) {
    if (doPin) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.pinFeed(feedUri);
        this.renderFunc();
        await promise;
        this.renderFunc();
        showToast("Feed pinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to pin feed", { style: "error" });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.unpinFeed(feedUri);
        this.renderFunc();
        await promise;
        this.renderFunc();
        showToast("Feed unpinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to unpin feed", { style: "error" });
        this.renderFunc();
      }
    }
  }
}
