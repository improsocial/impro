import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import {
  classnames,
  enableDragToDismiss,
  graphemeCount,
  resetScrollOnBlur,
  sanitizeUri,
} from "/js/utils.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { confirm } from "/js/modals.js";
import { ScrollLock } from "/js/scrollLock.js";
import { imageIconTemplate } from "/js/templates/icons/imageIcon.template.js";
import { showToast } from "/js/toasts.js";
import {
  validateVideoFile,
  readVideoMetadata,
  VideoUploader,
  VideoValidationError,
} from "/js/videoUtils.js";
import { IN_APP_LINK_DOMAINS, LINK_CARD_SERVICE_URL } from "/js/config.js";
import { quotedPostTemplate } from "/js/templates/postEmbed.template.js";
import { createEmbedFromPost } from "/js/dataHelpers.js";
import "/js/components/rich-text-input.js";
import "/js/components/image-alt-text-dialog.js";

// e.g. https://bsky.app/profile/gracekind.net/post/3m63ewg5nws23
const QUOTE_POST_PATHNAME_PATTERN =
  /^\/profile\/[a-zA-Z0-9.-]+\/post\/[a-zA-Z0-9.-]+$/;

function isQuotePostLink(url) {
  try {
    const parsedUrl = new URL(url);
    return (
      IN_APP_LINK_DOMAINS.includes(parsedUrl.hostname) &&
      QUOTE_POST_PATHNAME_PATTERN.test(parsedUrl.pathname)
    );
  } catch (error) {
    return false;
  }
}

function replyToTemplate({ post }) {
  return html`
    <div class="reply-to">
      <div class="post-content-with-space">
        <div class="post-content-left">
          <div>
            ${avatarTemplate({ author: post.author, clickAction: "none" })}
          </div>
        </div>
        <div class="post-content-right">
          ${postHeaderTextTemplate({
            author: post.author,
            timestamp: post.indexedAt,
            includeHandle: false,
            includeTime: false,
          })}
          <div class="post-body">
            ${post.record.text
              ? html`<div class="post-text">
                  ${richTextTemplate({
                    text: post.record.text,
                    facets: post.record.facets,
                  })}
                </div>`
              : ""}
          </div>
        </div>
      </div>
      <hr style="margin-top: 18px;" />
    </div>
  `;
}

function externalLinkEmbedPreviewTemplate({ data, onClose }) {
  return html`
    <div class="post-composer-embed-preview">
      <button
        class="embed-preview-close-button"
        @click=${(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      >
        <span>×</span>
      </button>
      ${externalLinkTemplate({
        url: data.url,
        title: data.title,
        description: data.description,
        image: data.image,
        showCloseButton: true,
        disableNavigation: true,
        onClose,
      })}
    </div>
  `;
}

function videoPreviewTemplate({ video, onRemove, onEditAltText }) {
  const isReady = video.status === "done";
  const isError = video.status === "error";
  let progressLabel = "";
  if (video.status === "uploading") {
    progressLabel = "Uploading...";
  } else if (video.status === "processing") {
    progressLabel =
      video.progress > 0 ? `Processing... ${video.progress}%` : "Processing...";
  } else if (isError) {
    progressLabel = video.error || "Upload failed";
  }
  return html`
    <div class="post-composer-video-preview">
      <div class="video-preview-item">
        <video src="${video.previewUrl}" controls playsinline></video>
        <button
          class="image-preview-remove-button"
          @click=${(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <span>×</span>
        </button>
        ${!isReady
          ? html`<div class="video-preview-overlay">
              ${!isError ? html`<div class="loading-spinner"></div>` : ""}
              <span>${progressLabel}</span>
            </div>`
          : ""}
        <button
          class="alt-indicator ${video.alt ? "has-alt" : "no-alt"}"
          @click=${(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditAltText();
          }}
        >
          ${video.alt ? "✓ ALT" : "+ ALT"}
        </button>
      </div>
    </div>
  `;
}

