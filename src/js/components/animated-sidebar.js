import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "./component.js";
import { ScrollLock } from "/js/scrollLock.js";

class AnimatedSidebar extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.scrollLock = new ScrollLock(this);
    this.isOpen = false;
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  render() {
    render(
      html`<div
          class="sidebar-overlay ${this.isOpen ? "open" : ""}"
          @click=${() => this.close()}
        ></div>
        <aside class="sidebar ${this.isOpen ? "open" : ""}">
          <div class="sidebar-content"></div>
        </aside>`,
      this,
    );
    const sidebarContent = this.querySelector(".sidebar-content");
    sidebarContent.appendChild(this._children);
  }

  open() {
    this.isOpen = true;
    this.scrollLock.lock();
    this.render();
  }

  close() {
    this.isOpen = false;
    this.scrollLock.unlock();
    this.render();
  }
}

AnimatedSidebar.register();
