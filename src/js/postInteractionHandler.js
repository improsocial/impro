import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { confirm } from "/js/modals.js";
import { trashCanIconTemplate } from "/js/templates/icons/trashCanIcon.template.js";
import { EventEmitter } from "/js/eventEmitter.js";

export class PostInteractionHandler extends EventEmitter {
  constructor(dataLayer, postComposerService, reportService) {
    super();
    this.dataLayer = dataLayer;
    this.postComposerService = postComposerService;
    this.reportService = reportService;
  }

  renderFunc() {
    this.emit("requestRender");
  }

  async handleLike(post, doLike) {
    if (doLike) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.addLike(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
      } catch (error) {
        console.error(error);
        showToast("Failed to like post", { style: "error" });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.removeLike(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
      } catch (error) {
        console.error(error);
        showToast("Failed to unlike post", { style: "error" });
        this.renderFunc();
      }
    }
  }

  async handleRepost(post, doRepost) {
    if (doRepost) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.createRepost(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
      } catch (error) {
        console.error(error);
        showToast("Failed to repost post", { style: "error" });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.deleteRepost(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
      } catch (error) {
        console.error(error);
        showToast("Failed to delete repost", { style: "error" });
        this.renderFunc();
      }
    }
  }

  async handleBookmark(post, doBookmark) {
    if (doBookmark) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.addBookmark(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Post saved", { style: "success" });
      } catch (error) {
        console.error(error);
        showToast("Failed to bookmark post", { style: "error" });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.removeBookmark(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Removed from saved posts", {
          iconTemplate: trashCanIconTemplate,
        });
      } catch (error) {
        console.error(error);
        showToast("Failed to remove bookmark", { style: "error" });
        this.renderFunc();
      }
    }
  }

  async handleDeletePost(post) {
    if (
      !(await confirm(
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
    this.renderFunc();
  }

  async handlePinPost(post, doPin) {
    if (doPin) {
      try {
        hapticsImpactMedium();
        const promise = this.dataLayer.mutations.pinPost(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Post pinned to your profile", { style: "success" });
      } catch (error) {
        console.error(error);
        showToast("Failed to pin post", { style: "error" });
        this.renderFunc();
      }
    } else {
      try {
        const promise = this.dataLayer.mutations.unpinPost(post);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Post unpinned");
      } catch (error) {
        console.error(error);
        showToast("Failed to unpin post", { style: "error" });
        this.renderFunc();
      }
    }
  }

  async handleHidePost(post) {
    if (
      !(await confirm("This post will be hidden from feeds and threads.", {
        title: "Hide this post?",
        confirmButtonText: "Hide",
      }))
    ) {
      return;
    }
    try {
      const promise = this.dataLayer.mutations.hidePost(post);
      // Render optimistic update
      this.renderFunc();
      await promise;
      // Render final update
      this.renderFunc();
      showToast("Post hidden");
    } catch (error) {
      console.error(error);
      showToast("Failed to hide post", { style: "error" });
      this.renderFunc();
    }
  }

  async handleMuteAuthor(profile, doMute) {
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
        showToast("Failed to mute account", { style: "error" });
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
        showToast("Failed to unmute account", { style: "error" });
        this.renderFunc();
      }
    }
  }

  async handleBlockAuthor(profile, doBlock) {
    if (doBlock) {
      const confirmed = await confirm(
        "Blocked accounts cannot reply in your threads, mention you, or otherwise interact with you.",
        {
          title: "Block Account?",
          confirmButtonText: "Block",
          confirmButtonStyle: "danger",
        },
      );
      if (!confirmed) return;
      try {
        const promise = this.dataLayer.mutations.blockProfile(profile);
        // Render optimistic update
        this.renderFunc();
        await promise;
        // Render final update
        this.renderFunc();
        showToast("Account blocked");
      } catch (error) {
        console.error(error);
        showToast("Failed to block account", { style: "error" });
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
        showToast("Failed to unblock account", { style: "error" });
        this.renderFunc();
      }
    }
  }

  async handleQuotePost(post) {
    const currentUser = this.dataLayer.selectors.getCurrentUser();
    if (!currentUser) {
      console.warn("No current user");
      return;
    }
    try {
      await this.postComposerService.composePost({
        currentUser,
        quotedPost: post,
      });
      this.renderFunc();
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
