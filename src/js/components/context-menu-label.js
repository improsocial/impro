import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";

class ContextMenuLabel extends Component {
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
    render(html`<div class="context-menu-label"></div>`, this);
    const el = this.querySelector(".context-menu-label");
    el.appendChild(this._children);
  }
}

ContextMenuLabel.register();
