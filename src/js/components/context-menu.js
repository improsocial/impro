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
    this.scrollLock = new ScrollLock(this);
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.isOpen = false;
    this.render();
    this._initialized = true;
  }

  disconnectedCallback() {
    // If scroll is still prevented, restore it
    this.scrollLock.unlock();
  }

  render() {
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
            class="context-menu"
            @click=${(e) => {
              // close the dialog if the user clicks outside of it
              if (e.target.tagName === "DIALOG") {
                this.close();
              }
            }}
            @cancel=${() => {
              this.close();
            }}
          ></dialog>
        </div>
      `,
      this,
    );

    const dialog = this.querySelector(".context-menu");
    dialog.appendChild(this._children);
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
    this._dragState = enableDragToDismiss(dialog, {
      eventSource: this.querySelector(".context-menu-container"),
      onClose: () => this.close(),
      allowUpwardStretch: true,
      ignoreTouchTarget: (el) => el.tagName === "BUTTON" || el.tagName === "A",
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".context-menu");

    if (this._dragState) {
      this._dragState.cleanup();
      this._dragState = null;
    }

    dialog.close();
    this.isOpen = false;
    this.render();
  }

}

ContextMenu.register();
