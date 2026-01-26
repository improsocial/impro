import { hapticsImpactMedium } from "/js/haptics.js";
import { showToast } from "/js/toasts.js";
import { noop } from "/js/utils.js";
import { confirm } from "/js/modals.js";

export class PostInteractionHandler {
  constructor(dataLayer, postComposerService, { renderFunc = noop } = {}) {
    this.dataLayer = dataLayer;
    this.postComposerService = postComposerService;
    this.isAuthenticated = dataLayer.isAuthenticated;
    this.renderFunc = renderFunc;
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
        showToast("Failed to like post", { error: true });
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
        showToast("Failed to unlike post", { error: true });
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
        showToast("Failed to repost post", { error: true });
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
        showToast("Failed to delete repost", { error: true });
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
        showToast("Post saved");
      } catch (error) {
        console.error(error);
        showToast("Failed to bookmark post", { error: true });
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
        showToast("Removed from saved posts");
      } catch (error) {
        console.error(error);
        showToast("Failed to remove bookmark", { error: true });
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
      showToast("Failed to delete post", { error: true });
    }
    this.renderFunc();
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
      showToast("Failed to hide post", { error: true });
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

  async handleBlockAuthor(profile, doBlock) {
    if (doBlock) {
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
}
