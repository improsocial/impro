import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import {
  classnames,
  enableDragToDismiss,
  graphemeCount,
  readFileAsDataUrl,
  resetScrollOnBlur,
  sanitizeUri,
} from "/js/utils.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { ScrollLock } from "/js/scrollLock.js";
import { imageIconTemplate } from "/js/templates/icons/imageIcon.template.js";
import { emojiIconTemplate } from "/js/templates/icons/emojiIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { showToast } from "/js/toasts.js";
import {
  validateVideoFile,
  readVideoMetadata,
  VideoUploader,
  VideoValidationError,
} from "/js/videoUtils.js";
import { LINK_CARD_SERVICE_URL } from "/js/config.js";
import { recordEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { parseRecordLink, resolveRecordFromLink } from "/js/embedHelpers.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";
import "/js/components/rich-text-input.js";
import "/js/components/image-alt-text-dialog.js";
import "/js/components/emoji-picker-dialog.js";

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
        ${closeIconTemplate()}
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
          ${closeIconTemplate()}
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
              ${closeIconTemplate()}
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
    this.initialText = this.initialText ?? null;
    this.initialCursor = this.initialCursor ?? null;
    this._unresolvedFacets = [];
    this._quotedRecordUrl = null;
    this._externalLinkUrl = null;
    this._rejectedLinkEmbeds = new Set();
    this._videoToken = null;
    this.state = new ReactiveStore("postComposer");
    this.state.$postText = new Signal.State("");
    this.state.$isSending = new Signal.State(false);
    this.state.$externalLinkEmbedData = new Signal.State(null);
    this.state.$selectedImages = new Signal.State([]);
    this.state.$selectedVideo = new Signal.State(null);
    this.state.$quotedRecord = new Signal.State(
      this._pendingQuotedRecord ?? null,
    );
    this._pendingQuotedRecord = null;
    this._disposers = [
      effect(() => {
        this.render();
      }),
    ];
    this.initialized = true;
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
  }

  get quotedRecord() {
    if (!this.state) return this._pendingQuotedRecord ?? null;
    return untrack(() => this.state.$quotedRecord.get());
  }

  set quotedRecord(value) {
    if (!this.state) {
      this._pendingQuotedRecord = value;
      return;
    }
    this.state.$quotedRecord.set(value);
  }

  render() {
    const promptText = this.replyTo ? "Write your reply" : "What's up?";
    const isSending = this.state.$isSending.get();
    const externalLinkEmbedData = this.state.$externalLinkEmbedData.get();
    const selectedImages = this.state.$selectedImages.get();
    const selectedVideo = this.state.$selectedVideo.get();
    const quotedRecord = this.state.$quotedRecord.get();
    const currentCharCount = graphemeCount(this.state.$postText.get());
    const charCountPercentage = Math.min(
      Math.round((currentCharCount / 300) * 100),
      100,
    );
    const isAboveCharLimit = currentCharCount > 300;
    const isVideoUploading =
      selectedVideo &&
      (selectedVideo.status === "uploading" ||
        selectedVideo.status === "processing");
    const hasVideo = !!selectedVideo;
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
              const postText = untrack(() => this.state.$postText.get());
              if (postText.length > 0) {
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
                data-testid="composer-submit-button"
                data-teststate=${this.replyTo ? "reply" : "post"}
                @click=${() => this.send()}
                .disabled=${isSending || isAboveCharLimit || isVideoUploading}
              >
                ${isSending
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
                ${externalLinkEmbedData
                  ? externalLinkEmbedPreviewTemplate({
                      data: externalLinkEmbedData,
                      onClose: () => {
                        this.handleExternalLinkEmbedPreviewClose();
                      },
                    })
                  : ""}
                ${selectedImages.length > 0
                  ? imagePreviewTemplate({
                      images: selectedImages,
                      onRemove: (index) => this.handleRemoveImage(index),
                      onEditAltText: (index) => this.handleEditAltText(index),
                    })
                  : ""}
                ${selectedVideo
                  ? videoPreviewTemplate({
                      video: selectedVideo,
                      onRemove: () => this.handleRemoveVideo(),
                      onEditAltText: () => this.handleEditVideoAltText(),
                    })
                  : ""}
                ${quotedRecord
                  ? html`<div class="post-composer-embed-preview">
                      <button
                        class="embed-preview-close-button"
                        @click=${() => {
                          this.handleQuotedEmbedPreviewClose();
                        }}
                      >
                        ${closeIconTemplate()}
                      </button>
                      <div inert>
                        ${recordEmbedTemplate({
                          record: quotedRecord,
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
                    .disabled=${hasVideo || selectedImages.length >= 4}
                  >
                    ${imageIconTemplate()}
                  </button>
                  <div class="post-composer-emoji-wrapper">
                    <button
                      type="button"
                      class="post-composer-emoji-button"
                      aria-label="Open emoji picker"
                      @click=${(e) => this.handleEmojiButtonClick(e)}
                    >
                      ${emojiIconTemplate()}
                    </button>
                    <emoji-picker-dialog
                      @select=${(e) => {
                        this.handleEmojiSelect(e.detail.emoji);
                        e.currentTarget.close();
                      }}
                    ></emoji-picker-dialog>
                  </div>
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

  isSendBlocked() {
    const isSending = untrack(() => this.state.$isSending.get());
    const postText = untrack(() => this.state.$postText.get());
    const selectedVideo = untrack(() => this.state.$selectedVideo.get());
    const isVideoUploading =
      !!selectedVideo &&
      (selectedVideo.status === "uploading" ||
        selectedVideo.status === "processing");
    return isSending || graphemeCount(postText) > 300 || isVideoUploading;
  }

  handleEmojiButtonClick(event) {
    const dialog = this.querySelector("emoji-picker-dialog");
    if (!dialog) return;
    if (dialog.isOpen) {
      dialog.close();
      return;
    }
    const selection = window.getSelection();
    const richTextInput = this.querySelector("rich-text-input");
    const editable = richTextInput?.querySelector(".rich-text-input");
    if (
      editable &&
      selection?.rangeCount &&
      editable.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      this._savedEmojiRange = selection.getRangeAt(0).cloneRange();
    } else {
      this._savedEmojiRange = null;
    }
    dialog.open(event.currentTarget);
  }

  handleEmojiSelect(emoji) {
    const richTextInput = this.querySelector("rich-text-input");
    if (!richTextInput) return;
    richTextInput.focus();
    if (this._savedEmojiRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this._savedEmojiRange);
    }
    document.execCommand("insertText", false, emoji);
    this._savedEmojiRange = null;
  }

  handleExternalLinkEmbedPreviewClose() {
    this._rejectedLinkEmbeds.add(this._externalLinkUrl);
    this._externalLinkUrl = null;
    this.state.$externalLinkEmbedData.set(null);
  }

  handleQuotedEmbedPreviewClose() {
    this._quotedRecordUrl = null;
    this.state.$quotedRecord.set(null);
  }

  async loadQuotedRecordFromLink() {
    const url = this._quotedRecordUrl;
    try {
      const record = await resolveRecordFromLink(url, {
        identityResolver: this.identityResolver,
        dataLayer: this.dataLayer,
      });
      // the embed may have been closed or replaced while the record was loading
      if (this._quotedRecordUrl !== url) return;
      this.state.$quotedRecord.set(record);
    } catch (error) {
      console.error("Error loading record embed from link: ", error);
      this._rejectedLinkEmbeds.add(url);
      if (this._quotedRecordUrl === url) {
        this._quotedRecordUrl = null;
      }
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
      const selectedImages = untrack(() => this.state.$selectedImages.get());
      if (selectedImages.length > 0) {
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
      const selectedVideo = untrack(() => this.state.$selectedVideo.get());
      if (selectedVideo) {
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
    const currentImages = untrack(() => this.state.$selectedImages.get());
    const remainingSlots = maxImages - currentImages.length;

    if (files.length > remainingSlots) {
      showToast("You can select up to 4 images in total", { style: "warning" });
    }

    const newImages = [];
    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      const dataUrl = await readFileAsDataUrl(file);
      newImages.push({
        file,
        dataUrl,
      });
    }
    const latestImages = untrack(() => this.state.$selectedImages.get());
    const selectedImages = [...latestImages, ...newImages];
    this.state.$selectedImages.set(selectedImages);

    // Reject external link embed if images are added
    if (selectedImages.length > 0 && this._externalLinkUrl) {
      this._rejectedLinkEmbeds.add(this._externalLinkUrl);
      this._externalLinkUrl = null;
      this.state.$externalLinkEmbedData.set(null);
    }
  }

  handleRemoveImage(index) {
    const selectedImages = untrack(() => this.state.$selectedImages.get());
    this.state.$selectedImages.set(
      selectedImages.filter((image, imageIndex) => imageIndex !== index),
    );
  }

  handleEditAltText(index) {
    const selectedImages = untrack(() => this.state.$selectedImages.get());
    const image = selectedImages[index];
    const dialog = document.createElement("image-alt-text-dialog");
    dialog.imageUrl = image.dataUrl;
    dialog.value = image.alt || "";

    dialog.addEventListener("alt-text-saved", (e) => {
      const latestImages = untrack(() => this.state.$selectedImages.get());
      this.state.$selectedImages.set(
        latestImages.map((selectedImage, imageIndex) =>
          imageIndex === index
            ? { ...selectedImage, alt: e.detail.altText }
            : selectedImage,
        ),
      );
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
    const token = Symbol();
    this._videoToken = token;
    this.state.$selectedVideo.set({
      file,
      previewUrl: URL.createObjectURL(file),
      alt: "",
      aspectRatio: metadata.aspectRatio,
      status: "uploading",
      progress: 0,
      jobId: null,
      blob: null,
      error: null,
    });
    this.uploadSelectedVideo(token);
  }

  // Applies a partial update to the selected video, unless it has been removed
  // or replaced since `token` was issued.
  patchSelectedVideo(token, patch) {
    if (this._videoToken !== token) return null;
    const selectedVideo = untrack(() => this.state.$selectedVideo.get());
    const video = { ...selectedVideo, ...patch };
    this.state.$selectedVideo.set(video);
    return video;
  }

  async uploadSelectedVideo(token) {
    const video = untrack(() => this.state.$selectedVideo.get());
    if (!video) return;
    try {
      const uploader = new VideoUploader(this.dataLayer.api);
      const blob = await uploader.upload(video.file, {
        onJobStart: (job) => {
          this.patchSelectedVideo(token, {
            jobId: job.jobId,
            status: "processing",
          });
        },
        onProgress: (_state, progress) => {
          this.patchSelectedVideo(token, { progress });
        },
      });
      this.patchSelectedVideo(token, { blob, status: "done" });
    } catch (error) {
      console.error("Video upload error: ", error);
      const failedVideo = this.patchSelectedVideo(token, {
        status: "error",
        error: error.message || "Upload failed",
      });
      if (failedVideo) {
        showToast(failedVideo.error, { style: "error" });
      }
    }
  }

  handleRemoveVideo() {
    const video = untrack(() => this.state.$selectedVideo.get());
    if (video?.previewUrl) {
      URL.revokeObjectURL(video.previewUrl);
    }
    this._videoToken = null;
    this.state.$selectedVideo.set(null);
  }

  handleEditVideoAltText() {
    const video = untrack(() => this.state.$selectedVideo.get());
    if (!video) return;
    const token = this._videoToken;
    const dialog = document.createElement("image-alt-text-dialog");
    dialog.value = video.alt || "";

    dialog.addEventListener("alt-text-saved", (e) => {
      this.patchSelectedVideo(token, { alt: e.detail.altText });
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
    this.state.$postText.set(e.detail.text);
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
            if (parseRecordLink(url)) {
              if (!this.quotedRecord && !this._quotedRecordUrl) {
                this._quotedRecordUrl = url;
                this.loadQuotedRecordFromLink();
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
  }

  handlePaste(e) {
    const pastedFiles = Array.from(e.clipboardData?.files ?? []);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      this.addMediaFiles(pastedFiles);
      return;
    }
    // Attach link embeds immediately if a link is pasted
    // Wait a tick so handleInput runs first
    requestAnimationFrame(() => {
      for (const facet of this._unresolvedFacets) {
        const feature = facet.features[0];
        if (feature.$type === "app.bsky.richtext.facet#link") {
          const url = feature.uri;
          if (this._rejectedLinkEmbeds.has(url)) continue;
          if (parseRecordLink(url)) {
            if (!this.quotedRecord && !this._quotedRecordUrl) {
              this._quotedRecordUrl = url;
              this.loadQuotedRecordFromLink();
            }
          } else if (!this._externalLinkUrl) {
            this._externalLinkUrl = url;
            this.loadExternalLinkEmbedPreview();
          }
        }
      }
    });
  }

  async loadExternalLinkEmbedPreview() {
    const url = this._externalLinkUrl;
    // preliminary data
    this.state.$externalLinkEmbedData.set({
      url,
      title: url,
      description: "",
      image: "",
    });
    let res = null;
    try {
      res = await fetch(`${LINK_CARD_SERVICE_URL}/v1/extract?url=${url}`);
    } catch (error) {
      console.error("Error loading external link embed preview: ", error);
      return;
    }
    if (res && res.ok) {
      const data = await res.json();
      // preview may have been closed or replaced while metadata was loading
      const current = this.state.$externalLinkEmbedData.get();
      if (!current || current.url !== url) return;
      const updated = { ...current };
      if (data.title) {
        updated.title = data.title;
      }
      if (data.description) {
        updated.description = data.description;
      }
      this.state.$externalLinkEmbedData.set(updated);
      if (data.image) {
        // only show image if it can be loaded
        let imageRes = null;
        try {
          imageRes = await fetch(sanitizeUri(data.image));
        } catch (error) {}
        // preview may have been closed or replaced while the image was loading
        const latest = this.state.$externalLinkEmbedData.get();
        if (imageRes && imageRes.ok && latest && latest.url === url) {
          this.state.$externalLinkEmbedData.set({
            ...latest,
            image: data.image,
          });
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
    if (this.isSendBlocked()) return;
    this.state.$isSending.set(true);
    const successCallback = () => {
      this.close();
    };
    const errorCallback = () => {
      this.state.$isSending.set(false);
      // todo: show error message
    };
    const postText = untrack(() => this.state.$postText.get());
    const external = untrack(() => this.state.$externalLinkEmbedData.get());
    const quotedRecord = untrack(() => this.state.$quotedRecord.get());
    const images = untrack(() => this.state.$selectedImages.get());
    const video = untrack(() => this.state.$selectedVideo.get());
    this.dispatchEvent(
      new CustomEvent("send-post", {
        detail: {
          postText,
          external,
          replyTo: this.replyTo,
          replyRoot: this.replyRoot,
          quotedRecord,
          images,
          video,
          successCallback,
          errorCallback,
        },
      }),
    );
  }

  confirmClose() {
    // Todo - check for other unsaved changes
    const postText = untrack(() => this.state.$postText.get());
    const selectedImages = untrack(() => this.state.$selectedImages.get());
    const selectedVideo = untrack(() => this.state.$selectedVideo.get());
    if (
      postText.length === 0 &&
      selectedImages.length === 0 &&
      !selectedVideo
    ) {
      return true;
    }
    return confirmModal("Are you sure you'd like to discard this draft?", {
      title: "Discard draft?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Discard",
    });
  }
}

PostComposer.register();
