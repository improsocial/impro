import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { classnames } from "/js/utils.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { confirm } from "/js/modals.js";
import { ScrollLock } from "/js/scrollLock.js";
import { imageIconTemplate } from "/js/templates/icons/imageIcon.template.js";
import { showToast } from "/js/toasts.js";
import "/js/components/rich-text-input.js";
import "/js/components/image-alt-text-dialog.js";

const SUPPORTED_QUOTE_POST_DOMAINS = [
  "bsky.app",
  "impro.social",
  "dev.impro.social",
];
// e.g. https://bsky.app/profile/gracekind.net/post/3m63ewg5nws23
const QUOTE_POST_PATHNAME_PATTERN =
  /^\/profile\/[a-zA-Z0-9.-]+\/post\/[a-zA-Z0-9.-]+$/;

function isQuotePostLink(url) {
  try {
    const parsedUrl = new URL(url);
    return (
      SUPPORTED_QUOTE_POST_DOMAINS.includes(parsedUrl.hostname) &&
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
            timestamp: post.record.createdAt,
            includeHandle: false,
            includeTime: false,
          })}
          <div class="post-body">
            ${post.record.text
              ? html`<div class="post-text">
                  ${richTextTemplate({
                    text: post.record.text.trimEnd(),
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

function quotedPostTemplate({ post }) {
  return html`
    <div class="quoted-post-link">
      <div class="quoted-post post-content">
        <div class="quoted-post-header">
          ${avatarTemplate({ author: post.author, clickAction: "none" })}
          ${postHeaderTextTemplate({
            author: post.author,
            timestamp: post.record.createdAt,
            enableProfileLink: false,
          })}
        </div>
        <div class="quoted-post-body">
          ${post.record.text
            ? html`<div class="post-text">
                ${richTextTemplate({
                  text: post.record.text.trimEnd(),
                  facets: post.record.facets,
                })}
              </div>`
            : ""}
        </div>
      </div>
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
        onClose,
      })}
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
        `
      )}
    </div>
  `;
}

