import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { getDisplayName } from "/js/dataHelpers.js";
import "/js/components/post-notifications-dialog.js";

export class ProfileInteractionHandler {
  constructor(dataLayer, reportService) {
    this.dataLayer = dataLayer;
    this.reportService = reportService;
    this._postNotificationsDialog = null;
  }

  async handleFollow(profile, doFollow) {
    if (doFollow) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.followProfile(profile);
        showToast(`Following ${getDisplayName(profile)}`);
      } catch (error) {
        console.error(error);
        showToast("Failed to follow account", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unfollowProfile(profile);
        showToast(`No longer following ${getDisplayName(profile)}`);
      } catch (error) {
        console.error(error);
        showToast("Failed to unfollow account", { style: "error" });
      }
    }
  }

  async handleMute(profile, doMute) {
    if (doMute) {
      try {
        await this.dataLayer.mutations.muteProfile(profile);
        showToast("Account muted");
      } catch (error) {
        console.error(error);
        showToast("Failed to mute account", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unmuteProfile(profile);
        showToast("Account unmuted");
      } catch (error) {
        console.error(error);
        showToast("Failed to unmute account", { style: "error" });
      }
    }
  }

  async handleBlock(profile, doBlock) {
    if (doBlock) {
      const confirmed = await confirmModal(
        "Blocked accounts cannot reply in your threads, mention you, or otherwise interact with you.",
        {
          title: "Block Account?",
          confirmButtonText: "Block",
          confirmButtonStyle: "danger",
        },
      );
      if (!confirmed) return;
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.blockProfile(profile);
        showToast("Account blocked");
      } catch (error) {
        console.error(error);
        showToast("Failed to block account", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unblockProfile(profile);
        showToast("Account unblocked");
      } catch (error) {
        console.error(error);
        showToast("Failed to unblock account", { style: "error" });
      }
    }
  }

  async handleAddToList(profile, list) {
    try {
      await this.dataLayer.mutations.addProfileToList(profile, list);
      showToast(`Added to ${list.name}`, { style: "success" });
    } catch (error) {
      console.error(error);
      showToast("Failed to add to list", { style: "error" });
      throw error;
    }
  }

  async handleRemoveFromList(profile, list, membershipUri) {
    try {
      await this.dataLayer.mutations.removeProfileFromList(
        profile,
        list,
        membershipUri,
      );
      showToast(`Removed from ${list.name}`, { style: "success" });
    } catch (error) {
      console.error(error);
      showToast("Failed to remove from list", { style: "error" });
      throw error;
    }
  }

  async handleSubscribe(profile, doSubscribe, labelerInfo) {
    if (doSubscribe) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.subscribeLabeler(profile, labelerInfo);
        showToast("Subscribed to labeler");
      } catch (error) {
        console.error(error);
        showToast("Failed to subscribe to labeler", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unsubscribeLabeler(profile);
        showToast("Unsubscribed from labeler");
      } catch (error) {
        console.error(error);
        showToast("Failed to unsubscribe from labeler", { style: "error" });
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
            await this.dataLayer.mutations.updatePostNotificationSubscription(
              profile,
              activitySubscription,
            );
            const initialSub = profile.viewer?.activitySubscription;
            const wasSubscribed = initialSub?.post || initialSub?.reply;
            if (!activitySubscription.post && !activitySubscription.reply) {
              showToast(
                `You will no longer receive notifications for @${profile.handle}`,
                { style: "success" },
              );
            } else if (!wasSubscribed) {
              showToast(
                `You'll start receiving notifications for @${profile.handle}!`,
                { style: "success" },
              );
            } else {
              showToast("Changes saved", { style: "success" });
            }
            successCallback();
            resolve();
          } catch (error) {
            console.error(error);
            showToast("Failed to save notification preferences", {
              style: "error",
            });
            errorCallback(error.message || "An unexpected error occurred.");
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
