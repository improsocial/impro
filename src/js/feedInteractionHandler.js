import { html } from "/js/lib/lit-html.js";
import { haptics } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";

export class FeedInteractionHandler {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  async handlePinFeed(feedUri, doPin) {
    haptics.impactMedium();
    if (doPin) {
      try {
        await this.dataLayer.mutations.pinFeed(feedUri);
        showToast(
          html`<div class="toast-with-link">
            Feed pinned<a
              href="/"
              data-testid="toast-view-feed"
              @click=${(event) => this._viewPinnedFeed(event, feedUri)}
              >View</a
            >
          </div>`,
        );
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

  _viewPinnedFeed(event, feedUri) {
    if (window.location.pathname === "/") {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("select-home-feed", { detail: { feedUri } }),
      );
    } else {
      this.dataLayer.mutations.setSelectedFeedUri(feedUri);
    }
  }
}
