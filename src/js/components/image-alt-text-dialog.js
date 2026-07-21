import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { classnames, graphemeCount } from "/js/utils.js";
import { scrollLocks } from "/js/scrollLocks.js";
import {
  closeWithAnimation,
  enableDragToDismiss,
  resetScrollOnBlur,
} from "/js/dialogHelpers.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";

class ImageAltTextDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  set value(value) {
    this._value = value;
    if (this.initialized) {
      this.render();
    }
  }

  get value() {
    return this._value || "";
  }

  render() {
    const currentCharCount = graphemeCount(this.value);
    const maxChars = 2000;
    const charCountPercentage = Math.min(
      Math.round((currentCharCount / maxChars) * 100),
      100,
    );
    const isAboveCharLimit = currentCharCount > maxChars;

    render(
      html`<dialog
        class="image-alt-text-dialog bottom-sheet bottom-sheet-stacked"
        autofocus
        @click=${(e) => {
          if (e.target.tagName === "DIALOG") {
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
          this.dispatchEvent(new CustomEvent("alt-text-dialog-closed"));
        }}
      >
        <div class="image-alt-text-dialog-content">
          <div class="image-alt-text-dialog-header">
            <h2>Add alt text</h2>
            <button
              class="image-alt-text-dialog-close"
              aria-label="Close"
              data-testid="alt-text-close"
              @click=${() => this.close()}
            >
              ${closeIconTemplate()}
            </button>
          </div>
          <div class="image-alt-text-dialog-body sheet-scroll-region">
            ${this.imageUrl
              ? html`<div class="image-alt-text-dialog-image-container">
                  <img src="${this.imageUrl}" alt="Preview" />
                </div>`
              : ""}
            <div class="image-alt-text-dialog-input-container">
              <textarea
                class="image-alt-text-dialog-textarea"
                placeholder="Alt text"
                .value=${this.value}
                @input=${(e) => {
                  this.value = e.target.value;
                  this.render();
                }}
                maxlength="2000"
              ></textarea>
            </div>
          </div>
          <div class="image-alt-text-dialog-footer">
            <div
              class=${classnames("word-count", {
                overflow: isAboveCharLimit,
              })}
            >
              <span class="word-count-text"
                >${maxChars - currentCharCount}</span
              >
              <div class="word-count-indicator">
                <div
                  class="word-count-indicator-bar"
                  style="height: ${charCountPercentage}%"
                ></div>
              </div>
            </div>
            <div class="image-alt-text-dialog-footer-buttons">
              <button
                class="rounded-button rounded-button-primary"
                data-testid="alt-text-save"
                @click=${() => this.save()}
                .disabled=${isAboveCharLimit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </dialog>`,
      this,
    );
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".image-alt-text-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    this.querySelector(".image-alt-text-dialog-textarea")?.focus({
      preventScroll: true,
    });

    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      ignoreTouchTarget: (element) =>
        element.closest("button, textarea") !== null,
    });

    resetScrollOnBlur(
      dialog,
      this.querySelector(".image-alt-text-dialog-body"),
    );
  }

  close() {
    return closeWithAnimation(this.querySelector(".image-alt-text-dialog"));
  }

  save() {
    this.dispatchEvent(
      new CustomEvent("alt-text-saved", {
        detail: {
          altText: this.value,
        },
      }),
    );
    this.close();
  }
}

ImageAltTextDialog.register();
