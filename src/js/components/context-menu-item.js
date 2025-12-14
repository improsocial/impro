import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";

class ContextMenuItem extends Component {
  static get observedAttributes() {
    return ["disabled"];
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.disabled = this.getAttribute("disabled") !== null;
    this.render();
    this._initialized = true;
  }

  attributeChangedCallback(name) {
    if (!this._initialized) {
      return;
    }
    if (name === "disabled") {
      this.disabled = this.getAttribute("disabled") !== null;
      this.render();
    }
  }

  render() {
    render(
      html`<div class="context-menu-item">
        <button ?disabled=${this.disabled}></button>
      </div> `,
      this
    );
    const button = this.querySelector("button");
    button.appendChild(this._children);
  }
}

ContextMenuItem.register();
