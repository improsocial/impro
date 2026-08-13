import "/js/components/post-composer.js";
import { createEmbedFromPost } from "/js/dataHelpers.js";
import { showToast } from "/js/toasts.js";
import { html } from "/js/lib/lit-html.js";
import { linkToPostFromUri } from "/js/navigation.js";
import { hapticsImpactLight } from "/js/haptics.js";

export class PostComposerService {
  constructor(dataLayer, identityResolver, pluginService, { draftsEnabled }) {
    this.dataLayer = dataLayer;
    this.identityResolver = identityResolver;
    this.pluginService = pluginService;
    this.currentPostComposer = null;
    this.draftsEnabled = draftsEnabled;
  }

  async composePost({
    currentUser,
    replyTo = null,
    replyRoot = null,
    quotedPost = null,
  }) {
    if (!currentUser) {
      console.warn("No current user");
      return;
    }
    if (this.currentPostComposer !== null) {
      console.warn("Post composer already open");
      return;
    }
    hapticsImpactLight();
    return new Promise((resolve, reject) => {
      this.currentPostComposer = document.createElement("post-composer");
      this.currentPostComposer.dataLayer = this.dataLayer;
      this.currentPostComposer.identityResolver = this.identityResolver;
      this.currentPostComposer.pluginService = this.pluginService;
      this.currentPostComposer.replyTo = replyTo;
      this.currentPostComposer.replyRoot = replyRoot;
      this.currentPostComposer.quotedRecord = quotedPost
        ? createEmbedFromPost(quotedPost)
        : null;
      this.currentPostComposer.currentUser = currentUser;
      this.currentPostComposer.draftsEnabled = this.draftsEnabled;
      this.currentPostComposer.addEventListener("send-post", async (e) => {
        const {
          posts,
          replyTo: sendReplyTo,
          replyRoot: sendReplyRoot,
          threadgateAllow,
          postgateEmbeddingRules,
          draft,
          signal,
          successCallback,
          errorCallback,
          settledCallback,
        } = e.detail;
        try {
          const res = await this.dataLayer.mutations.createThread({
            posts,
            replyTo: sendReplyTo,
            replyRoot: sendReplyRoot,
            threadgateAllow,
            postgateEmbeddingRules,
            signal,
          });
          let toastMessage = "Your post was sent";
          if (posts.length > 1) {
            toastMessage = "Your posts were sent";
          } else if (sendReplyTo) {
            toastMessage = "Your reply was sent";
          }
          showToast(
            html`<div class="toast-with-link">
              ${toastMessage}<a href="${linkToPostFromUri(res.uris[0])}"
                >View</a
              >
            </div>`,
            { style: "success" },
          );
          // Publishing a saved/restored draft consumes it
          if (draft) {
            this.dataLayer.mutations.deleteDraft(draft).catch((error) => {
              console.error("Failed to clean up published draft", error);
            });
          }
          successCallback(res);
          resolve(res);
        } catch (error) {
          if (error.name === "AbortError") {
            // If aborted via signal, don't call successCallback or errorCallback
            return;
          }
          console.error(error);
          errorCallback(error);
          reject(error);
        } finally {
          settledCallback();
        }
      });
      //  Destroy on close
      this.currentPostComposer.addEventListener("post-composer-closed", () => {
        if (this.currentPostComposer) {
          this.currentPostComposer.remove();
          this.currentPostComposer = null;
        }
      });
      document.body.appendChild(this.currentPostComposer);
      // Open (and focus) synchronously: iOS Safari only honors programmatic
      // focus while still inside the user-gesture handler, so the composer
      // can't wait on plugin init before opening
      this.currentPostComposer.open();
      const composer = this.currentPostComposer;
      this.pluginService
        .getPostComposerInit({
          kind: replyTo ? "reply" : quotedPost ? "quote" : "post",
          replyTo,
          replyRoot,
          quotedPost,
        })
        .then((composerInit) => {
          if (composerInit && this.currentPostComposer === composer) {
            composer.applyComposerInit(composerInit);
          }
        })
        .catch((error) => {
          console.error("Failed to get post composer init", error);
        });
    });
  }
}
