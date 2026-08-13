import { html, render, keyed } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import {
  classnames,
  graphemeCount,
  readFileAsDataUrl,
  sanitizeUri,
} from "/js/utils.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { DragAndDropObserver } from "/js/dragAndDropObserver.js";
import { imageIconTemplate } from "/js/templates/icons/imageIcon.template.js";
import { emojiIconTemplate } from "/js/templates/icons/emojiIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import { checkIconTemplate } from "/js/templates/icons/checkIcon.template.js";
import { plusIconTemplate } from "/js/templates/icons/plusIcon.template.js";
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
import { choiceModal } from "/js/modals/choice.modal.js";
import {
  parseUri,
  createEmbedFromPost,
  getLocalRefsFromDraft,
  getImagesFromDraftPost,
} from "/js/dataHelpers.js";
import {
  DraftMediaStore,
  buildDraftFromComposerSnapshot,
  getDraftDeviceId,
} from "/js/drafts.js";
import { ApiError } from "/js/api.js";
import "/js/components/rich-text-input.js";
import "/js/components/image-alt-text-dialog.js";
import "/js/components/emoji-picker-dialog.js";
import "/js/components/drafts-dialog.js";

const MAX_DRAFT_GRAPHEME_LENGTH = 1000;
// Threshold for detecting pasted text, since InputEvent.inputType is unreliable
const BULK_TEXT_INSERT_THRESHOLD = 8;

function isDraftTextSavable(text) {
  return graphemeCount(text) <= MAX_DRAFT_GRAPHEME_LENGTH;
}

function isDraftLimitError(error) {
  return error instanceof ApiError && error.data?.error === "DraftLimitReached";
}

function hasPostStateContent(postState) {
  return (
    postState.text.length > 0 ||
    postState.images.length > 0 ||
    postState.video !== null ||
    postState.external !== null ||
    postState.quotedRecord !== null
  );
}

function getSendErrorMessage(error) {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return "The server appears to be experiencing issues. Please try again in a few moments.";
    }
    const message = error.data?.message;
    if (message?.includes("not locate record")) {
      return "The post you are replying to has been deleted.";
    }
    if (message) {
      return message;
    }
  }
  if (error instanceof TypeError) {
    return "Unable to connect. Please check your internet connection and try again.";
  }
  return "Failed to send post. Please try again.";
}

function errorMessageBannerTemplate({ message, onDismiss }) {
  return html`<div
    class="composer-error-banner"
    data-testid="composer-error-banner"
    role="alert"
  >
    ${alertIconTemplate()}
    <span class="composer-error-banner-message">${message}</span>
    <button
      class="composer-error-banner-dismiss"
      data-testid="composer-error-dismiss"
      aria-label="Dismiss error"
      @click=${onDismiss}
    >
      ${closeIconTemplate()}
    </button>
  </div>`;
}