class PostComposer extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.scrollLock = new ScrollLock(this);
    this.innerHTML = "";
    this._postText = "";
    this._isSending = false;
    this._unresolvedFacets = [];
    this._quotedPostUrl = null;
    this._externalLinkUrl = null;
    this._externalLinkEmbedData = null;
    this._rejectedLinkEmbeds = new Set();
    this._selectedImages = [];
    this.render();
    this.initialized = true;
  }

  render() {
    const promptText = this.replyTo ? "Write your reply" : "What's up?";
    const currentCharCount = this._postText.length;
    const charCountPercentage = Math.min(
      Math.round((currentCharCount / 300) * 100),
      100
    );
    const isAboveCharLimit = currentCharCount > 300;
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
                .disabled=${this._isSending || isAboveCharLimit}
              >
                ${this._isSending
                  ? html`Sending... <span>&nbsp;&nbsp;</span>
                      <div class="loading-spinner"></div>`
                  : html`<span>${this.replyTo ? "Reply" : "Post"}</span>`}
              </button>
            </div>
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
            <div class="post-composer-quoted-post-container">
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
                    ${quotedPostTemplate({ post: this.quotedPost })}
                  </div>`
                : ""}
            </div>
            <div class="post-composer-bottom-bar">
              <div class="post-composer-bottom-bar-left">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none;"
                  @change=${(e) => this.handleImageSelect(e)}
                  @cancel=${(e) => {
                    e.stopPropagation();
                  }}
                />
                <button
                  class="image-picker-button"
                  @click=${() => this.handleImageButtonClick()}
                  .disabled=${this._selectedImages.length >= 4}
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
        </dialog>
      `,
      this
    );
  }

  handleExternalLinkEmbedPreviewClose() {
    this._rejectedLinkEmbeds.add(this._externalLinkUrl);
    this._externalLinkUrl = null;
    this._externalLinkEmbedData = null;
    this.render();
  }

  handleQuotedPostEmbedPreviewClose() {
    this._rejectedLinkEmbeds.add(this._quotedPostUrl);
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
      this.quotedPost = await this.dataLayer.declarations.ensurePost(postUri);
      this.render();
    } catch (error) {
      console.error("Error loading quoted post from link: ", error);
      this._quotedPostUrl = null;
      this._rejectedLinkEmbeds.add(this._quotedPostUrl);
      return;
    }
  }

  handleImageButtonClick() {
    const input = this.querySelector('input[type="file"]');
    if (input) {
      input.click();
    }
  }

  async handleImageSelect(e) {
    const files = Array.from(e.target.files);
    const maxImages = 4;
    const remainingSlots = maxImages - this._selectedImages.length;

    if (files.length > remainingSlots) {
      showToast("You can select up to 4 images in total");
    }

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const dataUrl = await this.readFileAsDataUrl(file);
        this._selectedImages.push({
          file,
          dataUrl,
        });
      }
    }

    // Reject external link embed if images are added
    if (this._selectedImages.length > 0 && this._externalLinkUrl) {
      this._rejectedLinkEmbeds.add(this._externalLinkUrl);
      this._externalLinkUrl = null;
      this._externalLinkEmbedData = null;
    }

    // Reset the input so the same file can be selected again
    e.target.value = "";
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

  handleInput(e) {
    const previousFacets = this._unresolvedFacets;
    this._postText = e.detail.text;
    this._unresolvedFacets = e.detail.facets;
    // If the facets *haven't* changed, check for possible link embeds
    if (
      JSON.stringify(previousFacets) === JSON.stringify(this._unresolvedFacets)
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
          (facet) => facet.features[0].$type === "app.bsky.richtext.facet#link"
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
      res = await fetch("https://cardyb.bsky.app/v1/extract?url=" + url);
    } catch (error) {
      console.error("Error loading external link embed preview: ", error);
      return;
    }
    if (res && res.ok) {
      const data = await res.json();
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
          imageRes = await fetch(data.image);
        } catch (error) {}
        if (imageRes && imageRes.ok) {
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

    // Setup mobile swipe-to-dismiss
    this.setupMobileDragToDismiss(dialog);

    // Setup keyboard handling for mobile
    this.setupKeyboardHandling(dialog);

    // focus on the textarea after a small delay to ensure keyboard handling is set up
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const richTextInput = this.querySelector("rich-text-input");
        if (richTextInput) {
          richTextInput.focus();
        }
      });
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".post-composer");

    // Clean up drag state
    if (this._dragState) {
      dialog.style.transform = "";
      dialog.style.transition = "";
      dialog.style.height = "";
      this._dragState = null;
    }

    // Clean up keyboard listeners
    if (this._keyboardListeners) {
      window.visualViewport?.removeEventListener(
        "resize",
        this._keyboardListeners.resize
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        this._keyboardListeners.scroll
      );
      this._keyboardListeners = null;
    }

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
          unresolvedFacets: this._unresolvedFacets,
          external: this._externalLinkEmbedData,
          replyTo: this.replyTo,
          replyRoot: this.replyRoot,
          quotedPost: this.quotedPost,
          images: this._selectedImages,
          successCallback,
          errorCallback,
        },
      })
    );
  }

  // Claude wrote this
  setupMobileDragToDismiss(dialog) {
    // Only enable on mobile
    if (window.matchMedia("(min-width: 800px)").matches) return;

    const DISMISS_THRESHOLD = 50; // pixels to drag before dismissing
    const RESISTANCE_FACTOR = 0.6; // how much resistance to apply as you drag

    let dragState = {
      startY: 0,
      currentY: 0,
      isDragging: false,
      initialHeight: 0,
    };

    this._dragState = dragState;

    const handleTouchStart = (e) => {
      // Only start drag from non-interactive elements
      if (e.target.tagName === "BUTTON" || e.target.tagName === "TEXTAREA")
        return;

      dragState.startY = e.touches[0].clientY;
      dragState.currentY = dragState.startY;
      dragState.isDragging = true;
      dragState.initialHeight = dialog.getBoundingClientRect().height;

      // Remove any existing transitions for immediate response
      dialog.style.transition = "none";
    };

    const handleTouchMove = (e) => {
      if (!dragState.isDragging) return;

      dragState.currentY = e.touches[0].clientY;
      const deltaY = dragState.currentY - dragState.startY;

      e.preventDefault();

      if (deltaY > 0) {
        // Dragging down - translate the whole menu
        const adjustedDelta = deltaY * RESISTANCE_FACTOR;
        dialog.style.transform = `translateY(${adjustedDelta}px)`;
      } else {
        // Dragging up - stretch the element taller with rubber band
        const adjustedDelta = Math.abs(deltaY) * (RESISTANCE_FACTOR * 0.5);

        // Calculate the stretched height based on initial height + stretch amount
        const newHeight = dragState.initialHeight + adjustedDelta;

        // Expand upward by increasing height (no transform needed, bottom stays at 0)
        dialog.style.height = `${newHeight}px`;
      }
    };

    const handleTouchEnd = async () => {
      if (!dragState.isDragging) return;

      const deltaY = dragState.currentY - dragState.startY;

      // Add transition for snap-back or dismiss animation
      dialog.style.transition =
        "transform 0.15s ease-out, height 0.15s ease-out";

      if (deltaY > DISMISS_THRESHOLD && (await this.confirmClose())) {
        // Dismiss - animate out and close (only if dragged down)
        dialog.style.transform = "translateY(100%)";
        this.close();
      } else {
        // Snap back to original position (for both up and down drags)
        dialog.style.transform = "";
        dialog.style.height = "";
      }

      dragState.isDragging = false;
    };

    dialog.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    dialog.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    dialog.addEventListener("touchend", handleTouchEnd);
  }

  confirmClose() {
    // Todo - check for other unsaved changes
    if (this._postText.length === 0) {
      return true;
    }
    return confirm("Are you sure you'd like to discard this draft?", {
      title: "Discard draft?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Discard",
    });
  }
  // Claude wrote this
  setupKeyboardHandling() {
    // Only enable on mobile
    if (window.matchMedia("(min-width: 800px)").matches) return;
    if (!window.visualViewport) return;

    const content = this.querySelector(".post-composer-content");
    // const bottomBar = this.querySelector(".post-composer-bottom-bar");

    const updatePosition = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport.height;
      const offsetTop = viewport.offsetTop;

      // When keyboard opens, viewport height decreases
      // Keep modal full height but adjust content padding to bring bottom bar up
      if (offsetTop > 0 || viewportHeight < window.innerHeight) {
        // Keyboard is likely open
        const keyboardHeight = window.innerHeight - viewportHeight;
        if (content) {
          // Add padding to push bottom bar above keyboard
          content.style.paddingBottom = `${keyboardHeight + 16}px`;
        }
      } else {
        // Keyboard is closed
        if (content) {
          content.style.paddingBottom =
            "calc(var(--safe-area-inset-bottom) + 16px)";
        }
      }
    };

    const handleResize = () => {
      updatePosition();
    };

    const handleScroll = () => {
      updatePosition();
    };

    this._keyboardListeners = {
      resize: handleResize,
      scroll: handleScroll,
    };

    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleScroll);
  }
}

PostComposer.register();
