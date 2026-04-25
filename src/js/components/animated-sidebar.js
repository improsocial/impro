import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "./component.js";
import { ScrollLock } from "/js/scrollLock.js";

class AnimatedSidebar extends Component {
  connectedCallback() {
    if (!this._initialized) {
      this.setAttribute("data-dialog-wrapper", "");
      this.scrollLock = new ScrollLock(this);
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
        @cancel=${() => this.close()}
      >
        <div class="sidebar-content"></div>
      </dialog>`,
      this,
    );
    const sidebarContent = this.querySelector(".sidebar-content");
    sidebarContent.appendChild(this._children);
  }

  open() {
    if (!window.matchMedia("(max-width: 799px)").matches) {
      return;
    }
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.scrollLock.lock();
    this.querySelector("dialog.sidebar").showModal();
  }

  close() {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.scrollLock.unlock();
    const dialog = this.querySelector("dialog.sidebar");
    if (dialog.hasAttribute("open")) {
      dialog.close();
    }
  }
}

AnimatedSidebar.register();
