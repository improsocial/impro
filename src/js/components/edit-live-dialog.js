import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { showToast } from "/js/toasts.js";
import { classnames, formatDuration, formatShortTime } from "/js/utils.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import "/js/components/live-link-form.js";

class EditLiveDialog extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    const external = this.liveStatus?.embed?.external;
    this._originalUrl = external?.uri ?? "";
    this._initialLinkMeta = external
      ? {
          url: external.uri,
          title: external.title || external.uri,
          description: external.description || "",
          image: external.thumb || null,
        }
      : null;
    this._linkMeta = this._initialLinkMeta;
    this._linkFormLoading = false;
    this._submitError = null;
    this._submitting = false;
    this.render();
    // Re-render every minute so the "expires in ... at ..." row stays current.
    this._tickInterval = setInterval(() => this.render(), 60_000);
  }

  disconnectedCallback() {
    clearInterval(this._tickInterval);
    this._tickInterval = null;
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  open() {
    const dialog = this.querySelector(".edit-live-dialog");
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
    const dialog = this.querySelector(".edit-live-dialog");
    if (!dialog?.open) {
      this.scrollLock?.release();
      this.scrollLock = null;
      this.dispatchEvent(new CustomEvent("close"));
      return Promise.resolve();
    }
    return closeWithAnimation(dialog);
  }

  _isDirty() {
    const url = this._linkMeta?.url;
    return !!url && url !== this._originalUrl;
  }

  _onLinkFormChange(event) {
    this._linkMeta = event.detail.linkMeta;
    this._linkFormLoading = event.detail.isLoading;
    this.render();
  }

  async _submit() {
    const record = this.liveStatus?.record;
    this._submitting = true;
    this._submitError = null;
    this.render();
    try {
      await this.dataLayer.mutations.setLiveStatus({
        durationMinutes: record.durationMinutes,
        linkMeta: this._linkMeta,
        createdAt: record.createdAt,
      });
      await this._close();
      showToast("Live status updated", { style: "success" });
    } catch (error) {
      console.warn("Failed to update live status", error);
      this._submitError =
        error?.data?.message ??
        "Failed to update your live status. Please try again.";
      this._submitting = false;
      this.render();
    }
  }

  async _remove() {
    const confirmed = await confirmModal("Remove your live status?", {
      title: "Remove live status",
      confirmButtonText: "Remove",
      confirmButtonStyle: "danger",
      pendingText: "Removing",
      onConfirm: async () => {
        await this.dataLayer.mutations.clearLiveStatus();
      },
    });
    if (confirmed) {
      await this._close();
      showToast("You are no longer live", { style: "success" });
    }
  }

  render() {
    const record = this.liveStatus?.record;
    const durationMinutes = record?.durationMinutes;
    const expiresAtMs = this.liveStatus?.expiresAt
      ? Date.parse(this.liveStatus.expiresAt)
      : null;
    const remainingMinutes = expiresAtMs
      ? Math.max(0, Math.round((expiresAtMs - Date.now()) / 60000))
      : null;
    const expiryLabel =
      remainingMinutes !== null
        ? `Expires in ${formatDuration(remainingMinutes)} at ${formatShortTime(expiresAtMs)}`
        : "No expiration set";
    const isDirty = this._isDirty();
    const canSave =
      isDirty &&
      !this._submitting &&
      !!this._linkMeta &&
      !this._linkFormLoading;

    render(
      html`
        <dialog
          class="bottom-sheet edit-live-dialog"
          data-testid="edit-live-dialog"
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
            <h2 class="live-dialog-title">You are Live</h2>
            <div class="live-dialog-expiry" data-testid="edit-live-expiry">
              ${expiryLabel}
            </div>
            <live-link-form
              .initialUrl=${this._originalUrl}
              .initialLinkMeta=${this._initialLinkMeta}
              @change=${(event) => this._onLinkFormChange(event)}
            ></live-link-form>
            ${this._submitError
              ? html`<div
                  class="live-dialog-info-box is-error"
                  data-testid="edit-live-error"
                >
                  ${this._submitError}
                </div>`
              : null}
            <div class="live-dialog-actions">
              <button
                type="button"
                class="rounded-button"
                data-testid="edit-live-remove"
                ?disabled=${this._submitting}
                @click=${() => this._remove()}
              >
                Remove live status
              </button>
              <button
                type="button"
                class=${classnames("rounded-button rounded-button-primary", {
                  "is-pending": this._submitting,
                })}
                data-testid="edit-live-save"
                ?disabled=${isDirty ? !canSave : false}
                @click=${() => (isDirty ? this._submit() : this._close())}
              >
                ${this._submitting
                  ? html`Saving
                      <div class="loading-spinner"></div>`
                  : isDirty
                    ? "Save"
                    : "Close"}
              </button>
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }
}

EditLiveDialog.register();