function imagePreviewTemplate({ images, onRemove, onEditAltText }) {
  return html`
    <div class="post-composer-image-preview">
      ${images.map(
        (img, index) => html`
          <div class="image-preview-item">
            <img
              src="${img.dataUrl}"
              alt="${img.alt || "Preview"}"
              @click=${() => onEditAltText(index)}
              style="cursor: pointer;"
            />
            <button
              class="image-preview-remove-button"
              @click=${(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(index);
              }}
            >
              <span>×</span>
            </button>
            <div class="alt-indicator ${img.alt ? "has-alt" : "no-alt"}">
              ${img.alt ? "✓ ALT" : "+ ALT"}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

class PostComposer extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = new ScrollLock(this);
    this.innerHTML = "";
    this._postText = "";
    this.initialText = this.initialText ?? null;
    this.initialCursor = this.initialCursor ?? null;
    this._isSending = false;
    this._unresolvedFacets = [];
    this._quotedPostUrl = null;
    this._externalLinkUrl = null;
    this._externalLinkEmbedData = null;
    this._rejectedLinkEmbeds = new Set();
    this._selectedImages = [];
    this._selectedVideo = null;
    this.render();
    this.initialized = true;
  }

  render() {
    const promptText = this.replyTo ? "Write your reply" : "What's up?";
    const currentCharCount = graphemeCount(this._postText);
    const charCountPercentage = Math.min(
      Math.round((currentCharCount / 300) * 100),
      100,
    );
    const isAboveCharLimit = currentCharCount > 300;
    const isVideoUploading =
      this._selectedVideo &&
      (this._selectedVideo.status === "uploading" ||
        this._selectedVideo.status === "processing");
    const hasVideo = !!this._selectedVideo;
    render(
      html`
        <dialog
          class="post-composer"
          @click=${async (e) => {
            if (e.target.tagName === "DIALOG") {
              if (await this.confirmClose()) {
                this.close();
              }
            }
          }}
          @cancel=${async () => {
            if (await this.confirmClose()) {
              this.close();
            }
          }}
          @keydown=${(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (
                !this._isSending &&
                !isAboveCharLimit &&
                !isVideoUploading &&
                this._postText.length > 0
              ) {
                this.send();
              }
            }
          }}
        >
          <div class="post-composer-content">
            <div class="post-composer-top-bar">
              <button
                class="post-composer-cancel-button"
                @click=${async () => {
                  if (await this.confirmClose()) {
                    this.close();
                  }
                }}
              >
                Cancel
              </button>
              <button
                class="rounded-button rounded-button-primary"
                @click=${() => this.send()}
                .disabled=${this._isSending ||
                isAboveCharLimit ||
                isVideoUploading}
              >
                ${this._isSending
                  ? html`Sending... <span>&nbsp;&nbsp;</span>
                      <div class="loading-spinner"></div>`
                  : html`<span>${this.replyTo ? "Reply" : "Post"}</span>`}
              </button>
            </div>
            <div class="post-composer-scroll-area">
              <div class="post-composer-scroll-area-content">
                ${this.replyTo ? replyToTemplate({ post: this.replyTo }) : ""}
                <div class="post-composer-body">
                  <div class="post-composer-body-left">
                    ${avatarTemplate({
                      author: this.currentUser,
                      clickAction: "none",
                    })}
                  </div>
                  <div class="post-composer-body-right">
                    <rich-text-input
                      @input=${(e) => {
                        this.handleInput(e);
                      }}
                      @paste=${(e) => {
                        this.handlePaste(e);
                      }}
                      placeholder="${promptText}"
                    ></rich-text-input>
                  </div>
                </div>
                ${this._externalLinkEmbedData
                  ? externalLinkEmbedPreviewTemplate({
                      data: this._externalLinkEmbedData,
                      onClose: () => {
                        this.handleExternalLinkEmbedPreviewClose();
                      },
                    })
                  : ""}
                ${this._selectedImages.length > 0
                  ? imagePreviewTemplate({
                      images: this._selectedImages,
                      onRemove: (index) => this.handleRemoveImage(index),
                      onEditAltText: (index) => this.handleEditAltText(index),
                    })
                  : ""}
                ${this._selectedVideo
                  ? videoPreviewTemplate({
                      video: this._selectedVideo,
                      onRemove: () => this.handleRemoveVideo(),
                      onEditAltText: () => this.handleEditVideoAltText(),
                    })
                  : ""}
                ${this.quotedPost
                  ? html`<div class="post-composer-embed-preview">
                      <button
                        class="embed-preview-close-button"
                        @click=${() => {
                          this.handleQuotedPostEmbedPreviewClose();
                        }}
                      >
                        <span>×</span>
                      </button>
                      <div inert>
                        ${quotedPostTemplate({
                          quotedPost: createEmbedFromPost(this.quotedPost),
                          isAuthenticated: true,
                        })}
                      </div>
                    </div>`
                  : ""}
              </div>
              <div class="post-composer-bottom-bar">
                <div class="post-composer-bottom-bar-left">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    class="media-picker-input"
                    multiple
                    style="display: none;"
                    @change=${(e) => this.handleMediaSelect(e)}
                    @cancel=${(e) => {
                      e.stopPropagation();
                    }}
                  />
                  <button
                    class="image-picker-button"
                    @click=${() => this.handleMediaButtonClick()}
                    .disabled=${hasVideo || this._selectedImages.length >= 4}
                  >
                    ${imageIconTemplate()}
                  </button>
                </div>
                <div
                  class=${classnames("word-count", {
                    overflow: isAboveCharLimit,
                  })}
                >
                  <span class="word-count-text">${300 - currentCharCount}</span>
                  <div class="word-count-indicator">
                    <div
                      class="word-count-indicator-bar"
                      style="height: ${charCountPercentage}%"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  handleExternalLinkEmbedPreviewClose() {
    this._rejectedLinkEmbeds.add(this._externalLinkUrl);
    this._externalLinkUrl = null;
    this._externalLinkEmbedData = null;
    this.render();
  }

  handleQuotedPostEmbedPreviewClose() {
    this._quotedPostUrl = null;
    this.quotedPost = null;
    this.render();
  }

  async loadQuotedPostFromLink() {
    try {
      const parsedUrl = new URL(this._quotedPostUrl);
      const didOrHandle = parsedUrl.pathname.split("/")[2];
      const did = didOrHandle.startsWith("did:")
        ? didOrHandle
        : await this.identityResolver.resolveHandle(didOrHandle);
      const rkey = parsedUrl.pathname.split("/")[4];
      const postUri = `at://${did}/app.bsky.feed.post/${rkey}`;
      this.quotedPost = await this.dataLayer.declarative.ensurePost(postUri);
      this.render();
    } catch (error) {
      console.error("Error loading quoted post from link: ", error);
      this._quotedPostUrl = null;
      this._rejectedLinkEmbeds.add(this._quotedPostUrl);
      return;
    }
  }

  handleMediaButtonClick() {
    const input = this.querySelector(".media-picker-input");
    if (input) {
      input.click();
    }
  }

  async handleMediaSelect(e) {
    const files = Array.from(e.target.files);
    e.target.value = "";
    await this.addMediaFiles(files);
  }

  async addMediaFiles(files) {
    if (files.length === 0) return;

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));

    if (imageFiles.length + videoFiles.length < files.length) {
      showToast("Unsupported file type", { style: "warning" });
      return;
    }

    if (imageFiles.length > 0 && videoFiles.length > 0) {
      showToast("Selecting multiple media types is not supported", {
        style: "warning",
      });
      return;
    }

    if (videoFiles.length > 0) {
      if (this._selectedImages.length > 0) {
        showToast("Selecting multiple media types is not supported", {
          style: "warning",
        });
        return;
      }
      if (videoFiles.length > 1) {
        showToast("You can only select one video at a time", {
          style: "warning",
        });
      }
      await this.processVideoFile(videoFiles[0]);
      return;
    }

    if (imageFiles.length > 0) {
      if (this._selectedVideo) {
        showToast("Selecting multiple media types is not supported", {
          style: "warning",
        });
        return;
      }
      await this.addImageFiles(imageFiles);
    }
  }

  async addImageFiles(files) {
    const maxImages = 4;
    const remainingSlots = maxImages - this._selectedImages.length;

    if (files.length > remainingSlots) {
      showToast("You can select up to 4 images in total", { style: "warning" });
    }

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      const dataUrl = await this.readFileAsDataUrl(file);
      this._selectedImages.push({
        file,
        dataUrl,
      });
    }

    // Reject external link embed if images are added
    if (this._selectedImages.length > 0 && this._externalLinkUrl) {
      this._rejectedLinkEmbeds.add(this._externalLinkUrl);
      this._externalLinkUrl = null;
      this._externalLinkEmbedData = null;
    }

    this.render();
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  handleRemoveImage(index) {
    this._selectedImages.splice(index, 1);
    this.render();
  }

  handleEditAltText(index) {
    const image = this._selectedImages[index];
    const dialog = document.createElement("image-alt-text-dialog");
    dialog.imageUrl = image.dataUrl;
    dialog.value = image.alt || "";

    dialog.addEventListener("alt-text-saved", (e) => {
      this._selectedImages[index].alt = e.detail.altText;
      this.render();
      dialog.remove();
    });

    dialog.addEventListener("alt-text-dialog-closed", () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.open();
  }

  async processVideoFile(file) {
    try {
      validateVideoFile(file);
    } catch (error) {
      const msg =
        error instanceof VideoValidationError
          ? error.message
          : "Could not load video";
      showToast(msg, { style: "warning" });
      return;
    }
    let metadata;
    try {
      metadata = await readVideoMetadata(file);
    } catch (error) {
      const msg =
        error instanceof VideoValidationError
          ? error.message
          : "Could not load video";
      showToast(msg, { style: "warning" });
      return;
    }
    this._selectedVideo = {
      file,
      previewUrl: URL.createObjectURL(file),
      alt: "",
      aspectRatio: metadata.aspectRatio,
      status: "uploading",
      progress: 0,
      jobId: null,
      blob: null,
      error: null,
    };
    this.render();
    this.uploadSelectedVideo();
  }

  async uploadSelectedVideo() {
    const video = this._selectedVideo;
    if (!video) return;
    try {
      const uploader = new VideoUploader(this.dataLayer.api);
      const blob = await uploader.upload(video.file, {
        onJobStart: (job) => {
          if (this._selectedVideo !== video) return;
          this._selectedVideo.jobId = job.jobId;
          this._selectedVideo.status = "processing";
          this.render();
        },
        onProgress: (_state, progress) => {
          if (this._selectedVideo !== video) return;
          this._selectedVideo.progress = progress;
          this.render();
        },
      });
      if (this._selectedVideo !== video) return;
      this._selectedVideo.blob = blob;
      this._selectedVideo.status = "done";
      this.render();
    } catch (error) {
      console.error("Video upload error: ", error);
      if (this._selectedVideo !== video) return;
      this._selectedVideo.status = "error";
      this._selectedVideo.error = error.message || "Upload failed";
      this.render();
      showToast(this._selectedVideo.error, { style: "error" });
    }
  }

  handleRemoveVideo() {
    if (this._selectedVideo?.previewUrl) {
      URL.revokeObjectURL(this._selectedVideo.previewUrl);
    }
    this._selectedVideo = null;
    this.render();
  }

  handleEditVideoAltText() {
    const video = this._selectedVideo;
    if (!video) return;
    const dialog = document.createElement("image-alt-text-dialog");
    dialog.value = video.alt || "";

    dialog.addEventListener("alt-text-saved", (e) => {
      if (this._selectedVideo === video) {
        this._selectedVideo.alt = e.detail.altText;
        this.render();
      }
      dialog.remove();
    });

    dialog.addEventListener("alt-text-dialog-closed", () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.open();
  }

  handleInput(e) {
    const previousFacets = this._unresolvedFacets;
    this._postText = e.detail.text;
    this._unresolvedFacets = e.detail.facets;
    // If the facets *haven't* changed, and the latest change was a space or newline, check for possible link embeds
    if (
      JSON.stringify(previousFacets) ===
        JSON.stringify(this._unresolvedFacets) &&
      (e.detail.text.endsWith(" ") || e.detail.text.endsWith("\n"))
    ) {
      for (const facet of this._unresolvedFacets) {
        // Only handle one feature for now
        const feature = facet.features[0];
        if (feature.$type === "app.bsky.richtext.facet#link") {
          const url = feature.uri;
          if (this._externalLinkUrl) {
            // automatically reject links if there's an existing link embed
            this._rejectedLinkEmbeds.add(url);
          } else if (!this._rejectedLinkEmbeds.has(url)) {
            if (isQuotePostLink(url)) {
              if (!this.quotedPost) {
                this._quotedPostUrl = url;
                this.loadQuotedPostFromLink();
              }
            } else {
              this._externalLinkUrl = url;
              this.loadExternalLinkEmbedPreview();
            }
          }
        }
      }
    }
    // If the facets have changed, check to see if links have been removed.
    // This will allow links to be re-added after being rejected.
    if (
      JSON.stringify(previousFacets) !== JSON.stringify(this._unresolvedFacets)
    ) {
      const linkFacetUrls = this._unresolvedFacets
        .filter(
          (facet) => facet.features[0].$type === "app.bsky.richtext.facet#link",
        )
        .map((facet) => facet.features[0].uri);
      for (const rejectedLinkEmbed of this._rejectedLinkEmbeds) {
        if (!linkFacetUrls.includes(rejectedLinkEmbed)) {
          this._rejectedLinkEmbeds.delete(rejectedLinkEmbed);
        }
      }
    }
    this.render();
  }

  handlePaste(e) {
    const pastedFiles = Array.from(e.clipboardData?.files ?? []);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      this.addMediaFiles(pastedFiles);
      return;
    }
    // Unlike external links, add quote posts immediately if a link is pasted
    // Wait a tick so handleInput runs first
    requestAnimationFrame(() => {
      if (this.quotedPost || this._quotedPostUrl) return;
      for (const facet of this._unresolvedFacets) {
        const feature = facet.features[0];
        if (feature.$type === "app.bsky.richtext.facet#link") {
          const url = feature.uri;
          if (isQuotePostLink(url) && !this._rejectedLinkEmbeds.has(url)) {
            this._quotedPostUrl = url;
            this.loadQuotedPostFromLink();
            break;
          }
        }
      }
    });
  }

  async loadExternalLinkEmbedPreview() {
    const url = this._externalLinkUrl;
    // preliminary data
    this._externalLinkEmbedData = {
      url,
      title: url,
      description: "",
      image: "",
    };
    this.render();
    let res = null;
    try {
      res = await fetch(`${LINK_CARD_SERVICE_URL}/v1/extract?url=${url}`);
    } catch (error) {
      console.error("Error loading external link embed preview: ", error);
      return;
    }
    if (res && res.ok) {
      const data = await res.json();
      // preview may have been closed while metadata was loading
      if (!this._externalLinkEmbedData) return;
      if (data.title) {
        this._externalLinkEmbedData.title = data.title;
      }
      if (data.description) {
        this._externalLinkEmbedData.description = data.description;
      }
      this.render();
      if (data.image) {
        // only show image if it can be loaded
        let imageRes = null;
        try {
          imageRes = await fetch(sanitizeUri(data.image));
        } catch (error) {}
        // preview may have been closed while the image was loading
        if (imageRes && imageRes.ok && this._externalLinkEmbedData) {
          this._externalLinkEmbedData.image = data.image;
          this.render();
        }
      }
    }
  }

  open() {
    this.scrollLock.lock();
    const dialog = this.querySelector(".post-composer");
    dialog.showModal();
    const richTextInput = this.querySelector("rich-text-input");
    if (richTextInput && this.initialText !== null) {
      richTextInput.setText(this.initialText);
    }
    if (richTextInput && this.initialCursor !== null) {
      richTextInput.setCursor(this.initialCursor);
    }

    // Setup mobile swipe-to-dismiss
    enableDragToDismiss(dialog, {
      confirmDismiss: () => this.confirmClose(),
      onClose: () => this.close(),
      scrollContainer: this.querySelector(".post-composer-scroll-area"),
      ignoreTouchTarget: (el) =>
        !!el.closest("button") ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        !!el.closest("[contenteditable]"),
    });

    // focus on the textarea
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const richTextInput = this.querySelector("rich-text-input");
        if (richTextInput) {
          richTextInput.focus();
        }
      });
    });

    resetScrollOnBlur(dialog, this.querySelector(".post-composer-scroll-area"));
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".post-composer");
    dialog.close();
    this.dispatchEvent(new CustomEvent("post-composer-closed"));
  }

  send() {
    this._isSending = true;
    this.render();
    const successCallback = () => {
      this.close();
    };
    const errorCallback = () => {
      this._isSending = false;
      // todo: show error message
      this.render();
    };
    this.dispatchEvent(
      new CustomEvent("send-post", {
        detail: {
          postText: this._postText,
          external: this._externalLinkEmbedData,
          replyTo: this.replyTo,
          replyRoot: this.replyRoot,
          quotedPost: this.quotedPost,
          images: this._selectedImages,
          video: this._selectedVideo,
          successCallback,
          errorCallback,
        },
      }),
    );
  }

  confirmClose() {
    // Todo - check for other unsaved changes
    if (
      this._postText.length === 0 &&
      this._selectedImages.length === 0 &&
      !this._selectedVideo
    ) {
      return true;
    }
    return confirm("Are you sure you'd like to discard this draft?", {
      title: "Discard draft?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Discard",
    });
  }
}

PostComposer.register();
