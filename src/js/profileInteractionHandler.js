import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { noop } from "/js/utils.js";
import "/js/components/post-notifications-dialog.js";

export class ProfileInteractionHandler {
  constructor(dataLayer, reportService, { renderFunc = noop } = {}) {
    this.dataLayer = dataLayer;
    this.reportService = reportService;
    this.renderFunc = renderFunc;
    this._postNotificationsDialog = null;
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

  async handleSubscribe(profile, doSubscribe, labelerInfo) {
    if (doSubscribe) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.subscribeLabeler(
          profile,
          labelerInfo,
        );
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

  async handlePostNotificationSubscription(profile) {
    if (this._postNotificationsDialog !== null) {
      return;
    }
    return new Promise((resolve) => {
      this._postNotificationsDialog = document.createElement(
        "post-notifications-dialog",
      );
      this._postNotificationsDialog.profile = profile;
      this._postNotificationsDialog.activitySubscription =
        profile.viewer?.activitySubscription ?? null;

      this._postNotificationsDialog.addEventListener(
        "save-subscription",
        async (event) => {
          const { activitySubscription, successCallback, errorCallback } =
            event.detail;
          try {
            hapticsImpactMedium();
            const promise =
              this.dataLayer.mutations.updatePostNotificationSubscription(
                profile,
                activitySubscription,
              );
            this.renderFunc();
            await promise;
            this.renderFunc();
            const initialSub = profile.viewer?.activitySubscription;
            const wasSubscribed = initialSub?.post || initialSub?.reply;
            if (!activitySubscription.post && !activitySubscription.reply) {
              showToast(
                `You will no longer receive notifications for @${profile.handle}`,
              );
            } else if (!wasSubscribed) {
              showToast(
                `You'll start receiving notifications for @${profile.handle}!`,
              );
            } else {
              showToast("Changes saved");
            }
            successCallback();
            resolve();
          } catch (error) {
            console.error(error);
            showToast("Failed to save notification preferences", {
              error: true,
            });
            errorCallback(error.message || "An unexpected error occurred.");
            this.renderFunc();
          }
        },
      );

      this._postNotificationsDialog.addEventListener("dialog-closed", () => {
        if (this._postNotificationsDialog) {
          this._postNotificationsDialog.remove();
          this._postNotificationsDialog = null;
        }
        resolve();
      });

      document.body.appendChild(this._postNotificationsDialog);
      this._postNotificationsDialog.open();
    });
  }

  async handleReport(profile) {
    try {
      await this.reportService.openReportDialog({
        subject: profile,
        subjectType: "account",
      });
    } catch (error) {
      console.error(error);
    }
  }
}
