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
    const dialog = document.createElement("dialog");
    dialog.className = "emoji-picker-dialog-host";
    const picker = document.createElement("emoji-picker");
    picker.style.visibility = "hidden";
    dialog.appendChild(picker);
    dialog.addEventListener("emoji-click", this._handleEmojiClick);
    dialog.addEventListener("click", (event) => {
      // A click whose target is the dialog itself means the backdrop was clicked
      if (event.target === dialog) {
        this.close();
      }
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    this.scrollLock.lock();
    this.isOpen = true;
    this._dialog = dialog;
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
    if (this._dialog?.open) {
      this._dialog.close();
    }
    this._dialog?.remove();
    this._dialog = null;
    this._anchor = null;
    this.scrollLock.unlock();
    this.isOpen = false;
  }

  // Position the picker as a fixed-viewport overlay so it can't fall off
  // small screens. Prefers placing it above the dialog (the previous default)
  // and flips below when there isn't room.
  _positionPicker() {
    const dialog = this._dialog;
    const picker = this._picker;
    if (!dialog || !picker) {
      return;
    }
    const margin = 8;
    const anchor = (this._anchor ?? this).getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = anchor.top - dialogRect.height - margin;
    if (top < margin) {
      const below = anchor.bottom + margin;
      top =
        below + dialogRect.height <= viewportHeight - margin
          ? below
          : Math.max(margin, viewportHeight - dialogRect.height - margin);
    }

    let left = anchor.left;
    if (left + dialogRect.width > viewportWidth - margin) {
      left = Math.max(margin, viewportWidth - dialogRect.width - margin);
    }

    dialog.style.top = `${top}px`;
    dialog.style.left = `${left}px`;
    picker.style.visibility = "";
  }

  _handleEmojiClick = (event) => {
    this.dispatchEvent(
      new CustomEvent("select", { detail: { emoji: event.detail.unicode } }),
    );
  };
}

EmojiPickerDialog.register();
