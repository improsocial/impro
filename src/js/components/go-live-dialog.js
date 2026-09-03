import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { showToast } from "/js/toasts.js";
import { classnames, formatDuration, formatShortTime } from "/js/utils.js";
import "/js/components/live-link-form.js";

const DURATIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 5); // 5..240
const DEFAULT_DURATION = 60;

class GoLiveDialog extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._submitError = null;
    this._submitting = false;
    this._duration = DEFAULT_DURATION;
    this._linkMeta = null;
    this._linkFormLoading = false;
    this.render();
    // Re-render every minute so end times in the duration select stay current.
    this._tickInterval = setInterval(() => this.render(), 60_000);
  }

  disconnectedCallback() {
    clearInterval(this._tickInterval);
    this._tickInterval = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  open() {
    const dialog = this.querySelector(".go-live-dialog");
    if (!dialog || dialog.open) return;
    dialog.showModal();
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    this.querySelector("live-link-form")?.focus({ preventScroll: true });
    enableDragToDismiss(dialog, {
      onDismiss: () => this._close(),
      scrollContainer: this.querySelector(".live-dialog-content"),
      ignoreTouchTarget: (element) =>
        element.closest("button, a, input, select") !== null,
      disableWhenKeyboardOpen: true,
    });
  }

  _close() {
    const dialog = this.querySelector(".go-live-dialog");
    if (!dialog?.open) {
      this.scrollLock?.release();
      this.scrollLock = null;
      this.dispatchEvent(new CustomEvent("close"));
      return Promise.resolve();
    }
    return closeWithAnimation(dialog);
  }

  _onLinkFormChange(event) {
    this._linkMeta = event.detail.linkMeta;
    this._linkFormLoading = event.detail.isLoading;
    this.render();
  }

  _handleDurationChange(event) {
    this._duration = Number(event.target.value);
    this.render();
  }

  async _submit() {
    this._submitting = true;
    this._submitError = null;
    this.render();
    try {
      await this.dataLayer.mutations.setLiveStatus({
        durationMinutes: this._duration,
        linkMeta: this._linkMeta,
      });
      await this._close();
      showToast("You are now live!", { style: "success" });
    } catch (error) {
      console.warn("Failed to publish live status", error);
      this._submitError =
        error?.data?.message ??
        "Failed to publish your live status. Please try again.";
      this._submitting = false;
      this.render();
    }
  }

  render() {
    const canSubmit =
      !this._submitting && !!this._linkMeta && !this._linkFormLoading;
    render(
      html`
        <dialog
          class="bottom-sheet go-live-dialog"
          data-testid="go-live-dialog"
          autofocus
          @click=${(event) => {
            if (event.target === event.currentTarget) this._close();
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this._close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("close"));
          }}
        >
          <div class="live-dialog-content">
            <h2 class="live-dialog-title">Go Live</h2>
            <p class="live-dialog-explainer">
              Add a temporary live status to your profile.
            </p>
            <live-link-form
              placeholder="www.mylivestream.tv"
              .initialUrl=${this.initialUrl ?? ""}
              @change=${(event) => this._onLinkFormChange(event)}
            ></live-link-form>
            ${this._linkMeta
              ? html`<label class="live-dialog-field">
                  <span class="live-dialog-label">Duration</span>
                  <div class="select-wrapper">
                    <select
                      data-testid="go-live-duration-select"
                      .value=${String(this._duration)}
                      @change=${(event) => this._handleDurationChange(event)}
                    >
                      ${DURATIONS.map((minutes) => {
                        const endTime = formatShortTime(
                          Date.now() + minutes * 60 * 1000,
                        );
                        return html`<option
                          value=${minutes}
                          ?selected=${minutes === this._duration}
                        >
                          ${formatDuration(minutes)} · ${endTime}
                        </option>`;
                      })}
                    </select>
                  </div>
                </label>`
              : null}
            ${this._submitError
              ? html`<div
                  class="live-dialog-info-box is-error"
                  data-testid="go-live-error"
                >
                  ${this._submitError}
                </div>`
              : null}
            <div class="live-dialog-actions">
              <button
                type="button"
                class="rounded-button"
                data-testid="go-live-cancel"
                ?disabled=${this._submitting}
                @click=${() => this._close()}
              >
                Cancel
              </button>
              <button
                type="button"
                class=${classnames("rounded-button rounded-button-primary", {
                  "is-pending": this._submitting,
                })}
                data-testid="go-live-submit"
                ?disabled=${!canSubmit}
                @click=${() => this._submit()}
              >
                ${this._submitting
                  ? html`Going live
                      <div class="loading-spinner"></div>`
                  : "Go Live"}
              </button>
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }
}

GoLiveDialog.register();
