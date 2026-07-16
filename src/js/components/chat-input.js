import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { sendIconTemplate } from "/js/templates/icons/sendIcon.template.js";
import { emojiIconTemplate } from "/js/templates/icons/emojiIcon.template.js";
import { hasKeyboardInput, graphemeCount, getByteLength } from "/js/utils.js";
import "/js/components/rich-text-input.js";
import "/js/components/emoji-picker-dialog.js";

// Limits from the chat.bsky.convo.defs#messageInput lexicon
const MAX_MESSAGE_GRAPHEMES = 1000;
const MAX_MESSAGE_BYTES = 10000;

class ChatInput extends Component {
  static get observedAttributes() {
    return ["disabled", "loading", "has-embed"];
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.messageText = "";
    this.disabled = this.getAttribute("disabled") !== null;
    this.loading = this.getAttribute("loading") !== null;
    this.render();
    this.reportHeight();
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
    } else if (name === "has-embed") {
      this.render();
    }
  }

  focus() {
    this.querySelector("rich-text-input")?.focus();
  }

  blur() {
    this.querySelector("rich-text-input")?.blur();
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

  isOverLimit() {
    return (
      graphemeCount(this.messageText) > MAX_MESSAGE_GRAPHEMES ||
      getByteLength(this.messageText) > MAX_MESSAGE_BYTES
    );
  }

  handleInput(event) {
    this.messageText = event.detail.text;
    this.render();
    this.reportHeight();
    this.dispatchEvent(
      new CustomEvent("input-change", {
        detail: {
          text: this.messageText,
          inputType: event.detail.inputType ?? null,
        },
      }),
    );
  }

  handleSend() {
    if (this.disabled || this.loading || this.isOverLimit()) return;
    const message = this.messageText.trim();
    const hasEmbed = this.getAttribute("has-embed") !== null;
    if (!message && !hasEmbed) return;
    this.dispatchEvent(
      new CustomEvent("send", {
        detail: {
          message,
          onSuccess: () => this.querySelector("rich-text-input")?.setText(""),
        },
      }),
    );
  }

  handleEmojiButtonClick(event) {
    const dialog = this.querySelector("emoji-picker-dialog");
    if (!dialog) return;
    if (dialog.isOpen) {
      dialog.close();
    } else {
      // Capture the caret before the picker steals focus
      this._emojiCursor = this.querySelector("rich-text-input")?.getCursor();
      dialog.open(event.currentTarget);
    }
  }

  handleEmojiSelect(emoji) {
    const richTextInput = this.querySelector("rich-text-input");
    if (!richTextInput) return;
    richTextInput.insertText(emoji, this._emojiCursor);
    richTextInput.focus();
  }

  handleKeyDown(e) {
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey) {
      if (!hasKeyboardInput()) return;
      e.preventDefault();
      this.handleSend();
    }
  }

  render() {
    const overLimit = this.isOverLimit();
    const hasEmbed = this.getAttribute("has-embed") !== null;
    const canSend = this.messageText.trim().length > 0 || hasEmbed;
    const template = html`
      <div class="message-input-container">
        <div class="message-input-field-wrapper">
          <rich-text-input
            placeholder="Write a message"
            typeahead-direction="up"
            ?disabled=${this.disabled}
            @input=${(e) => this.handleInput(e)}
            @keydown=${(e) => this.handleKeyDown(e)}
          ></rich-text-input>
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
          ?disabled=${this.disabled || overLimit || !canSend}
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
