import "/js/components/post-composer.js";
import { showToast } from "/js/toasts.js";
import { html } from "/js/lib/lit-html.js";
import { linkToPostFromUri } from "/js/navigation.js";
import { hapticsImpactLight } from "/js/haptics.js";

export class PostComposerService {
  constructor(dataLayer, identityResolver, pluginService) {
    this.dataLayer = dataLayer;
    this.identityResolver = identityResolver;
    this.pluginService = pluginService;
    this.currentPostComposer = null;
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
    const composerInit = await this.pluginService.getPostComposerInit({
      kind: replyTo ? "reply" : quotedPost ? "quote" : "post",
      replyTo,
      replyRoot,
      quotedPost,
    });
    return new Promise((resolve, reject) => {
      this.currentPostComposer = document.createElement("post-composer");
      this.currentPostComposer.dataLayer = this.dataLayer;
      this.currentPostComposer.identityResolver = this.identityResolver;
      this.currentPostComposer.replyTo = replyTo;
      this.currentPostComposer.replyRoot = replyRoot;
      this.currentPostComposer.quotedPost = quotedPost;
      this.currentPostComposer.currentUser = currentUser;
      if (composerInit) {
        this.currentPostComposer.initialText = composerInit.text;
        this.currentPostComposer.initialCursor = composerInit.cursor;
      }
      this.currentPostComposer.addEventListener("send-post", async (e) => {
        const {
          postText,
          external,
          replyTo,
          replyRoot,
          quotedPost,
          images,
          video,
          successCallback,
          errorCallback,
        } = e.detail;
        try {
          const result = await this.onSend({
            postText,
            external,
            replyTo,
            replyRoot,
            quotedPost,
            images,
            video,
          });
          successCallback(result);
          resolve(result);
        } catch (error) {
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
      this.currentPostComposer.open();
    });
  }

  async onSend({
    postText,
    external,
    replyTo,
    replyRoot,
    quotedPost,
    images,
    video,
  }) {
    try {
      const res = await this.dataLayer.mutations.createPost({
        postText,
        external,
        replyTo,
        replyRoot,
        quotedPost,
        images,
        video,
      });
      showToast(
        html`<div class="toast-with-link">
          ${replyTo ? "Your reply was sent" : "Your post was sent"}<a
            href="${linkToPostFromUri(res.uri)}"
            >View</a
          >
        </div>`,
        { style: "success" },
      );
      return res;
    } catch (error) {
      console.error(error);
      showToast("Failed to send post", { style: "error" });
      throw error;
    }
  }
}
