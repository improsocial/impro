import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";

class ContextMenuItem extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  render() {
    render(html`<div class="context-menu-item"><button></button></div> `, this);
    const button = this.querySelector("button");
    button.appendChild(this._children);
  }
}

ContextMenuItem.register();
