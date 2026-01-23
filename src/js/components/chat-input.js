import { Component } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";
import { sendIconTemplate } from "/js/templates/icons/sendIcon.template.js";

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
    const oldHeight = textarea.style.height;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
      const newHeight = textarea.style.height;
      if (newHeight !== oldHeight) {
        this.dispatchEvent(new CustomEvent("resize"));
      }
    }
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

  handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.handleSend();
    }
  }

  render() {
    const template = html`
      <div class="message-input-container">
        <textarea
          maxlength="10000"
          class="message-input-field"
          placeholder="Write a message"
          rows="1"
          ?disabled=${this.disabled}
          @input=${() => this.updateTextareaHeight()}
          @keydown=${(e) => this.handleKeyDown(e)}
        ></textarea>
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
