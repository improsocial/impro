import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { classnames } from "/js/utils.js";
import { ScrollLock } from "/js/scrollLock.js";

class ImageAltTextDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.scrollLock = new ScrollLock(this);
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
    const currentCharCount = this.value.length;
    const maxChars = 2000;
    const charCountPercentage = Math.min(
      Math.round((currentCharCount / maxChars) * 100),
      100,
    );
    const isAboveCharLimit = currentCharCount > maxChars;

    render(
      html`<dialog
        class="image-alt-text-dialog"
        @click=${(e) => {
          if (e.target.tagName === "DIALOG") {
            this.close();
          }
        }}
        @cancel=${() => {
          this.close();
        }}
      >
        <div class="image-alt-text-dialog-content">
          <div class="image-alt-text-dialog-header">
            <h2>Add alt text</h2>
          </div>
          <div class="image-alt-text-dialog-body">
            <div class="image-alt-text-dialog-image-container">
              <img src="${this.imageUrl}" alt="Preview" />
            </div>
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
                class="rounded-button rounded-button-secondary"
                @click=${() => this.close()}
              >
                Cancel
              </button>
              <button
                class="rounded-button rounded-button-primary"
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
    this.scrollLock.lock();
    const dialog = this.querySelector(".image-alt-text-dialog");
    dialog.showModal();

    // Focus on the textarea after a small delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const textarea = this.querySelector(".image-alt-text-dialog-textarea");
        if (textarea) {
          textarea.focus();
        }
      });
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".image-alt-text-dialog");
    dialog.close();
    this.dispatchEvent(new CustomEvent("alt-text-dialog-closed"));
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
