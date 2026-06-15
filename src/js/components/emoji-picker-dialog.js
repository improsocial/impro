import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import "/js/lib/emoji-picker-element.js";

class EmojiPickerDialog extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.scrollLock = new ScrollLock(this);
    this.isOpen = false;
    this.addEventListener("emoji-click", this._handleEmojiClick);
    this.addEventListener("click", (event) => event.stopPropagation());
    this._initialized = true;
  }

  disconnectedCallback() {
    this.close();
  }

  open() {
    if (this.isOpen) {
      return;
    }
    const picker = document.createElement("emoji-picker");
    this.appendChild(picker);
    this.scrollLock.lock();
    this.isOpen = true;
    this._picker = picker;
    this._positionPicker();
    this._reposition = () => this._positionPicker();
    window.addEventListener("resize", this._reposition);
  }

  close() {
    if (!this.isOpen) {
      return;
    }
    window.removeEventListener("resize", this._reposition);
    this._reposition = null;
    this._picker = null;
    this.innerHTML = "";
    this.scrollLock.unlock();
    this.isOpen = false;
  }

  // Position the picker as a fixed-viewport overlay so it can't fall off
  // small screens. Prefers placing it above the dialog (the previous default)
  // and flips below when there isn't room.
  _positionPicker() {
    const picker = this._picker;
    if (!picker) {
      return;
    }
    const margin = 8;
    const anchor = this.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = anchor.top - pickerRect.height - margin;
    if (top < margin) {
      const below = anchor.bottom + margin;
      top =
        below + pickerRect.height <= viewportHeight - margin
          ? below
          : Math.max(margin, viewportHeight - pickerRect.height - margin);
    }

    let left = anchor.left;
    if (left + pickerRect.width > viewportWidth - margin) {
      left = Math.max(margin, viewportWidth - pickerRect.width - margin);
    }

    picker.style.position = "fixed";
    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
    picker.style.bottom = "auto";
  }

  _handleEmojiClick = (event) => {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { emoji: event.detail.unicode } }),
    );
  };
}

EmojiPickerDialog.register();
