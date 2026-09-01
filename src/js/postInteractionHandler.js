import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { html } from "/js/lib/lit-html.js";
import { buildPostgateEmbeddingRules } from "/js/dataHelpers.js";
import "/js/components/post-interaction-settings-dialog.js";
import "/js/components/app-icon.js";

export class PostInteractionHandler {
  constructor(dataLayer, postComposerService, reportService) {
    this.dataLayer = dataLayer;
    this.postComposerService = postComposerService;
    this.reportService = reportService;
    this._interactionSettingsDialog = null;
  }

  handleEditInteractionSettings(post) {
    if (this._interactionSettingsDialog !== null) {
      return;
    }
    const dialog = document.createElement("post-interaction-settings-dialog");
    this._interactionSettingsDialog = dialog;
    dialog.dataLayer = this.dataLayer;
    dialog.threadgateAllow = post.threadgate?.record?.allow ?? null;
    dialog.postgateEmbeddingRules = buildPostgateEmbeddingRules(
      !post.viewer?.embeddingDisabled,
    );
    dialog.hydratedLists = post.threadgate?.lists ?? [];
    dialog.addEventListener("save-interaction-settings", async (event) => {
      const {
        threadgateAllow,
        threadgateDirty,
        postgateEmbeddingRules,
        postgateDirty,
        successCallback,
        errorCallback,
      } = event.detail;
      try {
        const writes = [];
        if (threadgateDirty) {
          writes.push(
            this.dataLayer.mutations.updateThreadgateAllow(
              post,
              threadgateAllow,
            ),
          );
        }
        if (postgateDirty) {
          writes.push(
            this.dataLayer.mutations.updatePostgateEmbeddingRules(
              post,
              postgateEmbeddingRules,
            ),
          );
        }
        await Promise.all(writes);
        successCallback();
      } catch (error) {
        console.error(error);
        showToast("Failed to update interaction settings", {
          style: "error",
        });
        errorCallback(error.message || "An unexpected error occurred.");
      }
    });
    dialog.addEventListener("dialog-closed", () => {
      dialog.remove();
      this._interactionSettingsDialog = null;
    });
    document.body.appendChild(dialog);
    dialog.open();
  }

  async handleLike(post, doLike) {
    if (doLike) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.addLike(post);
      } catch (error) {
        console.error(error);
        showToast("Failed to like post", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.removeLike(post);
      } catch (error) {
        console.error(error);
        showToast("Failed to unlike post", { style: "error" });
      }
    }
  }

  async handleRepost(post, doRepost) {
    if (doRepost) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.createRepost(post);
      } catch (error) {
        console.error(error);
        showToast("Failed to repost post", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.deleteRepost(post);
      } catch (error) {
        console.error(error);
        showToast("Failed to delete repost", { style: "error" });
      }
    }
  }

  async handleBookmark(post, doBookmark) {
    if (doBookmark) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.addBookmark(post);
        showToast("Post saved", { style: "success" });
      } catch (error) {
        console.error(error);
        showToast("Failed to bookmark post", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.removeBookmark(post);
        showToast("Removed from saved posts", {
          iconTemplate: () =>
            html`<app-icon icon="delete-bin-line"></app-icon>`,
        });
      } catch (error) {
        console.error(error);
        showToast("Failed to remove bookmark", { style: "error" });
      }
    }
  }

  async handleDeletePost(post) {
    if (
      !(await confirmModal(
        "If you remove this post, you won't be able to recover it.",
        {
          title: "Delete this post?",
          confirmButtonStyle: "danger",
          confirmButtonText: "Delete",
        },
      ))
    ) {
      return;
    }
    try {
      await this.dataLayer.mutations.deletePost(post);
      showToast("Post deleted");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete post", { style: "error" });
    }
  }

  async handlePinPost(post, doPin) {
    if (doPin) {
      try {
        hapticsImpactMedium();
        await this.dataLayer.mutations.pinPost(post);
        showToast("Post pinned to your profile", { style: "success" });
      } catch (error) {
        console.error(error);
        showToast("Failed to pin post", { style: "error" });
      }
    } else {
      try {
        await this.dataLayer.mutations.unpinPost(post);
        showToast("Post unpinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to unpin post", { style: "error" });
      }
    }
  }

  async handleHidePost(post) {
    if (
      !(await confirmModal("This post will be hidden from feeds and threads.", {
        title: "Hide this post?",
        confirmButtonText: "Hide",
      }))
    ) {
      return;
    }
    try {
      await this.dataLayer.mutations.hidePost(post);
      showToast("Post hidden");
    } catch (error) {
      console.error(error);
      showToast("Failed to hide post", { style: "error" });
    }
  }

  async handleMuteAuthor(profile, doMute) {
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

  async handleBlockAuthor(profile, doBlock) {
    if (doBlock) {
      const confirmed = await confirmModal(
        "Blocked accounts cannot reply in your threads, mention you, or otherwise interact with you.",
        {
          title: "Block Account?",
          confirmButtonText: "Block",
          confirmButtonStyle: "danger",
        },
      );
      if (!confirmed) return false;
      try {
        await this.dataLayer.mutations.blockProfile(profile);
        showToast("Account blocked");
        return true;
      } catch (error) {
        console.error(error);
        showToast("Failed to block account", { style: "error" });
        return false;
      }
    } else {
      try {
        await this.dataLayer.mutations.unblockProfile(profile);
        showToast("Account unblocked");
        return true;
      } catch (error) {
        console.error(error);
        showToast("Failed to unblock account", { style: "error" });
        return false;
      }
    }
  }

  async handleQuotePost(post) {
    const currentUser = this.dataLayer.derived.$currentUser.get();
    if (!currentUser) {
      console.warn("No current user");
      return;
    }
    try {
      await this.postComposerService.composePost({
        currentUser,
        quotedPost: post,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async handleReport(post) {
    try {
      await this.reportService.openReportDialog({
        subject: post,
        subjectType: "post",
      });
    } catch (error) {
      console.error(error);
    }
  }
}
