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

  open(anchor) {
    if (this.isOpen) {
      return;
    }
    this._anchor = anchor ?? this;
    const picker = document.createElement("emoji-picker");
    // Take the picker out of normal flow before insertion so it can't push the
    // anchor (e.g. a flex-centered emoji button) around while we're measuring.
    picker.style.position = "fixed";
    picker.style.top = "0";
    picker.style.left = "0";
    picker.style.visibility = "hidden";
    this.appendChild(picker);
    this.scrollLock.lock();
    this.isOpen = true;
    this._picker = picker;
    this._positionPicker();
    this._reposition = () => this._positionPicker();
    window.addEventListener("resize", this._reposition);
    this._disposers = [this._attachOutsideClickClose()];
  }

  close() {
    if (!this.isOpen) {
      return;
    }
    window.removeEventListener("resize", this._reposition);
    for (const dispose of this._disposers ?? []) {
      dispose();
    }
    this._disposers = null;
    this._reposition = null;
    this._picker = null;
    this._anchor = null;
    this.innerHTML = "";
    this.scrollLock.unlock();
    this.isOpen = false;
  }

  // Close on any click outside the dialog. Deferred to the next tick so the
  // click that opened the dialog doesn't immediately close it.
  _attachOutsideClickClose() {
    const handler = () => this.close();
    const timer = setTimeout(() => {
      document.addEventListener("click", handler);
    }, 0);
    // Dispose
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
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
    const anchor = (this._anchor ?? this).getBoundingClientRect();
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
    picker.style.visibility = "";
  }

  _handleEmojiClick = (event) => {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { emoji: event.detail.unicode } }),
    );
  };
}

EmojiPickerDialog.register();