function isVideoUploadPending(video) {
  return (
    !!video && (video.status === "uploading" || video.status === "processing")
  );
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

function altIndicatorContentTemplate(hasAlt) {
  return html`${hasAlt ? checkIconTemplate() : plusIconTemplate()} ALT`;
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
          ${altIndicatorContentTemplate(!!video.alt)}
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
              ${altIndicatorContentTemplate(!!img.alt)}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function composerPostTemplate({
  postState,
  isActive,
  canRemove,
  promptText,
  currentUser,
  pluginService,
  onActivate,
  onRemovePost,
  onInput,
  onPaste,
  onRemoveImage,
  onEditAltText,
  onRemoveVideo,
  onEditVideoAltText,
  onCloseExternal,
  onCloseQuote,
}) {
  return html`
    <div
      class=${classnames("post-composer-post", { "is-inactive": !isActive })}
      data-testid="composer-post"
      data-teststate=${isActive ? "active" : "inactive"}
      data-post-id=${postState.id}
      @focusin=${() => onActivate()}
      @click=${() => onActivate()}
    >
      ${canRemove
        ? html`<button
            class="post-composer-remove-post-button"
            data-testid="composer-remove-post-button"
            aria-label="Remove post from thread"
            @click=${(e) => {
              e.stopPropagation();
              onRemovePost();
            }}
          >
            ${closeIconTemplate()}
          </button>`
        : ""}
      <div class="post-composer-body">
        <div class="post-composer-body-left">
          ${avatarTemplate({
            author: currentUser,
            clickAction: "none",
          })}
        </div>
        <div class="post-composer-body-right">
          <rich-text-input
            @input=${(e) => onInput(e)}
            @paste=${(e) => onPaste(e)}
            placeholder="${promptText}"
          ></rich-text-input>
        </div>
      </div>
      ${postState.external
        ? externalLinkEmbedPreviewTemplate({
            data: postState.external,
            onClose: () => onCloseExternal(),
          })
        : ""}
      ${postState.images.length > 0
        ? imagePreviewTemplate({
            images: postState.images,
            onRemove: (index) => onRemoveImage(index),
            onEditAltText: (index) => onEditAltText(index),
          })
        : ""}
      ${postState.video
        ? videoPreviewTemplate({
            video: postState.video,
            onRemove: () => onRemoveVideo(),
            onEditAltText: () => onEditVideoAltText(),
          })
        : ""}
      ${postState.quotedRecord
        ? html`<div class="post-composer-embed-preview">
            <button
              class="embed-preview-close-button"
              @click=${() => {
                onCloseQuote();
              }}
            >
              ${closeIconTemplate()}
            </button>
            <div inert>
              ${recordEmbedTemplate({
                record: postState.quotedRecord,
                isAuthenticated: true,
                pluginService,
              })}
            </div>
          </div>`
        : ""}
    </div>
  `;
}

class PostComposer extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.innerHTML = "";
    this._draftId = null;
    this._isDirty = false;
    this._originalLocalRefs = null;
    // Pass through unsupported fields on drafts
    this._draftPassthrough = null;
    this._sendAbortController = null;
    this._sendAttemptId = null;
    // postId -> AbortController for that post's in-flight video upload
    this._videoAbortControllers = new Map();
    this.state = new ReactiveStore("postComposer");
    this.state.$posts = new Signal.State([
      this._createPostState({
        quotedRecord: this._pendingQuotedRecord ?? null,
      }),
    ]);
    this.state.$activePostIndex = new Signal.State(0);
    this.state.$isSending = new Signal.State(false);
    this.state.$isCancellingSend = new Signal.State(false);
    this.state.$errorMessage = new Signal.State(null);
    this.state.$isSavingDraft = new Signal.State(false);
    this._pendingQuotedRecord = null;
    this.state.$draftsEnabled = new Signal.State(
      this._pendingDraftsEnabled ?? false,
    );
    this._pendingDraftsEnabled = null;
    this.state.$isDraggingFiles = new Signal.State(false);
    this._dragAndDropObserver = null;
    this._disposers = [
      effect(() => {
        this.render();
      }),
    ];
    this.initialized = true;
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._sendAbortController?.abort();
    this._sendAbortController = null;
    this._abortAllVideoUploads();
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = null;
    this._disconnectDragAndDropObserver();
  }

  // State helpers

  _createPostState(overrides = {}) {
    return {
      id: crypto.randomUUID(),
      text: "",
      unresolvedFacets: [],
      images: [],
      video: null,
      external: null,
      externalLinkUrl: null,
      quotedRecord: null,
      quotedRecordUrl: null,
      rejectedLinkEmbeds: new Set(),
      videoToken: null,
      draftVideoCaptions: null,
      labels: null,
      unrestoredImages: null,
      unrestoredVideo: null,
      ...overrides,
    };
  }

  _getPosts() {
    return untrack(() => this.state.$posts.get());
  }

  _getPost(postId) {
    return this._getPosts().find((postState) => postState.id === postId);
  }

  _getActivePost() {
    const posts = this._getPosts();
    const activeIndex = untrack(() => this.state.$activePostIndex.get());
    return posts[Math.min(activeIndex, posts.length - 1)];
  }

  _updatePost(postId, patch) {
    const posts = this._getPosts();
    const index = posts.findIndex((postState) => postState.id === postId);
    if (index === -1) return null;
    const updated = { ...posts[index], ...patch };
    this.state.$posts.set(
      posts.map((postState, postIndex) =>
        postIndex === index ? updated : postState,
      ),
    );
    return updated;
  }

  _getInputForPost(postId) {
    return this.querySelector(`[data-post-id="${postId}"] rich-text-input`);
  }

  // The posts list renders with lit's `keyed`, so any structural change to the
  // posts array (add/remove/restore) recreates the inputs downstream of the
  // change with empty DOM. After mutating the array outside of handleInput,
  // call render() then this, to write state text back into the fresh inputs.
  _syncInputsFromState() {
    for (const postState of this._getPosts()) {
      const input = this._getInputForPost(postState.id);
      if (input && input.text !== postState.text) {
        input.setText(postState.text);
      }
    }
  }

  get quotedRecord() {
    if (!this.state) return this._pendingQuotedRecord ?? null;
    return this._getPosts()[0].quotedRecord;
  }

  set quotedRecord(value) {
    if (!this.state) {
      this._pendingQuotedRecord = value;
      return;
    }
    this._updatePost(this._getPosts()[0].id, { quotedRecord: value });
  }

  get draftsEnabled() {
    if (!this.state) return this._pendingDraftsEnabled ?? false;
    return untrack(() => this.state.$draftsEnabled.get());
  }

  set draftsEnabled(value) {
    if (!this.state) {
      this._pendingDraftsEnabled = value;
      return;
    }
    this.state.$draftsEnabled.set(value);
  }

  render() {
    const isSending = this.state.$isSending.get();
    const isCancellingSend = this.state.$isCancellingSend.get();
    const sendError = this.state.$errorMessage.get();
    const isSavingDraft = this.state.$isSavingDraft.get();
    const draftsEnabled = this.state.$draftsEnabled.get();
    const posts = this.state.$posts.get();
    const activePostIndex = Math.min(
      this.state.$activePostIndex.get(),
      posts.length - 1,
    );
    const activePost = posts[activePostIndex];
    const isThread = posts.length > 1;
    const isDraggingFiles = this.state.$isDraggingFiles.get();

    const currentCharCount = graphemeCount(activePost.text);
    const charCountPercentage = Math.min(
      Math.round((currentCharCount / 300) * 100),
      100,
    );
    const isAboveCharLimit = currentCharCount > 300;
    const isAnyPostAboveCharLimit = posts.some(
      (postState) =>
        hasPostStateContent(postState) && graphemeCount(postState.text) > 300,
    );
    const isAnyVideoBlocking = posts.some(
      (postState) =>
        isVideoUploadPending(postState.video) ||
        postState.video?.status === "error",
    );
    const hasVideo = !!activePost.video;
    const nextPost = posts[activePostIndex + 1] ?? null;
    const canAddPost =
      hasPostStateContent(activePost) &&
      (!nextPost || hasPostStateContent(nextPost));

    let submitLabel = "Post";
    let submitTestState = "post";
    if (this.replyTo) {
      submitLabel = "Reply";
      submitTestState = "reply";
    }
    if (isThread) {
      submitLabel = "Post All";
      submitTestState = "post-all";
    }

    render(
      html`
        <dialog
          class="post-composer bottom-sheet bottom-sheet-fullscreen no-handle"
          autofocus
          @click=${async (e) => {
            if (e.target.tagName === "DIALOG") {
              if (await this.confirmClose()) {
                this.close();
              }
            }
          }}
          @cancel=${async (event) => {
            event.preventDefault();
            if (await this.confirmClose()) {
              this.close();
            }
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this._disconnectDragAndDropObserver();
            this.dispatchEvent(new CustomEvent("post-composer-closed"));
          }}
          @keydown=${(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (this.hasContent()) {
                this.send();
              }
            }
          }}
        >
          ${isDraggingFiles
            ? html`<div
                class="post-composer-drop-overlay"
                data-testid="post-composer-drop-overlay"
              >
                <span>Drop to add files</span>
              </div>`
            : ""}
          <div class="post-composer-content">
            <div class="post-composer-top-bar">
              <button
                class="text-pill-button post-composer-cancel-button"
                @click=${async () => {
                  if (await this.confirmClose()) {
                    this.close();
                  }
                }}
              >
                Cancel
              </button>
              ${!this.replyTo && draftsEnabled
                ? html`<button
                    class="text-pill-button post-composer-drafts-button"
                    data-testid="composer-drafts-button"
                    .disabled=${isSavingDraft}
                    @click=${() => this.handleDraftsButtonClick()}
                  >
                    Drafts
                  </button>`
                : ""}
              <button
                class="rounded-button rounded-button-primary"
                data-testid="composer-submit-button"
                data-teststate=${submitTestState}
                @click=${() => this.send()}
                .disabled=${isSending ||
                isCancellingSend ||
                isAnyPostAboveCharLimit ||
                isAnyVideoBlocking}
              >
                ${isSending
                  ? html`Sending... <span>&nbsp;&nbsp;</span>
                      <div class="loading-spinner"></div>`
                  : html`<span>${submitLabel}</span>`}
              </button>
            </div>
            ${sendError
              ? errorMessageBannerTemplate({
                  message: sendError,
                  onDismiss: () => this.state.$errorMessage.set(null),
                })
              : ""}
            <div class="post-composer-scroll-area">
              <div class="post-composer-scroll-area-content">
                ${this.replyTo ? replyToTemplate({ post: this.replyTo }) : ""}
                ${posts.map((postState, index) =>
                  keyed(
                    postState.id,
                    composerPostTemplate({
                      postState,
                      isActive: index === activePostIndex,
                      canRemove: isThread && index === activePostIndex,
                      promptText: this._getPromptText(index),
                      currentUser: this.currentUser,
                      pluginService: this.pluginService,
                      onActivate: () => this.handleActivatePost(index),
                      onRemovePost: () => this.handleRemovePost(postState.id),
                      onInput: (e) => this.handleInput(postState.id, e),
                      onPaste: (e) => this.handlePaste(postState.id, e),
                      onRemoveImage: (imageIndex) =>
                        this.handleRemoveImage(postState.id, imageIndex),
                      onEditAltText: (imageIndex) =>
                        this.handleEditAltText(postState.id, imageIndex),
                      onRemoveVideo: () => this.handleRemoveVideo(postState.id),
                      onEditVideoAltText: () =>
                        this.handleEditVideoAltText(postState.id),
                      onCloseExternal: () =>
                        this.handleExternalLinkEmbedPreviewClose(postState.id),
                      onCloseQuote: () =>
                        this.handleQuotedEmbedPreviewClose(postState.id),
                    }),
                  ),
                )}
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
                    class="icon-button image-picker-button"
                    @click=${() => this.handleMediaButtonClick()}
                    .disabled=${hasVideo || activePost.images.length >= 4}
                  >
                    ${imageIconTemplate()}
                  </button>
                  <div class="post-composer-emoji-wrapper">
                    <button
                      type="button"
                      class="icon-button post-composer-emoji-button"
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
                <div class="post-composer-bottom-bar-right">
                  ${canAddPost
                    ? html`<button
                        class="icon-button post-composer-add-post-button"
                        data-testid="composer-add-post-button"
                        aria-label="Add another post"
                        @click=${() => this.handleAddPost()}
                      >
                        ${plusIconTemplate()}
                      </button>`
                    : ""}
                  <div
                    class=${classnames("word-count", {
                      overflow: isAboveCharLimit,
                    })}
                  >
                    <span class="word-count-text"
                      >${300 - currentCharCount}</span
                    >
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
          </div>
        </dialog>
      `,
      this,
    );
  }

  _getPromptText(index) {
    if (index > 0) {
      return "Write another post";
    }
    return this.replyTo ? "Write your reply" : "What's up?";
  }

  isSendBlocked() {
    const isSending = untrack(() => this.state.$isSending.get());
    const isCancellingSend = untrack(() => this.state.$isCancellingSend.get());
    const posts = this._getPosts();
    const isAnyPostAboveCharLimit = posts.some(
      (postState) =>
        hasPostStateContent(postState) && graphemeCount(postState.text) > 300,
    );
    const isAnyVideoBlocking = posts.some(
      (postState) =>
        isVideoUploadPending(postState.video) ||
        postState.video?.status === "error",
    );
    return (
      isSending ||
      isCancellingSend ||
      isAnyPostAboveCharLimit ||
      isAnyVideoBlocking
    );
  }

  handleActivatePost(index) {
    if (untrack(() => this.state.$activePostIndex.get()) !== index) {
      this.state.$activePostIndex.set(index);
    }
  }

  handleAddPost() {
    const posts = this._getPosts();
    const activeIndex = untrack(() => this.state.$activePostIndex.get());
    const activePost = posts[activeIndex];
    const nextPost = posts[activeIndex + 1] ?? null;
    if (
      !hasPostStateContent(activePost) ||
      (nextPost && !hasPostStateContent(nextPost))
    ) {
      return;
    }
    const newPost = this._createPostState();
    const updated = [...posts];
    updated.splice(activeIndex + 1, 0, newPost);
    this.state.$posts.set(updated);
    this.state.$activePostIndex.set(activeIndex + 1);
    this._isDirty = true;
    // Render + focus synchronously so iOS keeps the keyboard open (focus only
    // works inside the user-gesture call stack)
    this.render();
    this._syncInputsFromState();
    this._getInputForPost(newPost.id)?.focus({ preventScroll: false });
  }

  async handleRemovePost(postId) {
    const posts = this._getPosts();
    if (posts.length < 2) return;
    const index = posts.findIndex((postState) => postState.id === postId);
    if (index === -1) return;
    const postState = posts[index];
    if (hasPostStateContent(postState)) {
      const confirmed = await confirmModal(
        "Are you sure you'd like to delete this post from the thread?",
        {
          title: "Delete post?",
          confirmButtonStyle: "danger-subtle",
          confirmButtonText: "Delete",
        },
      );
      if (!confirmed) return;
    }
    this._abortVideoUpload(postId);
    if (postState.video?.previewUrl) {
      URL.revokeObjectURL(postState.video.previewUrl);
    }
    const latestPosts = this._getPosts().filter(
      (latestPost) => latestPost.id !== postId,
    );
    if (latestPosts.length === 0) return;
    const newActiveIndex = Math.max(0, index - 1);
    this.state.$posts.set(latestPosts);
    this.state.$activePostIndex.set(newActiveIndex);
    this._isDirty = true;
    this.render();
    this._syncInputsFromState();
    this._getInputForPost(latestPosts[newActiveIndex].id)?.focus({
      preventScroll: true,
    });
  }

  handleEmojiButtonClick(event) {
    const dialog = this.querySelector("emoji-picker-dialog");
    if (!dialog) return;
    if (dialog.isOpen) {
      dialog.close();
      return;
    }
    const activePost = this._getActivePost();
    const richTextInput = this._getInputForPost(activePost.id);
    this._savedEmojiCursor = richTextInput?.getCursor() ?? null;
    dialog.open(event.currentTarget);
  }

  handleEmojiSelect(emoji) {
    const activePost = this._getActivePost();
    const richTextInput = this._getInputForPost(activePost.id);
    if (!richTextInput) return;
    richTextInput.insertText(emoji, this._savedEmojiCursor);
    richTextInput.focus();
    this._savedEmojiCursor = null;
  }

  handleExternalLinkEmbedPreviewClose(postId) {
    const postState = this._getPost(postId);
    if (!postState) return;
    postState.rejectedLinkEmbeds.add(postState.externalLinkUrl);
    this._updatePost(postId, { externalLinkUrl: null, external: null });
    this._isDirty = true;
  }

  handleQuotedEmbedPreviewClose(postId) {
    this._updatePost(postId, { quotedRecordUrl: null, quotedRecord: null });
    this._isDirty = true;
  }

  async loadQuotedRecordFromLink(postId) {
    const url = this._getPost(postId)?.quotedRecordUrl;
    if (!url) return;
    try {
      const record = await resolveRecordFromLink(url, {
        identityResolver: this.identityResolver,
        dataLayer: this.dataLayer,
      });
      // the embed may have been closed or replaced while the record was loading
      if (this._getPost(postId)?.quotedRecordUrl !== url) return;
      this._updatePost(postId, { quotedRecord: record });
    } catch (error) {
      console.error("Error loading record embed from link: ", error);
      const postState = this._getPost(postId);
      if (!postState) return;
      postState.rejectedLinkEmbeds.add(url);
      if (postState.quotedRecordUrl === url) {
        this._updatePost(postId, { quotedRecordUrl: null });
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
    await this.addMediaFiles(this._getActivePost().id, files);
  }

  _initDragAndDropObserver() {
    if (this._dragAndDropObserver) return;
    this._dragAndDropObserver = new DragAndDropObserver(window, {
      onDragStart: () => this.state.$isDraggingFiles.set(true),
      onDragEnd: () => this.state.$isDraggingFiles.set(false),
      onDrop: (files) => this.addMediaFiles(this._getActivePost().id, files),
    });
  }

  _disconnectDragAndDropObserver() {
    if (!this._dragAndDropObserver) return;
    this._dragAndDropObserver.disconnect();
    this._dragAndDropObserver = null;
  }

  async addMediaFiles(postId, files) {
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
      const postState = this._getPost(postId);
      if (!postState) return;
      if (postState.images.length > 0) {
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
      this._isDirty = true;
      await this.processVideoFile(postId, videoFiles[0]);
      return;
    }

    if (imageFiles.length > 0) {
      const postState = this._getPost(postId);
      if (!postState) return;
      if (postState.video) {
        showToast("Selecting multiple media types is not supported", {
          style: "warning",
        });
        return;
      }
      await this.addImageFiles(postId, imageFiles);
    }
  }

  async addImageFiles(postId, files) {
    const maxImages = 4;
    const currentImages = this._getPost(postId)?.images;
    if (!currentImages) return;
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
    const postState = this._getPost(postId);
    if (!postState) return;
    const selectedImages = [...postState.images, ...newImages];
    const patch = { images: selectedImages };
    // Reject external link embed if images are added
    if (selectedImages.length > 0 && postState.externalLinkUrl) {
      postState.rejectedLinkEmbeds.add(postState.externalLinkUrl);
      patch.externalLinkUrl = null;
      patch.external = null;
    }
    this._updatePost(postId, patch);
    this._isDirty = true;
  }

  handleRemoveImage(postId, index) {
    const postState = this._getPost(postId);
    if (!postState) return;
    this._updatePost(postId, {
      images: postState.images.filter(
        (image, imageIndex) => imageIndex !== index,
      ),
    });
    this._isDirty = true;
  }

  handleEditAltText(postId, index) {
    const postState = this._getPost(postId);
    if (!postState) return;
    const image = postState.images[index];
    const dialog = document.createElement("image-alt-text-dialog");
    dialog.imageUrl = image.dataUrl;
    dialog.value = image.alt || "";

    dialog.addEventListener("alt-text-saved", (e) => {
      const latestPost = this._getPost(postId);
      if (latestPost) {
        this._updatePost(postId, {
          images: latestPost.images.map((selectedImage, imageIndex) =>
            imageIndex === index
              ? { ...selectedImage, alt: e.detail.altText }
              : selectedImage,
          ),
        });
        this._isDirty = true;
      }
      dialog.remove();
    });

    dialog.addEventListener("alt-text-dialog-closed", () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.open();
  }

  async processVideoFile(postId, file) {
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
    const updated = this._updatePost(postId, {
      videoToken: token,
      draftVideoCaptions: null,
      video: {
        file,
        previewUrl: URL.createObjectURL(file),
        alt: "",
        aspectRatio: metadata.aspectRatio,
        status: "uploading",
        progress: 0,
        jobId: null,
        blob: null,
        error: null,
      },
    });
    if (!updated) return;
    this.uploadSelectedVideo(postId, token);
  }

  // Applies a partial update to the post's video, unless it has been removed
  // or replaced since `token` was issued.
  patchSelectedVideo(postId, token, patch) {
    const postState = this._getPost(postId);
    if (!postState || postState.videoToken !== token) return null;
    const video = { ...postState.video, ...patch };
    this._updatePost(postId, { video });
    return video;
  }

  _abortVideoUpload(postId) {
    const controller = this._videoAbortControllers.get(postId);
    if (controller) {
      controller.abort();
      this._videoAbortControllers.delete(postId);
    }
  }

  _abortAllVideoUploads() {
    for (const controller of this._videoAbortControllers.values()) {
      controller.abort();
    }
    this._videoAbortControllers.clear();
  }

  async uploadSelectedVideo(postId, token) {
    const video = this._getPost(postId)?.video;
    if (!video) return;
    this._abortVideoUpload(postId);
    const controller = new AbortController();
    this._videoAbortControllers.set(postId, controller);
    try {
      const uploader = new VideoUploader(this.dataLayer.api);
      const blob = await uploader.upload(video.file, {
        onJobStart: (job) => {
          this.patchSelectedVideo(postId, token, {
            jobId: job.jobId,
            status: "processing",
          });
        },
        onProgress: (_state, progress) => {
          this.patchSelectedVideo(postId, token, { progress });
        },
        signal: controller.signal,
      });
      this.patchSelectedVideo(postId, token, { blob, status: "done" });
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Video upload error: ", error);
      const failedVideo = this.patchSelectedVideo(postId, token, {
        status: "error",
        error: error.message || "Upload failed",
      });
      if (failedVideo) {
        showToast(failedVideo.error, { style: "error" });
      }
    } finally {
      if (this._videoAbortControllers.get(postId) === controller) {
        this._videoAbortControllers.delete(postId);
      }
    }
  }

  handleRemoveVideo(postId) {
    const postState = this._getPost(postId);
    if (!postState) return;
    this._abortVideoUpload(postId);
    if (postState.video?.previewUrl) {
      URL.revokeObjectURL(postState.video.previewUrl);
    }
    this._updatePost(postId, {
      videoToken: null,
      video: null,
      draftVideoCaptions: null,
    });
    this._isDirty = true;
  }

  handleEditVideoAltText(postId) {
    const postState = this._getPost(postId);
    if (!postState?.video) return;
    const token = postState.videoToken;
    const dialog = document.createElement("image-alt-text-dialog");
    dialog.value = postState.video.alt || "";

    dialog.addEventListener("alt-text-saved", (e) => {
      this.patchSelectedVideo(postId, token, { alt: e.detail.altText });
      this._isDirty = true;
      dialog.remove();
    });

    dialog.addEventListener("alt-text-dialog-closed", () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.open();
  }

  handleInput(postId, e) {
    const postState = this._getPost(postId);
    if (!postState) return;
    this._isDirty = true;
    const previousText = postState.text;
    const previousFacets = postState.unresolvedFacets;
    const unresolvedFacets = e.detail.facets;
    this._updatePost(postId, { text: e.detail.text, unresolvedFacets });
    // If the facets *haven't* changed, and the latest change was a space or
    // newline, check for possible link embeds. Also check for embeds
    // immediately on bulk inserts (paste).
    const facetsChanged =
      JSON.stringify(previousFacets) !== JSON.stringify(unresolvedFacets);
    const isCommit =
      e.detail.text.endsWith(" ") || e.detail.text.endsWith("\n");
    const insertedLength =
      graphemeCount(e.detail.text) - graphemeCount(previousText);
    const isBulkInsert =
      e.detail.inputType === "insertFromPaste" ||
      e.detail.inputType === "insertFromDrop" ||
      insertedLength > BULK_TEXT_INSERT_THRESHOLD;
    if ((!facetsChanged && isCommit) || isBulkInsert) {
      for (const facet of unresolvedFacets) {
        // Only handle one feature for now
        const feature = facet.features[0];
        if (feature.$type === "app.bsky.richtext.facet#link") {
          const url = feature.uri;
          const latestPost = this._getPost(postId);
          if (!latestPost) return;
          if (latestPost.externalLinkUrl) {
            // automatically reject links if there's an existing link embed
            latestPost.rejectedLinkEmbeds.add(url);
          } else if (!latestPost.rejectedLinkEmbeds.has(url)) {
            if (parseRecordLink(url)) {
              if (!latestPost.quotedRecord && !latestPost.quotedRecordUrl) {
                this._updatePost(postId, { quotedRecordUrl: url });
                this.loadQuotedRecordFromLink(postId);
              }
            } else {
              this._updatePost(postId, { externalLinkUrl: url });
              this.loadExternalLinkEmbedPreview(postId);
            }
          }
        }
      }
    }
    // If the facets have changed, check to see if links have been removed.
    // This will allow links to be re-added after being rejected.
    if (facetsChanged) {
      const linkFacetUrls = unresolvedFacets
        .filter(
          (facet) => facet.features[0].$type === "app.bsky.richtext.facet#link",
        )
        .map((facet) => facet.features[0].uri);
      for (const rejectedLinkEmbed of postState.rejectedLinkEmbeds) {
        if (!linkFacetUrls.includes(rejectedLinkEmbed)) {
          postState.rejectedLinkEmbeds.delete(rejectedLinkEmbed);
        }
      }
    }
  }

  handlePaste(postId, e) {
    const pastedFiles = Array.from(e.clipboardData?.files ?? []);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      this.addMediaFiles(postId, pastedFiles);
      return;
    }
  }

  async loadExternalLinkEmbedPreview(postId) {
    const url = this._getPost(postId)?.externalLinkUrl;
    if (!url) return;
    // preliminary data
    this._updatePost(postId, {
      external: {
        url,
        title: url,
        description: "",
        image: "",
      },
    });
    let res = null;
    try {
      res = await fetch(
        `${LINK_CARD_SERVICE_URL}/v1/extract?url=${encodeURIComponent(url)}`,
      );
    } catch (error) {
      console.error("Error loading external link embed preview: ", error);
      return;
    }
    if (res && res.ok) {
      const data = await res.json();
      // preview may have been closed or replaced while metadata was loading
      const current = this._getPost(postId)?.external;
      if (!current || current.url !== url) return;
      const updated = { ...current };
      if (data.title) {
        updated.title = data.title;
      }
      if (data.description) {
        updated.description = data.description;
      }
      this._updatePost(postId, { external: updated });
      if (data.image) {
        // only show image if it can be loaded
        let imageRes = null;
        try {
          imageRes = await fetch(sanitizeUri(data.image));
        } catch (error) {}
        // preview may have been closed or replaced while the image was loading
        const latest = this._getPost(postId)?.external;
        if (imageRes && imageRes.ok && latest && latest.url === url) {
          this._updatePost(postId, {
            external: { ...latest, image: data.image },
          });
        }
      }
    }
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".post-composer");
    if (dialog?.open) return;
    dialog.showModal();
    this.querySelector("rich-text-input")?.focus({ preventScroll: true });

    // Setup mobile swipe-to-dismiss
    enableDragToDismiss(dialog, {
      confirmDismiss: () => this.confirmClose(),
      onDismiss: () => this.close(),
      scrollContainer: this.querySelector(".post-composer-scroll-area"),
      dragHandle: this.querySelector(".post-composer-top-bar"),
      ignoreTouchTarget: (el) =>
        !!el.closest("button") ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        !!el.closest("[contenteditable]"),
      disableWhenKeyboardOpen: true,
    });

    resetScrollOnBlur(dialog, this.querySelector(".post-composer-scroll-area"));

    this._initDragAndDropObserver();
  }

  applyComposerInit({ text, cursor }) {
    if (this._isDirty) return;
    const activePost = this._getActivePost();
    const richTextInput = this._getInputForPost(activePost.id);
    if (!richTextInput) return;
    if (text != null) {
      richTextInput.setText(text);
    }
    if (cursor != null) {
      richTextInput.setCursor(cursor);
    }
  }

  close() {
    return closeWithAnimation(this.querySelector(".post-composer"));
  }

  // Drop trailing empty posts and confirm mid-thread empty posts
  async _buildPostsForSend() {
    const posts = this._getPosts();
    let lastNonEmptyIndex = -1;
    for (let i = posts.length - 1; i >= 0; i--) {
      if (hasPostStateContent(posts[i])) {
        lastNonEmptyIndex = i;
        break;
      }
    }
    if (lastNonEmptyIndex === -1) {
      return [posts[0]];
    }
    const trimmed = posts.slice(0, lastNonEmptyIndex + 1);
    const nonEmpty = trimmed.filter((postState) =>
      hasPostStateContent(postState),
    );
    if (nonEmpty.length < trimmed.length) {
      const confirmed = await confirmModal(
        "Some posts in your thread are empty. Would you like to skip them and post the rest?",
        {
          title: "Skip empty posts?",
          confirmButtonText: "Skip and post",
        },
      );
      if (!confirmed) return null;
    }
    return nonEmpty;
  }

  async send() {
    if (this.isSendBlocked()) return;
    const postsToSend = await this._buildPostsForSend();
    if (!postsToSend) return;
    this.state.$errorMessage.set(null);
    this.state.$isSending.set(true);
    const attemptId = Symbol();
    this._sendAttemptId = attemptId;
    this._sendAbortController = new AbortController();
    const successCallback = () => this.close();
    const errorCallback = (error) => {
      const isStale = this._sendAttemptId !== attemptId;
      const isCancelled = untrack(() => this.state.$isCancellingSend.get());
      if (isStale || isCancelled) return;
      this.state.$isSending.set(false);
      this.state.$errorMessage.set(getSendErrorMessage(error));
    };
    const settledCallback = () => {
      if (this._sendAttemptId !== attemptId) return;
      this._sendAttemptId = null;
      this._sendAbortController = null;
      this.state.$isCancellingSend.set(false);
    };
    this.dispatchEvent(
      new CustomEvent("send-post", {
        detail: {
          posts: postsToSend.map((postState) => ({
            postText: postState.text,
            images: postState.images,
            video: postState.video,
            external: postState.external,
            quotedRecord: postState.quotedRecord,
            labels: postState.labels ?? this._draftPassthrough?.labels ?? null,
          })),
          replyTo: this.replyTo,
          replyRoot: this.replyRoot,
          threadgateAllow: this._draftPassthrough?.threadgateAllow ?? null,
          postgateEmbeddingRules:
            this._draftPassthrough?.postgateEmbeddingRules ?? null,
          // Publishing a saved/restored draft consumes it
          draft: this._draftId
            ? {
                draftId: this._draftId,
                localRefs: [...this._originalLocalRefs],
              }
            : null,
          signal: this._sendAbortController.signal,
          successCallback,
          errorCallback,
          settledCallback,
        },
      }),
    );
  }

  // Only the work before the repo commit is abortable, so a cancelled send may
  // still publish (and still closes the composer on success). Disable
  // sending until the previous send settles either way.
  _cancelSend() {
    if (this._sendAbortController) {
      this._sendAbortController.abort();
    }
    this.state.$isSending.set(false);
    if (this._sendAttemptId) {
      this.state.$isCancellingSend.set(true);
    }
  }

  hasContent() {
    return this._getPosts().some((postState) => hasPostStateContent(postState));
  }

  buildDraftSnapshot() {
    const posts = this._getPosts();
    return {
      posts: posts.map((postState) => ({
        postText: postState.text,
        images: postState.images,
        video: postState.video
          ? {
              file: postState.video.file,
              alt: postState.video.alt,
              captions: postState.draftVideoCaptions,
            }
          : null,
        external: postState.external,
        quotedRecord: postState.quotedRecord,
        labels: postState.labels,
        unrestoredImages: postState.unrestoredImages,
        unrestoredVideo: postState.unrestoredVideo,
      })),
      threadgateAllow: this._draftPassthrough?.threadgateAllow ?? null,
      postgateEmbeddingRules:
        this._draftPassthrough?.postgateEmbeddingRules ?? null,
    };
  }

  async saveDraft() {
    const posts = this._getPosts();
    if (!posts.every((postState) => isDraftTextSavable(postState.text))) {
      showToast(
        `You can only save drafts up to ${MAX_DRAFT_GRAPHEME_LENGTH} characters`,
        { style: "warning" },
      );
      return false;
    }
    this.state.$isSavingDraft.set(true);
    const snapshot = this.buildDraftSnapshot();
    // Clear dirty so any edits made during save set it again
    this._isDirty = false;
    try {
      const { draft, media } = buildDraftFromComposerSnapshot(snapshot);
      const localRefs = getLocalRefsFromDraft(draft);
      let id = this._draftId;
      if (!id) {
        id = await this.dataLayer.mutations.createDraft({ draft, media });
      } else {
        // prune outdated refs along with update
        const refsToPrune = [...this._originalLocalRefs].filter(
          (key) => !localRefs.includes(key),
        );
        await this.dataLayer.mutations.updateDraft({
          draftId: id,
          draft,
          media,
          pruneLocalRefs: refsToPrune,
        });
      }
      // Add new image keys back onto composer state so they can be reused.
      const currentPosts = this._getPosts();
      this.state.$posts.set(
        currentPosts.map((postState, postIndex) => {
          const draftImages = draft.posts[postIndex]?.embedGallery?.items ?? [];
          const snapshotImages = snapshot.posts[postIndex]?.images ?? [];
          return {
            ...postState,
            images: postState.images.map((image) => {
              if (image.localRefPath) return image;
              const snapshotIndex = snapshotImages.indexOf(image);
              if (snapshotIndex === -1) return image;
              return {
                ...image,
                localRefPath: draftImages[snapshotIndex].localRef.path,
              };
            }),
          };
        }),
      );
      this.markSaved(id, localRefs);
      return true;
    } catch (error) {
      this._isDirty = true;
      console.error("Failed to save draft", error);
      showToast(
        isDraftLimitError(error)
          ? "You've reached the maximum number of drafts"
          : "Failed to save draft",
        { style: "error" },
      );
      return false;
    } finally {
      this.state.$isSavingDraft.set(false);
    }
  }

  markSaved(draftId, localRefs) {
    this._draftId = draftId;
    this._originalLocalRefs = new Set(localRefs);
  }

  clearComposer() {
    this._abortAllVideoUploads();
    for (const postState of this._getPosts()) {
      if (postState.video?.previewUrl) {
        URL.revokeObjectURL(postState.video.previewUrl);
      }
    }
    this.state.$posts.set([this._createPostState()]);
    this.state.$activePostIndex.set(0);
    this._draftId = null;
    this._originalLocalRefs = null;
    this._draftPassthrough = null;
    this.render();
    this._syncInputsFromState();
    this._isDirty = false;
  }

  async handleDraftsButtonClick() {
    if (!this.draftsEnabled) return;
    if (untrack(() => this.state.$isSavingDraft.get())) return;
    if (!this.hasContent() || (this._draftId && !this._isDirty)) {
      this.openDraftsDialog();
      return;
    }
    const posts = this._getPosts();
    if (!posts.every((postState) => isDraftTextSavable(postState.text))) {
      const discard = await confirmModal(
        `You can only save drafts up to ${MAX_DRAFT_GRAPHEME_LENGTH} characters. Your post will be discarded.`,
        {
          title: "Discard post?",
          confirmButtonStyle: "danger-subtle",
          confirmButtonText: "Discard",
        },
      );
      if (!discard) return;
      this.clearComposer();
      this.openDraftsDialog();
      return;
    }
    const choice = await this.promptSaveChoice({ forDraftsList: true });
    if (choice === "save") {
      if (await this.saveDraft()) {
        this.openDraftsDialog();
      }
    } else if (choice === "discard") {
      this.clearComposer();
      this.openDraftsDialog();
    }
  }

  promptSaveChoice({ forDraftsList = false } = {}) {
    const isEditingDraft = this._draftId !== null;
    let message;
    if (forDraftsList) {
      message = isEditingDraft
        ? "You have unsaved changes. Would you like to save them before viewing your drafts?"
        : "Would you like to save this post as a draft before viewing your drafts?";
    } else {
      message = isEditingDraft
        ? "You have unsaved changes to this draft. Would you like to save them?"
        : "Would you like to save this post as a draft?";
    }
    return choiceModal(message, {
      title: isEditingDraft ? "Save changes?" : "Save draft?",
      choices: [
        {
          value: "save",
          label: isEditingDraft ? "Save changes" : "Save draft",
          style: "primary",
        },
        { value: "discard", label: "Discard", style: "danger-subtle" },
        { value: "keep", label: "Keep editing", style: "cancel" },
      ],
    });
  }

  openDraftsDialog() {
    const dialog = document.createElement("drafts-dialog");
    dialog.dataLayer = this.dataLayer;
    dialog.addEventListener("draft-selected", (e) => {
      this.restoreFromDraft(e.detail.draftView);
    });
    dialog.addEventListener("draft-deleted", (e) => {
      this.handleDraftDeleted(e.detail.draftId);
    });
    dialog.addEventListener("dialog-closed", () => {
      dialog.remove();
    });
    document.body.appendChild(dialog);
    dialog.open();
  }

  // The server silently ignores updates to a deleted draft id, so once the
  // loaded draft is deleted from the list, treat the content as a new
  // unsaved post
  handleDraftDeleted(draftId) {
    if (draftId === null || draftId !== this._draftId) return;
    this._draftId = null;
    this._originalLocalRefs = null;
    this._isDirty = true;
  }

  async restoreFromDraft(draftView) {
    const draft = draftView.draft;
    const draftPosts = draft.posts?.length > 0 ? draft.posts : [{ text: "" }];
    const isOriginatingDevice = draft.deviceId === getDraftDeviceId();
    this.clearComposer();
    this._draftPassthrough = {
      threadgateAllow: draft.threadgateAllow ?? null,
      postgateEmbeddingRules: draft.postgateEmbeddingRules ?? null,
    };
    this._draftId = draftView.id;
    this._originalLocalRefs = new Set(getLocalRefsFromDraft(draft));

    const postStates = draftPosts.map((draftPost) =>
      this._createPostState({
        text: draftPost.text ?? "",
        labels: draftPost.labels ?? null,
      }),
    );
    this.state.$posts.set(postStates);
    this.state.$activePostIndex.set(0);
    this.render();
    this._syncInputsFromState();
    this._isDirty = false;

    for (let i = 0; i < draftPosts.length; i++) {
      const draftPost = draftPosts[i];
      const postId = postStates[i].id;
      const unrestoredImages = [];
      if (isOriginatingDevice) {
        const restoredImages = [];
        for (const item of getImagesFromDraftPost(draftPost)) {
          try {
            const blob = await this.dataLayer.draftMediaStore.readBlob(
              item.localRef.path,
            );
            if (!blob) {
              unrestoredImages.push(item);
              continue;
            }
            const file = new File([blob], "draft-image", {
              type: blob.type || "image/jpeg",
            });
            const image = {
              file,
              dataUrl: await readFileAsDataUrl(blob),
              localRefPath: item.localRef.path,
            };
            if (item.alt) {
              image.alt = item.alt;
            }
            restoredImages.push(image);
          } catch (error) {
            console.warn("Failed to restore draft image", error);
            unrestoredImages.push(item);
          }
        }
        if (restoredImages.length > 0) {
          this._updatePost(postId, { images: restoredImages });
        }
      } else {
        unrestoredImages.push(...getImagesFromDraftPost(draftPost));
      }
      const externalUri = draftPost.embedExternals?.[0]?.uri ?? null;
      if (externalUri) {
        this._updatePost(postId, { externalLinkUrl: externalUri });
        this.loadExternalLinkEmbedPreview(postId);
      }
      const quoteRef = draftPost.embedRecords?.[0]?.record ?? null;
      if (quoteRef) {
        await this.restoreQuotedRecord(postId, quoteRef);
      }
      const videoEmbed = draftPost.embedVideos?.[0] ?? null;
      let videoRestored = false;
      if (videoEmbed?.localRef?.path && isOriginatingDevice) {
        videoRestored = await this.restoreDraftVideo(postId, videoEmbed);
      }
      const unrestoredVideo = videoEmbed && !videoRestored ? videoEmbed : null;
      this._updatePost(postId, {
        unrestoredImages: unrestoredImages.length > 0 ? unrestoredImages : null,
        unrestoredVideo,
      });
    }
  }

  async restoreQuotedRecord(postId, recordRef) {
    try {
      const { collection } = parseUri(recordRef.uri);
      let record = null;
      if (collection === "app.bsky.feed.generator") {
        const view = await this.dataLayer.declarative.ensureFeedGenerator(
          recordRef.uri,
        );
        record = { ...view, $type: "app.bsky.feed.defs#generatorView" };
      } else if (collection === "app.bsky.graph.list") {
        const view = await this.dataLayer.declarative.ensureList(recordRef.uri);
        record = { ...view, $type: "app.bsky.graph.defs#listView" };
      } else if (collection === "app.bsky.graph.starterpack") {
        const view = await this.dataLayer.declarative.ensureStarterPack(
          recordRef.uri,
        );
        record = { ...view, $type: "app.bsky.graph.defs#starterPackViewBasic" };
      } else {
        const post = await this.dataLayer.declarative.ensurePost(recordRef.uri);
        record = createEmbedFromPost(post);
      }
      this._updatePost(postId, { quotedRecord: record });
    } catch (error) {
      console.warn("Failed to restore draft quote", error);
      showToast("Couldn't load this draft's quoted record", {
        style: "warning",
      });
    }
  }

  async restoreDraftVideo(postId, videoEmbed) {
    try {
      const path = videoEmbed.localRef.path;
      const blob = await this.dataLayer.draftMediaStore.readBlob(path);
      if (!blob) {
        showToast("This draft's video is not available on this device", {
          style: "warning",
        });
        return false;
      }
      const extension = DraftMediaStore.parseVideoExtension(path);
      const file = new File([blob], `draft-video.${extension}`, {
        type: blob.type || DraftMediaStore.parseVideoMimeType(path),
      });
      await this.processVideoFile(postId, file);
      const postState = this._getPost(postId);
      if (!postState?.video) {
        return false;
      }
      if (videoEmbed.alt) {
        this.patchSelectedVideo(postId, postState.videoToken, {
          alt: videoEmbed.alt,
        });
      }
      this._updatePost(postId, {
        draftVideoCaptions: videoEmbed.captions ?? null,
      });
      return true;
    } catch (error) {
      console.warn("Failed to restore draft video", error);
      showToast("Couldn't restore this draft's video", { style: "warning" });
      return false;
    }
  }

  async confirmClose() {
    // Cancel before prompting so uploads stop while the user decides
    if (this.state.$isSending.get()) {
      this._cancelSend();
    }
    if (this.replyTo) {
      if (!this.hasContent()) {
        return true;
      }
      return confirmModal("Are you sure you'd like to discard this reply?", {
        title: "Discard reply?",
        confirmButtonStyle: "danger-subtle",
        confirmButtonText: "Discard",
      });
    }
    if (!this.hasContent()) {
      return true;
    }
    if (!this.draftsEnabled) {
      return confirmModal("Are you sure you'd like to discard this post?", {
        title: "Discard post?",
        confirmButtonStyle: "danger-subtle",
        confirmButtonText: "Discard",
      });
    }
    if (this._draftId && !this._isDirty) {
      return true;
    }
    const posts = this._getPosts();
    if (!posts.every((postState) => isDraftTextSavable(postState.text))) {
      return confirmModal(
        `You can only save drafts up to ${MAX_DRAFT_GRAPHEME_LENGTH} characters. Your post will be discarded.`,
        {
          title: "Discard post?",
          confirmButtonStyle: "danger-subtle",
          confirmButtonText: "Discard",
        },
      );
    }
    const choice = await this.promptSaveChoice();
    if (choice === "discard") {
      return true;
    }
    if (choice === "save") {
      return this.saveDraft();
    }
    return false;
  }
}

PostComposer.register();
