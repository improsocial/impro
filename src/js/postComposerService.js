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
        const { post, draft, successCallback, errorCallback } = e.detail;
        try {
          const res = await this.dataLayer.mutations.createPost(post);
          showToast(
            html`<div class="toast-with-link">
              ${post.replyTo ? "Your reply was sent" : "Your post was sent"}<a
                href="${linkToPostFromUri(res.uri)}"
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
          console.error(error);
          showToast("Failed to send post", { style: "error" });
          errorCallback(error);
          reject(error);
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
