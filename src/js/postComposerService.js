import "/js/components/post-composer.js";
import { resolveFacets } from "/js/facetHelpers.js";
import { showToast } from "/js/toasts.js";
import { html } from "/js/lib/lit-html.js";
import { linkToPostFromUri } from "/js/navigation.js";
import { hapticsImpactLight } from "/js/haptics.js";

export class PostComposerService {
  constructor(dataLayer, identityResolver) {
    this.dataLayer = dataLayer;
    this.identityResolver = identityResolver;
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
    return new Promise((resolve, reject) => {
      this.currentPostComposer = document.createElement("post-composer");
      this.currentPostComposer.dataLayer = this.dataLayer;
      this.currentPostComposer.identityResolver = this.identityResolver;
      this.currentPostComposer.replyTo = replyTo;
      this.currentPostComposer.replyRoot = replyRoot;
      this.currentPostComposer.quotedPost = quotedPost;
      this.currentPostComposer.currentUser = currentUser;
      this.currentPostComposer.addEventListener("send-post", async (e) => {
        const {
          postText,
          unresolvedFacets,
          external,
          replyTo,
          replyRoot,
          quotedPost,
          images,
          successCallback,
          errorCallback,
        } = e.detail;
        try {
          const result = await this.onSend({
            postText,
            unresolvedFacets,
            external,
            replyTo,
            replyRoot,
            quotedPost,
            images,
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
    unresolvedFacets,
    external,
    replyTo,
    replyRoot,
    quotedPost,
    images,
  }) {
    try {
      const facets = await resolveFacets(
        unresolvedFacets,
        this.identityResolver
      );
      const res = await this.dataLayer.mutations.createPost({
        postText,
        facets,
        external,
        replyTo,
        replyRoot,
        quotedPost,
        images,
      });
      showToast(
        html`<div class="toast-with-link">
          ${replyTo ? "Your reply was sent" : "Your post was sent"}<a
            href="${linkToPostFromUri(res.uri)}"
            >View</a
          >
        </div>`
      );
      return res;
    } catch (error) {
      console.error(error);
      showToast("Failed to send post", { error: true });
      throw error;
    }
  }
}
