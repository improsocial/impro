import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import "/js/components/toggle-switch.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";

class PostNotificationsDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this._postEnabled = this.activitySubscription?.post ?? false;
    this._replyEnabled = this.activitySubscription?.reply ?? false;
    this._isSaving = false;
    this._error = null;
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  get _isDirty() {
    const initial = this.activitySubscription ?? { post: false, reply: false };
    return (
      this._postEnabled !== initial.post || this._replyEnabled !== initial.reply
    );
  }

  render() {
    render(
      html`
        <dialog
          class="bottom-sheet post-notifications-dialog"
          @click=${(event) => {
            if (event.target.tagName === "DIALOG") {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("dialog-closed"));
          }}
        >
          <div class="post-notifications-dialog-content">
            <button
              class="post-notifications-dialog-close"
              @click=${() => this.close()}
            >
              ${closeIconTemplate()}
            </button>
            <div class="post-notifications-dialog-body">
              <div class="post-notifications-dialog-header">
                <h2 class="post-notifications-dialog-title">Keep me posted</h2>
                <p class="post-notifications-dialog-subtitle">
                  Get notified of this account's activity
                </p>
              </div>
              <div class="post-notifications-dialog-options">
                <div class="post-notifications-dialog-option">
                  <label class="post-notifications-dialog-option-label"
                    >Posts</label
                  >
                  <toggle-switch
                    label="Posts"
                    ?checked=${this._postEnabled}
                    ?disabled=${this._isSaving}
                    data-testid="toggle-posts"
                    @change=${(event) => {
                      this._postEnabled = event.detail.checked;
                      if (!this._postEnabled) {
                        this._replyEnabled = false;
                      }
                      this.render();
                    }}
                  ></toggle-switch>
                </div>
                <div class="post-notifications-dialog-option">
                  <label class="post-notifications-dialog-option-label"
                    >Replies</label
                  >
                  <toggle-switch
                    label="Replies"
                    ?checked=${this._replyEnabled}
                    ?disabled=${this._isSaving}
                    data-testid="toggle-replies"
                    @change=${(event) => {
                      this._replyEnabled = event.detail.checked;
                      if (this._replyEnabled) {
                        this._postEnabled = true;
                      }
                      this.render();
                    }}
                  ></toggle-switch>
                </div>
              </div>
              ${this._error
                ? html`<div class="post-notifications-dialog-error">
                    Could not save changes: ${this._error}
                  </div>`
                : null}
              <button
                class="rounded-button rounded-button-primary post-notifications-dialog-save"
                ?disabled=${!this._isDirty || this._isSaving}
                data-testid="save-subscription-button"
                @click=${() => this._save()}
              >
                ${this._isSaving ? "Saving..." : "Save changes"}
                ${this._isSaving
                  ? html`<div class="loading-spinner"></div>`
                  : ""}
              </button>
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  _save() {
    this._isSaving = true;
    this._error = null;
    this.render();

    this.dispatchEvent(
      new CustomEvent("save-subscription", {
        detail: {
          activitySubscription: {
            post: this._postEnabled,
            reply: this._replyEnabled,
          },
          successCallback: () => {
            this._isSaving = false;
            this.close();
          },
          errorCallback: (errorMessage) => {
            this._isSaving = false;
            this._error = errorMessage || "Please try again.";
            this.render();
          },
        },
      }),
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".post-notifications-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      allowOppositeStretch: true,
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  }

  close() {
    return closeWithAnimation(this.querySelector(".post-notifications-dialog"));
  }

  disconnectedCallback() {
    this.scrollLock?.release();
    this.scrollLock = null;
  }
}

PostNotificationsDialog.register();
