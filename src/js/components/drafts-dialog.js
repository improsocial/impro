import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { displayRelativeTime, enableDragToDismiss } from "/js/utils.js";
import { Signal, ReactiveStore, effect, untrack } from "/js/signals.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { showToast } from "/js/toasts.js";
import { trashCanIconTemplate } from "/js/templates/icons/trashCanIcon.template.js";
import { playIconTemplate } from "/js/templates/icons/playIcon.template.js";
import {
  getLocalRefsFromDraft,
  getImagesFromDraftPost,
} from "/js/dataHelpers.js";
import { getDraftDeviceId } from "/js/drafts.js";
import "/js/components/infinite-scroll-container.js";

// GIFs are serialized by bsky as external URLs with ww/hh query params on
// known GIF proxy hostnames - no local bytes involved.
const GIF_HOSTNAMES = ["media.tenor.com", "static.klipy.com"];

function parseGifFromUrl(url) {
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch (error) {
    return null;
  }
  if (!GIF_HOSTNAMES.includes(parsed.hostname)) {
    return null;
  }
  const width = Number(parsed.searchParams.get("ww"));
  const height = Number(parsed.searchParams.get("hh"));
  if (!width || !height) {
    return null;
  }
  return {
    url,
    width,
    height,
    alt: parsed.searchParams.get("alt") ?? "",
  };
}

function draftTagTemplate(name, label, { warning = false } = {}) {
  return html`<span
    class="draft-item-tag ${warning ? "draft-item-tag-warning" : ""}"
    data-testid="draft-item-tag-${name}"
    >${label}</span
  >`;
}

function draftMediaTemplate({ images, gif, video }) {
  const thumbs = [];
  for (const image of images) {
    if (image.previewUrl) {
      thumbs.push(
        html`<img
          class="draft-item-thumb"
          src=${image.previewUrl}
          alt=${image.alt ?? ""}
        />`,
      );
    }
  }
  if (gif) {
    thumbs.push(
      html`<img class="draft-item-thumb" src=${gif.url} alt=${gif.alt} />`,
    );
  }
  if (video?.exists) {
    thumbs.push(
      html`<div class="draft-item-thumb draft-item-video-placeholder">
        ${playIconTemplate()}
      </div>`,
    );
  }
  if (thumbs.length === 0) {
    return "";
  }
  return html`<div class="draft-item-media" data-testid="draft-item-media">
    ${thumbs}
  </div>`;
}

function draftItemTemplate({ draftView, onSelect, onDelete }) {
  const posts = draftView.posts;
  const firstPost = posts[0] ?? {};
  const images = getImagesFromDraftPost(firstPost);
  const video = firstPost.embedVideos?.[0] ?? null;
  const gif = parseGifFromUrl(firstPost.embedExternals?.[0]?.uri ?? "");
  const isOriginatingDevice = draftView.draft.deviceId === getDraftDeviceId();
  const hasMissingMedia = posts.some(
    (draftPost) =>
      getImagesFromDraftPost(draftPost).some((image) => !image.exists) ||
      draftPost.embedVideos?.[0]?.exists === false,
  );
  const hasQuotes = posts.some(
    (draftPost) => (draftPost.embedRecords?.length ?? 0) > 0,
  );
  const replyCount = posts.length - 1;
  const showForeignMediaTag = !isOriginatingDevice && hasMissingMedia;
  const showMissingMediaTag = isOriginatingDevice && hasMissingMedia;
  return html`
    <div
      class="draft-item"
      data-testid="draft-item"
      role="button"
      tabindex="0"
      @click=${() => onSelect(draftView)}
      @keydown=${(e) => {
        if (e.key === "Enter") {
          onSelect(draftView);
        }
      }}
    >
      <div class="draft-item-main">
        <div class="draft-item-timestamp">
          ${displayRelativeTime(draftView.updatedAt)}
        </div>
        ${firstPost.text
          ? html`<div class="draft-item-text">${firstPost.text}</div>`
          : ""}
        ${isOriginatingDevice ? draftMediaTemplate({ images, gif, video }) : ""}
        <div class="draft-item-footer">
          ${showForeignMediaTag
            ? draftTagTemplate(
                "foreign-media",
                "Media stored on another device",
              )
            : ""}
          ${showMissingMediaTag
            ? draftTagTemplate("missing-media", "Missing media", {
                warning: true,
              })
            : ""}
          ${hasQuotes ? draftTagTemplate("quote", "Quote post") : ""}
          ${replyCount > 0
            ? draftTagTemplate(
                "thread",
                replyCount === 1 ? "1 more post" : `${replyCount} more posts`,
              )
            : ""}
        </div>
      </div>
      <div class="draft-item-side">
        <button
          class="icon-button draft-item-delete"
          data-testid="draft-item-delete"
          aria-label="Delete draft"
          @click=${(e) => {
            e.stopPropagation();
            onDelete(draftView);
          }}
        >
          ${trashCanIconTemplate()}
        </button>
      </div>
    </div>
  `;
}

class DraftsDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("drafts-dialog");
    this.state.$loadError = new Signal.State(false);
    this.state.$isLoadingMore = new Signal.State(false);
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._loadInitial();
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

  async _loadInitial() {
    if (untrack(() => this.dataLayer.derived.$hydratedDrafts.get()) !== null) {
      return;
    }
    try {
      await this.dataLayer.requests.loadDrafts({ reload: true });
    } catch (error) {
      console.error("Failed to load drafts", error);
      this.state.$loadError.set(true);
    }
  }

  async _loadMore(resume) {
    if (untrack(() => this.state.$isLoadingMore.get())) {
      resume();
      return;
    }
    this.state.$isLoadingMore.set(true);
    try {
      await this.dataLayer.requests.loadDrafts();
    } catch (error) {
      console.error("Failed to load more drafts", error);
    } finally {
      this.state.$isLoadingMore.set(false);
      resume();
    }
  }

  async _onSelect(draftView) {
    // Close first, then restore (close-then-restore ordering)
    this.close();
    this.dispatchEvent(
      new CustomEvent("draft-selected", { detail: { draftView } }),
    );
  }

  async _onDelete(draftView) {
    const confirmed = await confirmModal(
      "This draft will be permanently deleted.",
      {
        title: "Discard draft?",
        confirmButtonStyle: "danger",
        confirmButtonText: "Delete",
      },
    );
    if (!confirmed) return;
    try {
      await this.dataLayer.mutations.deleteDraft({
        draftId: draftView.id,
        localRefs: getLocalRefsFromDraft(draftView.draft),
      });
      this.dispatchEvent(
        new CustomEvent("draft-deleted", {
          detail: { draftId: draftView.id },
        }),
      );
    } catch (error) {
      console.error("Failed to delete draft", error);
      showToast("Failed to delete draft", { style: "error" });
    }
  }

  render() {
    const data = this.dataLayer?.derived.$hydratedDrafts.get() ?? null;
    const draftViews = data?.drafts ?? null;
    const cursor = data?.cursor ?? null;
    const loadError = this.state.$loadError.get();
    const isLoadingMore = this.state.$isLoadingMore.get();
    render(
      html`
        <dialog
          class="bottom-sheet bottom-sheet-stacked no-handle drafts-dialog"
          data-testid="drafts-dialog"
          @click=${(event) => {
            if (event.target.tagName === "DIALOG") {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
        >
          <div class="drafts-dialog-content">
            <div class="drafts-dialog-header">
              <button
                class="text-pill-button drafts-dialog-back"
                data-testid="drafts-dialog-back"
                @click=${() => this.close()}
              >
                Back
              </button>
              <h2 class="drafts-dialog-title" data-testid="modal-title">
                Drafts
              </h2>
            </div>
            <div class="drafts-dialog-list" data-testid="drafts-dialog-list">
              ${loadError
                ? html`<div
                    class="drafts-dialog-message"
                    data-testid="error-state"
                  >
                    Failed to load drafts
                  </div>`
                : draftViews === null
                  ? html`<div class="drafts-dialog-message">
                      <div class="loading-spinner"></div>
                    </div>`
                  : draftViews.length === 0
                    ? html`<div
                        class="drafts-dialog-message"
                        data-testid="empty-state"
                      >
                        No drafts yet
                      </div>`
                    : html`<infinite-scroll-container
                        ?disabled=${cursor === null}
                        @load-more=${(e) => this._loadMore(e.detail.resume)}
                      >
                        ${draftViews.map((draftView) =>
                          draftItemTemplate({
                            draftView,
                            onSelect: (selected) => this._onSelect(selected),
                            onDelete: (selected) => this._onDelete(selected),
                          }),
                        )}
                        ${isLoadingMore
                          ? html`<div class="drafts-dialog-message">
                              <div class="loading-spinner"></div>
                            </div>`
                          : ""}
                      </infinite-scroll-container>`}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector("dialog");
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      scrollContainer: this.querySelector(".drafts-dialog-list"),
      ignoreTouchTarget: (element) => element.closest("button") !== null,
      disableWhenKeyboardOpen: true,
    });
  }

  close() {
    this.scrollLock?.release();
    this.scrollLock = null;
    const dialog = this.querySelector("dialog");
    if (dialog?.open) {
      dialog.close();
    }
    this.dispatchEvent(new CustomEvent("dialog-closed"));
  }
}

DraftsDialog.register();
