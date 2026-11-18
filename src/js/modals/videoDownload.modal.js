import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";
import { saveFileToDevice } from "/js/videoUtils.js";

function progressBarTemplate({ progressPercent }) {
  if (progressPercent === null) {
    return html`<div
      class="video-download-progress"
      role="progressbar"
      data-testid="video-download-progress"
    >
      <div class="video-download-progress-fill"></div>
    </div>`;
  }
  return html`<div
    class="video-download-progress"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow=${progressPercent}
    data-testid="video-download-progress"
    data-teststate="determinate"
  >
    <div
      class="video-download-progress-fill is-determinate"
      style="width: ${progressPercent}%"
    ></div>
  </div>`;
}

// Sharing and downloading both require transient user activation, which
// expires while a large video downloads, so they run from a second tap on Save
export class VideoDownloadModal extends Modal {
  #status = "preparing";
  #file = null;
  #progressPercent = null;
  #abortController = new AbortController();

  get className() {
    return "bottom-sheet text-modal compact";
  }

  get attributes() {
    return { "data-testid": "video-download-modal" };
  }

  open() {
    const closed = super.open();
    this.options
      .loadFile({
        signal: this.#abortController.signal,
        onProgress: (progress) => this.#handleProgress(progress),
      })
      .then(
        (file) => {
          this.#file = file;
          this.#status = "ready";
          this.update();
        },
        (error) => {
          if (error.name === "AbortError") {
            return;
          }
          console.warn("Failed to download video", error);
          this.#status = "error";
          this.update();
        },
      );
    return closed.finally(() => this.#abortController.abort());
  }

  #handleProgress({ loaded, total }) {
    if (total === null) {
      return;
    }
    const percent = Math.min(100, Math.floor((loaded / total) * 100));
    if (percent !== this.#progressPercent) {
      this.#progressPercent = percent;
      this.update();
    }
  }

  #handleSave(dismiss) {
    const files = [this.#file];
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files })
    ) {
      navigator.share({ files }).catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Failed to open share sheet", error);
        }
      });
    } else {
      saveFileToDevice(this.#file);
    }
    dismiss();
  }

  render({ dismiss }) {
    const status = this.#status;
    const progressPercent = this.#progressPercent;
    const mediaLabel = this.options.isGif ? "GIF" : "video";
    return html`
      <div class="modal-dialog-content" data-teststate=${status}>
        <h2 class="modal-dialog-title" data-testid="modal-title">
          ${status === "error"
            ? `Couldn't download ${mediaLabel}`
            : `Download ${mediaLabel}`}
        </h2>
        <div class="modal-dialog-message" data-testid="modal-message">
          ${status === "preparing"
            ? html`Preparing ${mediaLabel}…
              ${progressBarTemplate({ progressPercent })}`
            : status === "ready"
              ? `Your ${mediaLabel} is ready to save.`
              : "Something went wrong. Please try again later."}
        </div>
        <div class="modal-dialog-buttons">
          ${status === "error"
            ? html`<button
                class="modal-dialog-button primary-button"
                data-testid="video-download-close-button"
                @click=${() => dismiss()}
              >
                Close
              </button>`
            : html`<button
                  class="modal-dialog-button cancel-button"
                  data-testid="modal-cancel-button"
                  @click=${() => dismiss()}
                >
                  Cancel
                </button>
                <button
                  class="modal-dialog-button primary-button"
                  data-testid="video-download-save-button"
                  ?disabled=${status === "preparing"}
                  @click=${() => this.#handleSave(dismiss)}
                >
                  Save
                </button>`}
        </div>
      </div>
    `;
  }
}
