import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { isMobileViewport } from "/js/utils.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";

class AnimatedSidebar extends Component {
  connectedCallback() {
    if (!this._initialized) {
      this.setAttribute("data-dialog-wrapper", "");
      this.scrollLock = null;
      this.isOpen = false;
      this._children = getChildrenFragment(this);
      this.innerHTML = "";
      this.render();

      this._mobileMediaQuery = window.matchMedia("(max-width: 799px)");
      this._onViewportChange = (event) => {
        if (!event.matches) {
          this.close();
        }
      };

      this._initialized = true;
    }
    this._mobileMediaQuery.addEventListener("change", this._onViewportChange);
  }

  disconnectedCallback() {
    this._mobileMediaQuery?.removeEventListener(
      "change",
      this._onViewportChange,
    );
  }

  render() {
    render(
      html`<dialog
        class="sidebar"
        @click=${(event) => {
          if (event.target.tagName === "DIALOG") {
            this.close();
          }
        }}
        @cancel=${(event) => {
          event.preventDefault();
          this.close();
        }}
        @close=${() => {
          this.isOpen = false;
          this.scrollLock?.release({
            restoreScroll: this._restoreScroll ?? true,
          });
          this.scrollLock = null;
          this._restoreScroll = null;
        }}
      >
        <div class="sidebar-content"></div>
      </dialog>`,
      this,
    );
    const sidebarContent = this.querySelector(".sidebar-content");
    sidebarContent.appendChild(this._children);
  }

  open() {
    if (!isMobileViewport()) {
      return;
    }
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector("dialog.sidebar");
    dialog.showModal();
    enableDragToDismiss(dialog, {
      direction: "left",
      allowOppositeStretch: true,
      onDismiss: () => this.close(),
    });
  }

  close({ restoreScroll = true, animate = true } = {}) {
    if (!this.isOpen) {
      return;
    }
    this._restoreScroll = restoreScroll;
    const dialog = this.querySelector("dialog.sidebar");
    if (!animate) {
      dialog.removeAttribute("data-closing");
      dialog.inert = false;
      dialog.close();
      return;
    }
    return closeWithAnimation(dialog);
  }
}

AnimatedSidebar.register();
