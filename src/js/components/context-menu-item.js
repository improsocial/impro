import { Component, getChildrenFragment } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

class ContextMenuItem extends Component {
  static get observedAttributes() {
    return ["disabled", "icon"];
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.disabled = this.getAttribute("disabled") !== null;
    this.icon = this.getAttribute("icon");
    this.render();
    this._initialized = true;
  }

  attributeChangedCallback(name) {
    if (!this._initialized) {
      return;
    }
    if (name === "disabled") {
      this.disabled = this.getAttribute("disabled") !== null;
    } else if (name === "icon") {
      this.icon = this.getAttribute("icon");
    }
    this.render();
  }

  render() {
    render(
      html`<button ?disabled=${this.disabled}>
        ${this._children}
        ${this.icon
          ? html`<app-icon
              class="context-menu-item-icon"
              icon=${this.icon}
            ></app-icon>`
          : null}
      </button>`,
      this,
    );
  }
}

ContextMenuItem.register();
