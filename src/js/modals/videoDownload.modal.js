import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";
import { saveFileToDevice } from "/js/videoUtils.js";

// Sharing and downloading both require transient user activation, which
// expires while a large video downloads, so they run from a second tap on Save
export class VideoDownloadModal extends Modal {
  #status = "preparing";
  #file = null;
  #abortController = new AbortController();

  get className() {
    return "bottom-sheet text-modal compact";
  }

  get attributes() {
    return { "data-testid": "video-download-modal" };
  }

  open() {
    const closed = super.open();
    this.options.loadFile(this.#abortController.signal).then(
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
                <div
                  class="video-download-progress"
                  role="progressbar"
                  data-testid="video-download-progress"
                >
                  <div class="video-download-progress-fill"></div>
                </div>`
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
