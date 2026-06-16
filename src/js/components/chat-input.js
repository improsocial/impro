import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { sendIconTemplate } from "/js/templates/icons/sendIcon.template.js";
import { emojiIconTemplate } from "/js/templates/icons/emojiIcon.template.js";
import { isMobileViewport } from "/js/utils.js";
import "/js/components/emoji-picker-dialog.js";

class ChatInput extends Component {
  static get observedAttributes() {
    return ["disabled", "loading"];
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.messageText = "";
    this.disabled = this.getAttribute("disabled") !== null;
    this.loading = this.getAttribute("loading") !== null;
    this.render();
    this.updateTextareaHeight();
    this._initialized = true;
  }

  attributeChangedCallback(name) {
    if (!this._initialized) {
      return;
    }
    if (name === "disabled") {
      this.disabled = this.getAttribute("disabled") !== null;
      this.render();
    } else if (name === "loading") {
      this.loading = this.getAttribute("loading") !== null;
      this.render();
    }
  }

  focus() {
    const textarea = this.querySelector(".message-input-field");
    if (textarea) {
      textarea.focus();
    }
  }

  blur() {
    const textarea = this.querySelector(".message-input-field");
    if (textarea) {
      textarea.blur();
    }
  }

  updateTextareaHeight() {
    const textarea = this.querySelector(".message-input-field");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    this.reportHeight();
  }

  reportHeight() {
    const newHeight = this.offsetHeight;
    if (newHeight === this._lastReportedHeight) {
      return;
    }
    this._lastReportedHeight = newHeight;
    this.dispatchEvent(
      new CustomEvent("height-change", { detail: { height: newHeight } }),
    );
  }

  handleSend() {
    if (this.disabled) return;
    const textarea = this.querySelector(".message-input-field");
    const message = textarea?.value.trim();
    if (message) {
      this.dispatchEvent(
        new CustomEvent("send", {
          detail: { message },
        }),
      );
      // Clear input after sending
      textarea.value = "";
      this.updateTextareaHeight();
    }
  }

  handleEmojiButtonClick(event) {
    const dialog = this.querySelector("emoji-picker-dialog");
    if (!dialog) return;
    if (dialog.isOpen) {
      dialog.close();
    } else {
      dialog.open(event.currentTarget);
    }
  }

  handleEmojiSelect(emoji) {
    const textarea = this.querySelector(".message-input-field");
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value =
      textarea.value.slice(0, start) + emoji + textarea.value.slice(end);
    const cursor = start + emoji.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (isMobileViewport()) return;
      e.preventDefault();
      this.handleSend();
    }
  }

  render() {
    const template = html`
      <div class="message-input-container">
        <div class="message-input-field-wrapper">
          <textarea
            maxlength="10000"
            class="message-input-field"
            placeholder="Write a message"
            rows="1"
            ?disabled=${this.disabled}
            @input=${() => this.updateTextareaHeight()}
            @keydown=${(e) => this.handleKeyDown(e)}
          ></textarea>
          <div class="message-input-emoji-wrapper">
            <button
              class="message-input-emoji-button"
              type="button"
              aria-label="Open emoji picker"
              ?disabled=${this.disabled}
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
        <button
          class="message-input-send-button"
          ?disabled=${this.disabled}
          @click=${() => this.handleSend()}
        >
          ${this.loading
            ? html`<div class="loading-spinner"></div>`
            : sendIconTemplate()}
        </button>
      </div>
    `;
    render(template, this);
  }
}

ChatInput.register();
