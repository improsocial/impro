import { html, render } from "/js/lib/lit-html.js";
import { classnames, enableDragToDismiss } from "/js/utils.js";
import { Component, getChildrenFragment } from "./component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { hapticsImpactLight } from "/js/haptics.js";

class ContextMenu extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = new ScrollLock(this);
    this._childNodes = [...this.childNodes];
    this.innerHTML = "";
    this.isOpen = false;
    this.render();
    this._initialized = true;

    this._observer = new MutationObserver(() => {
      this._refreshChildren();
    });
    this._observer.observe(this, { childList: true });
  }

  disconnectedCallback() {
    // If scroll is still prevented, restore it
    this.scrollLock.unlock();
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  _refreshChildren() {
    const container = this.querySelector(".context-menu-container");
    const newChildren = [...this.childNodes].filter(
      (node) => node !== container,
    );
    if (newChildren.length === 0) return;

    this._childNodes = newChildren;
    this.render();
  }

  render() {
    this._observer?.disconnect();

    render(
      html`
        <div
          class=${classnames("context-menu-container", {
            open: this.isOpen,
          })}
          @click=${(e) => {
            // swallow all click events
            e.stopPropagation();
            this.close();
          }}
        >
          <dialog
            class="bottom-sheet context-menu"
            @click=${(e) => {
              // close the dialog if the user clicks outside of it
              if (e.target.tagName === "DIALOG") {
                this.close();
              }
            }}
            @cancel=${() => {
              this.close();
            }}
          >
            ${this._childNodes}
          </dialog>
        </div>
      `,
      this,
    );

    this._observer?.observe(this, { childList: true });
  }

  open(x, y) {
    hapticsImpactLight();
    this.scrollLock.lock();

    const dialog = this.querySelector(".context-menu");
    dialog.showModal();

    // On desktop, position the dialog at the mouse cursor - claude wrote this
    if (window.matchMedia("(min-width: 800px)").matches) {
      const rect = dialog.getBoundingClientRect();
      const margin = 8;
      let left = x;
      let top = y;

      // Adjust if dialog would go off-screen (with margin)
      const maxX = window.innerWidth - rect.width - margin;
      const maxY = window.innerHeight - rect.height - margin;

      if (left > maxX) left = maxX;
      if (top > maxY) top = maxY;
      if (left < margin) left = margin;
      if (top < margin) top = margin;

      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
    }

    this.isOpen = true;
    this.render();

    // Setup mobile swipe-to-dismiss
    enableDragToDismiss(this.querySelector(".context-menu"), {
      eventSource: this.querySelector(".context-menu-container"),
      onClose: () => this.close(),
      allowUpwardStretch: true,
      ignoreTouchTarget: (el) => el.tagName === "BUTTON" || el.tagName === "A",
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".context-menu");
    dialog.close();
    this.isOpen = false;
    this.render();
  }
}

ContextMenu.register();
