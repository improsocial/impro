import { html, render } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
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
    this.setupMobileDragToDismiss(dialog);
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".context-menu");

    // Clean up drag state
    if (this._dragState) {
      dialog.style.transform = "";
      dialog.style.transition = "";
      dialog.style.height = "";
      this._dragState = null;
    }

    dialog.close();
    this.isOpen = false;
    this.render();
  }

  // Claude wrote this
  setupMobileDragToDismiss(dialog) {
    // Only enable on mobile
    if (window.matchMedia("(min-width: 800px)").matches) return;

    const DISMISS_THRESHOLD = 50; // pixels to drag before dismissing
    const RESISTANCE_FACTOR = 0.6; // how much resistance to apply as you drag

    let dragState = {
      startY: 0,
      currentY: 0,
      isDragging: false,
      initialHeight: 0,
    };

    this._dragState = dragState;

    const container = this.querySelector(".context-menu-container");

    const handleTouchStart = (e) => {
      // Only start drag from the dialog itself, not from interactive elements
      if (e.target.tagName === "BUTTON" || e.target.tagName === "A") return;

      dragState.startY = e.touches[0].clientY;
      dragState.currentY = dragState.startY;
      dragState.isDragging = true;
      dragState.initialHeight = dialog.getBoundingClientRect().height;

      // Remove any existing transitions for immediate response
      dialog.style.transition = "none";
    };

    const handleTouchMove = (e) => {
      if (!dragState.isDragging) return;

      dragState.currentY = e.touches[0].clientY;
      const deltaY = dragState.currentY - dragState.startY;

      e.preventDefault();

      if (deltaY > 0) {
        // Dragging down - translate the whole menu
        const adjustedDelta = deltaY * RESISTANCE_FACTOR;
        dialog.style.transform = `translateY(${adjustedDelta}px)`;
      } else {
        // Dragging up - stretch the element taller with rubber band
        const adjustedDelta = Math.abs(deltaY) * (RESISTANCE_FACTOR * 0.5);

        // Calculate the stretched height based on initial height + stretch amount
        const newHeight = dragState.initialHeight + adjustedDelta;

        // Expand upward by increasing height (no transform needed, bottom stays at 0)
        dialog.style.height = `${newHeight}px`;
      }
    };

    const handleTouchEnd = () => {
      if (!dragState.isDragging) return;

      const deltaY = dragState.currentY - dragState.startY;

      // Add transition for snap-back or dismiss animation
      dialog.style.transition =
        "transform 0.15s ease-out, height 0.15s ease-out";

      if (deltaY > DISMISS_THRESHOLD) {
        // Dismiss - animate out and close (only if dragged down)
        dialog.style.transform = "translateY(100%)";
        this.close();
      } else {
        // Snap back to original position (for both up and down drags)
        dialog.style.transform = "";
        dialog.style.height = "";
      }

      dragState.isDragging = false;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);
  }
}

ContextMenu.register();
