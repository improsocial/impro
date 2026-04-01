import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { noop } from "/js/utils.js";

export class FeedInteractionHandler {
  constructor(dataLayer, { renderFunc = noop } = {}) {
    this.dataLayer = dataLayer;
    this.renderFunc = renderFunc;
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
        showToast("Failed to pin feed", { error: true });
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
        showToast("Failed to unpin feed", { error: true });
        this.renderFunc();
      }
    }
  }
}
