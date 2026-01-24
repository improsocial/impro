import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { noop } from "/js/utils.js";

export class ProfileInteractionHandler {
  constructor(dataLayer, { renderFunc = noop } = {}) {
    this.dataLayer = dataLayer;
    this.renderFunc = renderFunc;
  }

  async handleFollow(profile, doFollow, { showSuccessToast = false } = {}) {
    if (doFollow) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.followProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        if (showSuccessToast) {
          showToast("Account followed");
        }
      } catch (error) {
        console.error(error);
        showToast("Failed to follow account", { error: true });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.unfollowProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        if (showSuccessToast) {
          showToast("Account unfollowed");
        }
      } catch (error) {
        console.error(error);
        showToast("Failed to unfollow account", { error: true });
        this.renderFunc();
      }
    }
  }

  async handleMute(profile, doMute) {
    if (doMute) {
      try {
        const promise = this.dataLayer.mutations.muteProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Account muted");
      } catch (error) {
        console.error(error);
        showToast("Failed to mute account", { error: true });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.unmuteProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Account unmuted");
      } catch (error) {
        console.error(error);
        showToast("Failed to unmute account", { error: true });
        this.renderFunc();
      }
    }
  }

  async handleBlock(profile, doBlock) {
    if (doBlock) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.blockProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Account blocked");
      } catch (error) {
        console.error(error);
        showToast("Failed to block account", { error: true });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.unblockProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Account unblocked");
      } catch (error) {
        console.error(error);
        showToast("Failed to unblock account", { error: true });
        this.renderFunc();
      }
    }
  }

  async handleSubscribe(profile, doSubscribe) {
    if (doSubscribe) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.subscribeLabeler(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Subscribed to labeler");
      } catch (error) {
        console.error(error);
        showToast("Failed to subscribe to labeler", { error: true });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.unsubscribeLabeler(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Unsubscribed from labeler");
      } catch (error) {
        console.error(error);
        showToast("Failed to unsubscribe from labeler", { error: true });
        this.renderFunc();
      }
    }
  }
}
